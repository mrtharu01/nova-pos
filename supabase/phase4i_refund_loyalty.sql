-- ============================================================
-- NOVA POS
-- PHASE 4I — LOYALTY-AWARE REFUNDS + VOIDS
--
-- Requires:
-- Phase 4H refunds / voids
-- Phase 4I customers / loyalty
-- ============================================================


-- ============================================================
-- REFUND / VOID LOYALTY AUDIT
--
-- Keep the actual point effect on the refund/void record as
-- well as in loyalty_transactions.
-- ============================================================

alter table public.sale_refunds

add column if not exists
loyalty_earned_points_reversed integer
not null
default 0
check (
  loyalty_earned_points_reversed >= 0
);


alter table public.sale_refunds

add column if not exists
loyalty_redeemed_points_restored integer
not null
default 0
check (
  loyalty_redeemed_points_restored >= 0
);


alter table public.sale_voids

add column if not exists
loyalty_earned_points_reversed integer
not null
default 0
check (
  loyalty_earned_points_reversed >= 0
);


alter table public.sale_voids

add column if not exists
loyalty_redeemed_points_restored integer
not null
default 0
check (
  loyalty_redeemed_points_restored >= 0
);


-- ============================================================
-- ENSURE COMPOSITE SALE ITEM IDENTITY EXISTS
-- ============================================================

do $$

begin

  if not exists (

    select
      1

    from pg_catalog.pg_constraint

    where
      conname =
        'sale_items_id_business_unique'

      and
      conrelid =
        'public.sale_items'::regclass

  ) then

    alter table public.sale_items

    add constraint
    sale_items_id_business_unique

    unique (
      id,
      business_id
    );

  end if;

end;

$$;


-- ============================================================
-- REFUND SALE
--
-- Loyalty behaviour:
--
-- Original earned points:
--   partially reversed as money is refunded
--
-- Original redeemed points:
--   partially restored as money is refunded
--
-- Full refund:
--   reverses ALL remaining earned points
--   restores ALL remaining redeemed points
--
-- Everything is done inside the refund transaction.
-- ============================================================

create or replace function
public.refund_sale(

  p_business_id uuid,

  p_sale_id uuid,

  p_items jsonb,

  p_refund_method public.nova_payment_method,

  p_reason text default '',

  p_note text default ''

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  v_user_id uuid :=
    (
      select auth.uid()
    );


  -- ==========================================================
  -- SALE
  -- ==========================================================

  v_sale public.sales%rowtype;


  -- ==========================================================
  -- REFUND
  -- ==========================================================

  v_refund_id uuid;

  v_refund_sequence bigint;

  v_refund_number text;

  v_total_refund numeric(12,2) :=
    0;


  -- ==========================================================
  -- SALE STATUS
  -- ==========================================================

  v_total_original_quantity integer :=
    0;

  v_total_refunded_quantity integer :=
    0;


  -- ==========================================================
  -- ITEM
  -- ==========================================================

  v_item jsonb;

  v_sale_item public.sale_items%rowtype;

  v_sale_item_id uuid;

  v_requested_quantity integer;

  v_restock boolean;

  v_already_refunded_quantity integer;

  v_remaining_quantity integer;

  v_already_refunded_amount numeric(12,2);

  v_remaining_amount numeric(12,2);

  v_line_refund numeric(12,2);

  v_unit_refund numeric(12,2);


  -- ==========================================================
  -- INVENTORY
  -- ==========================================================

  v_inventory_before integer;

  v_inventory_after integer;


  -- ==========================================================
  -- LOYALTY
  -- ==========================================================

  v_cumulative_refunded_amount numeric(12,2) :=
    0;


  v_previous_earned_reversed integer :=
    0;


  v_previous_redeemed_restored integer :=
    0;


  v_target_earned_reversed integer :=
    0;


  v_target_redeemed_restored integer :=
    0;


  v_current_earned_reversal integer :=
    0;


  v_current_redeemed_restore integer :=
    0;


  v_loyalty_net_delta integer :=
    0;


begin


  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then

    raise exception
      'Manager access required for refunds'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- INPUT
  -- ==========================================================

  if
    p_refund_method is null
  then

    raise exception
      'Refund method is required';

  end if;


  if
    p_items is null

    or

    jsonb_typeof(
      p_items
    ) <> 'array'

    or

    jsonb_array_length(
      p_items
    ) = 0
  then

    raise exception
      'Select at least one item to refund';

  end if;


  if
    jsonb_array_length(
      p_items
    ) > 200
  then

    raise exception
      'Too many refund items';

  end if;


  /*
   * One sale item should appear only once in a refund request.
   *
   * This prevents duplicate JSON rows from accidentally
   * over-refunding the same sale item.
   */

  if exists (

    select
      1

    from (

      select

        refund_request.value
        ->>
        'saleItemId'
          as sale_item_id,

        count(*) as request_count

      from jsonb_array_elements(
        p_items
      )
        as refund_request(value)

      group by

        refund_request.value
        ->>
        'saleItemId'

      having
        count(*) > 1

    ) as duplicate_request

  ) then

    raise exception
      'The same sale item cannot appear more than once in a refund request';

  end if;


  -- ==========================================================
  -- LOCK SALE
  -- ==========================================================

  select
    sale_record.*

  into
    v_sale

  from public.sales
    as sale_record

  where
    sale_record.id =
      p_sale_id

    and
    sale_record.business_id =
      p_business_id

  for update;


  if not found then

    raise exception
      'Sale not found';

  end if;


  if
    v_sale.status =
      'voided'::public.nova_sale_status
  then

    raise exception
      'A voided sale cannot be refunded';

  end if;


  if
    v_sale.status =
      'refunded'::public.nova_sale_status
  then

    raise exception
      'This sale has already been fully refunded';

  end if;


  -- ==========================================================
  -- CUSTOMER LOYALTY LOCK
  --
  -- Two tills must not modify the same customer's points at
  -- the same time.
  -- ==========================================================

  if
    v_sale.customer_id is not null
  then

    perform
      pg_catalog.pg_advisory_xact_lock(

        pg_catalog.hashtextextended(

          'loyalty:'
          ||
          p_business_id::text
          ||
          ':'
          ||
          v_sale.customer_id::text,

          0

        )

      );

  end if;


  -- ==========================================================
  -- FIRST PASS
  --
  -- Validate EVERYTHING and calculate the exact refund amount
  -- BEFORE inserting the refund header.
  --
  -- This fixes the old refund FK/header-order problem.
  -- ==========================================================

  for v_item in

    select
      refund_request.value

    from jsonb_array_elements(
      p_items
    )
      as refund_request(value)

  loop


    -- --------------------------------------------------------
    -- SALE ITEM ID
    -- --------------------------------------------------------

    begin

      v_sale_item_id :=
        (
          v_item
          ->>
          'saleItemId'
        )::uuid;

    exception
      when others then

        raise exception
          'Invalid refund sale item';

    end;


    -- --------------------------------------------------------
    -- QUANTITY
    -- --------------------------------------------------------

    begin

      v_requested_quantity :=
        (
          v_item
          ->>
          'quantity'
        )::integer;

    exception
      when others then

        raise exception
          'Invalid refund quantity';

    end;


    if
      v_requested_quantity is null

      or

      v_requested_quantity <= 0
    then

      raise exception
        'Refund quantity must be greater than zero';

    end if;


    -- --------------------------------------------------------
    -- RESTOCK
    -- --------------------------------------------------------

    begin

      v_restock :=
        coalesce(
          (
            v_item
            ->>
            'restock'
          )::boolean,
          true
        );

    exception
      when others then

        raise exception
          'Invalid restock value';

    end;


    -- --------------------------------------------------------
    -- LOCK SALE ITEM
    -- --------------------------------------------------------

    select
      item_record.*

    into
      v_sale_item

    from public.sale_items
      as item_record

    where
      item_record.id =
        v_sale_item_id

      and
      item_record.sale_id =
        p_sale_id

      and
      item_record.business_id =
        p_business_id

    for update;


    if not found then

      raise exception
        'Refund item does not belong to this sale';

    end if;


    -- --------------------------------------------------------
    -- PREVIOUS REFUNDS
    -- --------------------------------------------------------

    select

      coalesce(
        sum(
          refund_item.quantity
        ),
        0
      )::integer,

      coalesce(
        sum(
          refund_item.line_refund_total
        ),
        0
      )::numeric(12,2)

    into

      v_already_refunded_quantity,

      v_already_refunded_amount

    from public.sale_refund_items
      as refund_item

    where
      refund_item.sale_item_id =
        v_sale_item.id

      and
      refund_item.business_id =
        p_business_id;


    v_remaining_quantity :=
      v_sale_item.quantity
      -
      v_already_refunded_quantity;


    if
      v_requested_quantity >
      v_remaining_quantity
    then

      raise exception
        'Refund quantity exceeds remaining quantity for %',
        v_sale_item.product_name;

    end if;


    v_remaining_amount :=
      round(
        v_sale_item.line_total
        -
        v_already_refunded_amount,
        2
      );


    /*
     * The final remaining units receive the exact remaining
     * monetary value. This avoids cumulative rounding drift.
     */

    if
      v_requested_quantity =
      v_remaining_quantity
    then

      v_line_refund :=
        v_remaining_amount;

    else

      v_line_refund :=
        round(

          v_sale_item.line_total

          *

          v_requested_quantity

          /

          v_sale_item.quantity,

          2

        );

    end if;


    if
      v_line_refund <= 0
    then

      raise exception
        'Calculated refund amount is invalid';

    end if;


    v_total_refund :=
      v_total_refund
      +
      v_line_refund;

  end loop;


  v_total_refund :=
    round(
      v_total_refund,
      2
    );


  if
    v_total_refund <= 0
  then

    raise exception
      'Refund amount must be greater than zero';

  end if;


  -- ==========================================================
  -- REFUND IDENTITY
  -- ==========================================================

  select

    identity_record.refund_sequence,

    identity_record.refund_number

  into

    v_refund_sequence,

    v_refund_number

  from private.next_refund_identity(
    p_business_id
  )
    as identity_record;


  v_refund_id :=
    gen_random_uuid();


  -- ==========================================================
  -- CREATE REFUND HEADER FIRST
  --
  -- sale_refund_items references this row.
  -- ==========================================================

  insert into public.sale_refunds (

    id,

    business_id,

    sale_id,

    refund_sequence,

    refund_number,

    refund_method,

    amount,

    reason,

    note,

    actor_user_id

  )

  values (

    v_refund_id,

    p_business_id,

    p_sale_id,

    v_refund_sequence,

    v_refund_number,

    p_refund_method,

    v_total_refund,

    btrim(
      coalesce(
        p_reason,
        ''
      )
    ),

    btrim(
      coalesce(
        p_note,
        ''
      )
    ),

    v_user_id

  );


  -- ==========================================================
  -- SECOND PASS
  --
  -- Insert validated refund items and perform inventory return.
  -- ==========================================================

  for v_item in

    select
      refund_request.value

    from jsonb_array_elements(
      p_items
    )
      as refund_request(value)

  loop


    v_sale_item_id :=
      (
        v_item
        ->>
        'saleItemId'
      )::uuid;


    v_requested_quantity :=
      (
        v_item
        ->>
        'quantity'
      )::integer;


    v_restock :=
      coalesce(
        (
          v_item
          ->>
          'restock'
        )::boolean,
        true
      );


    select
      item_record.*

    into
      v_sale_item

    from public.sale_items
      as item_record

    where
      item_record.id =
        v_sale_item_id

      and
      item_record.sale_id =
        p_sale_id

      and
      item_record.business_id =
        p_business_id;


    select

      coalesce(
        sum(
          refund_item.quantity
        ),
        0
      )::integer,

      coalesce(
        sum(
          refund_item.line_refund_total
        ),
        0
      )::numeric(12,2)

    into

      v_already_refunded_quantity,

      v_already_refunded_amount

    from public.sale_refund_items
      as refund_item

    where
      refund_item.sale_item_id =
        v_sale_item.id

      and
      refund_item.business_id =
        p_business_id;


    v_remaining_quantity :=
      v_sale_item.quantity
      -
      v_already_refunded_quantity;


    v_remaining_amount :=
      round(
        v_sale_item.line_total
        -
        v_already_refunded_amount,
        2
      );


    if
      v_requested_quantity =
      v_remaining_quantity
    then

      v_line_refund :=
        v_remaining_amount;

    else

      v_line_refund :=
        round(

          v_sale_item.line_total

          *

          v_requested_quantity

          /

          v_sale_item.quantity,

          2

        );

    end if;


    v_unit_refund :=
      round(

        v_line_refund

        /

        v_requested_quantity,

        2

      );


    -- --------------------------------------------------------
    -- REFUND ITEM
    -- --------------------------------------------------------

    insert into public.sale_refund_items (

      business_id,

      refund_id,

      sale_id,

      sale_item_id,

      product_id,

      variant_id,

      product_name,

      variant_name,

      sku,

      quantity,

      unit_refund_amount,

      line_refund_total,

      restocked

    )

    values (

      p_business_id,

      v_refund_id,

      p_sale_id,

      v_sale_item.id,

      v_sale_item.product_id,

      v_sale_item.variant_id,

      v_sale_item.product_name,

      v_sale_item.variant_name,

      v_sale_item.sku,

      v_requested_quantity,

      v_unit_refund,

      v_line_refund,

      v_restock

    );


    -- --------------------------------------------------------
    -- RESTOCK
    -- --------------------------------------------------------

    if
      v_restock

      and

      v_sale_item.variant_id is not null
    then

      select
        inventory_record.on_hand

      into
        v_inventory_before

      from public.inventory_levels
        as inventory_record

      where
        inventory_record.business_id =
          p_business_id

        and
        inventory_record.location_id =
          v_sale.location_id

        and
        inventory_record.variant_id =
          v_sale_item.variant_id

      for update;


      if not found then

        raise exception
          'Inventory level could not be found for returned item';

      end if;


      v_inventory_after :=
        v_inventory_before
        +
        v_requested_quantity;


      update public.inventory_levels
        as inventory_record

      set

        on_hand =
          v_inventory_after,

        updated_at =
          now()

      where
        inventory_record.business_id =
          p_business_id

        and
        inventory_record.location_id =
          v_sale.location_id

        and
        inventory_record.variant_id =
          v_sale_item.variant_id;


      insert into public.inventory_movements (

        business_id,

        location_id,

        variant_id,

        movement_type,

        quantity_delta,

        quantity_before,

        quantity_after,

        reason,

        note,

        reference_type,

        reference_id,

        actor_user_id

      )

      values (

        p_business_id,

        v_sale.location_id,

        v_sale_item.variant_id,

        'return'::public.nova_inventory_movement_type,

        v_requested_quantity,

        v_inventory_before,

        v_inventory_after,

        'Customer return',

        v_refund_number,

        'refund',

        v_refund_id,

        v_user_id

      );

    end if;

  end loop;


  -- ==========================================================
  -- TOTAL ORIGINAL / REFUNDED QUANTITY
  -- ==========================================================

  select

    coalesce(
      sum(
        item_record.quantity
      ),
      0
    )::integer

  into
    v_total_original_quantity

  from public.sale_items
    as item_record

  where
    item_record.sale_id =
      p_sale_id

    and
    item_record.business_id =
      p_business_id;


  select

    coalesce(
      sum(
        refund_item.quantity
      ),
      0
    )::integer

  into
    v_total_refunded_quantity

  from public.sale_refund_items
    as refund_item

  where
    refund_item.sale_id =
      p_sale_id

    and
    refund_item.business_id =
      p_business_id;


  -- ==========================================================
  -- LOYALTY REFUND EFFECT
  --
  -- We calculate a TARGET cumulative reversal/restoration,
  -- then only apply the incremental difference for this refund.
  --
  -- This means multiple partial refunds remain correct.
  -- ==========================================================

  if
    v_sale.customer_id is not null

    and

    v_sale.total > 0
  then


    select

      coalesce(
        sum(
          refund_record.amount
        ),
        0
      )::numeric(12,2),

      coalesce(
        sum(
          refund_record.loyalty_earned_points_reversed
        ),
        0
      )::integer,

      coalesce(
        sum(
          refund_record.loyalty_redeemed_points_restored
        ),
        0
      )::integer

    into

      v_cumulative_refunded_amount,

      v_previous_earned_reversed,

      v_previous_redeemed_restored

    from public.sale_refunds
      as refund_record

    where
      refund_record.sale_id =
        p_sale_id

      and
      refund_record.business_id =
        p_business_id;


    /*
     * Full refund always reverses/restores every remaining point.
     */

    if
      v_total_refunded_quantity >=
      v_total_original_quantity

      or

      v_cumulative_refunded_amount >=
      v_sale.total
    then

      v_target_earned_reversed :=
        coalesce(
          v_sale.loyalty_points_earned,
          0
        );


      v_target_redeemed_restored :=
        coalesce(
          v_sale.loyalty_points_redeemed,
          0
        );

    else

      v_target_earned_reversed :=
        floor(

          coalesce(
            v_sale.loyalty_points_earned,
            0
          )::numeric

          *

          v_cumulative_refunded_amount

          /

          v_sale.total

        )::integer;


      v_target_redeemed_restored :=
        floor(

          coalesce(
            v_sale.loyalty_points_redeemed,
            0
          )::numeric

          *

          v_cumulative_refunded_amount

          /

          v_sale.total

        )::integer;

    end if;


    v_current_earned_reversal :=
      greatest(

        v_target_earned_reversed

        -

        v_previous_earned_reversed,

        0

      );


    v_current_redeemed_restore :=
      greatest(

        v_target_redeemed_restored

        -

        v_previous_redeemed_restored,

        0

      );


    -- --------------------------------------------------------
    -- SAVE REFUND AUDIT
    -- --------------------------------------------------------

    update public.sale_refunds
      as refund_record

    set

      loyalty_earned_points_reversed =
        v_current_earned_reversal,

      loyalty_redeemed_points_restored =
        v_current_redeemed_restore

    where
      refund_record.id =
        v_refund_id

      and
      refund_record.business_id =
        p_business_id;


    -- --------------------------------------------------------
    -- NET CUSTOMER POINT CHANGE
    --
    -- Restore redeemed points = positive
    -- Reverse earned points   = negative
    -- --------------------------------------------------------

    v_loyalty_net_delta :=
      v_current_redeemed_restore
      -
      v_current_earned_reversal;


    if
      v_loyalty_net_delta <> 0
    then

      insert into public.loyalty_transactions (

        business_id,

        customer_id,

        transaction_type,

        points_delta,

        monetary_value,

        sale_id,

        refund_id,

        description,

        actor_user_id

      )

      values (

        p_business_id,

        v_sale.customer_id,

        'refund_reversal'::public.nova_loyalty_transaction_type,

        v_loyalty_net_delta,

        v_total_refund,

        p_sale_id,

        v_refund_id,

        'Refund '
        ||
        v_refund_number
        ||
        ': reversed '
        ||
        v_current_earned_reversal::text
        ||
        ' earned point(s), restored '
        ||
        v_current_redeemed_restore::text
        ||
        ' redeemed point(s)',

        v_user_id

      );

    end if;

  end if;


  -- ==========================================================
  -- SALE / PAYMENT STATUS
  -- ==========================================================

  if
    v_total_refunded_quantity >=
    v_total_original_quantity
  then

    update public.sales
      as sale_record

    set

      status =
        'refunded'::public.nova_sale_status,

      updated_at =
        now()

    where
      sale_record.id =
        p_sale_id

      and
      sale_record.business_id =
        p_business_id;


    update public.payments
      as payment_record

    set

      status =
        'refunded'::public.nova_payment_status

    where
      payment_record.sale_id =
        p_sale_id

      and
      payment_record.business_id =
        p_business_id;

  else

    update public.sales
      as sale_record

    set

      status =
        'partially_refunded'::public.nova_sale_status,

      updated_at =
        now()

    where
      sale_record.id =
        p_sale_id

      and
      sale_record.business_id =
        p_business_id;


    update public.payments
      as payment_record

    set

      status =
        'partially_refunded'::public.nova_payment_status

    where
      payment_record.sale_id =
        p_sale_id

      and
      payment_record.business_id =
        p_business_id;

  end if;


  -- ==========================================================
  -- RESULT
  -- ==========================================================

  return jsonb_build_object(

    'refundId',
    v_refund_id,

    'refundNumber',
    v_refund_number,

    'saleId',
    p_sale_id,

    'amount',
    v_total_refund,

    'saleStatus',
    case

      when
        v_total_refunded_quantity >=
        v_total_original_quantity

      then
        'refunded'

      else
        'partially_refunded'

    end,

    'loyaltyEarnedPointsReversed',
    v_current_earned_reversal,

    'loyaltyRedeemedPointsRestored',
    v_current_redeemed_restore,

    'loyaltyNetDelta',
    v_loyalty_net_delta

  );

end;

$$;


-- ============================================================
-- REFUND SECURITY
-- ============================================================

revoke all
on function
public.refund_sale(
  uuid,
  uuid,
  jsonb,
  public.nova_payment_method,
  text,
  text
)

from
  public,
  anon;


grant execute
on function
public.refund_sale(
  uuid,
  uuid,
  jsonb,
  public.nova_payment_method,
  text,
  text
)

to authenticated;


-- ============================================================
-- VOID SALE
--
-- Void means the transaction should have effectively never
-- happened.
--
-- Therefore:
--
-- earned loyalty points   -> removed
-- redeemed loyalty points -> restored
-- ============================================================

create or replace function
public.void_sale(

  p_business_id uuid,

  p_sale_id uuid,

  p_reason text default '',

  p_note text default ''

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_sale public.sales%rowtype;


  v_item public.sale_items%rowtype;


  v_inventory_before integer;

  v_inventory_after integer;


  v_existing_refunds bigint;


  v_loyalty_earned_reversed integer :=
    0;


  v_loyalty_redeemed_restored integer :=
    0;


  v_loyalty_net_delta integer :=
    0;


begin


  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then

    raise exception
      'Manager access required to void a sale'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- SALE
  -- ==========================================================

  select
    sale_record.*

  into
    v_sale

  from public.sales
    as sale_record

  where
    sale_record.id =
      p_sale_id

    and
    sale_record.business_id =
      p_business_id

  for update;


  if not found then

    raise exception
      'Sale not found';

  end if;


  if
    v_sale.status =
      'voided'::public.nova_sale_status
  then

    raise exception
      'Sale is already voided';

  end if;


  if
    v_sale.status <>
      'completed'::public.nova_sale_status
  then

    raise exception
      'Only an unrefunded completed sale can be voided';

  end if;


  select
    count(*)

  into
    v_existing_refunds

  from public.sale_refunds
    as refund_record

  where
    refund_record.sale_id =
      p_sale_id

    and
    refund_record.business_id =
      p_business_id;


  if
    v_existing_refunds > 0
  then

    raise exception
      'A sale with refund history cannot be voided';

  end if;


  -- ==========================================================
  -- LOYALTY LOCK
  -- ==========================================================

  if
    v_sale.customer_id is not null
  then

    perform
      pg_catalog.pg_advisory_xact_lock(

        pg_catalog.hashtextextended(

          'loyalty:'
          ||
          p_business_id::text
          ||
          ':'
          ||
          v_sale.customer_id::text,

          0

        )

      );


    v_loyalty_earned_reversed :=
      coalesce(
        v_sale.loyalty_points_earned,
        0
      );


    v_loyalty_redeemed_restored :=
      coalesce(
        v_sale.loyalty_points_redeemed,
        0
      );


    v_loyalty_net_delta :=
      v_loyalty_redeemed_restored
      -
      v_loyalty_earned_reversed;

  end if;


  -- ==========================================================
  -- RESTORE INVENTORY
  -- ==========================================================

  for v_item in

    select
      item_record.*

    from public.sale_items
      as item_record

    where
      item_record.sale_id =
        p_sale_id

      and
      item_record.business_id =
        p_business_id

    order by
      item_record.variant_id nulls last,
      item_record.id

  loop

    if
      v_item.variant_id is not null
    then

      select
        inventory_record.on_hand

      into
        v_inventory_before

      from public.inventory_levels
        as inventory_record

      where
        inventory_record.business_id =
          p_business_id

        and
        inventory_record.location_id =
          v_sale.location_id

        and
        inventory_record.variant_id =
          v_item.variant_id

      for update;


      if not found then

        raise exception
          'Inventory level could not be found while voiding sale';

      end if;


      v_inventory_after :=
        v_inventory_before
        +
        v_item.quantity;


      update public.inventory_levels
        as inventory_record

      set

        on_hand =
          v_inventory_after,

        updated_at =
          now()

      where
        inventory_record.business_id =
          p_business_id

        and
        inventory_record.location_id =
          v_sale.location_id

        and
        inventory_record.variant_id =
          v_item.variant_id;


      insert into public.inventory_movements (

        business_id,

        location_id,

        variant_id,

        movement_type,

        quantity_delta,

        quantity_before,

        quantity_after,

        reason,

        note,

        reference_type,

        reference_id,

        actor_user_id

      )

      values (

        p_business_id,

        v_sale.location_id,

        v_item.variant_id,

        'return'::public.nova_inventory_movement_type,

        v_item.quantity,

        v_inventory_before,

        v_inventory_after,

        'Sale void',

        v_sale.receipt_number,

        'sale_void',

        p_sale_id,

        v_user_id

      );

    end if;

  end loop;


  -- ==========================================================
  -- VOID AUDIT
  -- ==========================================================

  insert into public.sale_voids (

    business_id,

    sale_id,

    reason,

    note,

    actor_user_id,

    loyalty_earned_points_reversed,

    loyalty_redeemed_points_restored

  )

  values (

    p_business_id,

    p_sale_id,

    btrim(
      coalesce(
        p_reason,
        ''
      )
    ),

    btrim(
      coalesce(
        p_note,
        ''
      )
    ),

    v_user_id,

    v_loyalty_earned_reversed,

    v_loyalty_redeemed_restored

  );


  -- ==========================================================
  -- LOYALTY VOID EFFECT
  -- ==========================================================

  if
    v_sale.customer_id is not null

    and

    v_loyalty_net_delta <> 0
  then

    insert into public.loyalty_transactions (

      business_id,

      customer_id,

      transaction_type,

      points_delta,

      monetary_value,

      sale_id,

      description,

      actor_user_id

    )

    values (

      p_business_id,

      v_sale.customer_id,

      'refund_reversal'::public.nova_loyalty_transaction_type,

      v_loyalty_net_delta,

      v_sale.total,

      p_sale_id,

      'Void '
      ||
      v_sale.receipt_number
      ||
      ': reversed '
      ||
      v_loyalty_earned_reversed::text
      ||
      ' earned point(s), restored '
      ||
      v_loyalty_redeemed_restored::text
      ||
      ' redeemed point(s)',

      v_user_id

    );

  end if;


  -- ==========================================================
  -- SALE / PAYMENT
  -- ==========================================================

  update public.sales
    as sale_record

  set

    status =
      'voided'::public.nova_sale_status,

    updated_at =
      now()

  where
    sale_record.id =
      p_sale_id

    and
    sale_record.business_id =
      p_business_id;


  update public.payments
    as payment_record

  set

    status =
      'voided'::public.nova_payment_status

  where
    payment_record.sale_id =
      p_sale_id

    and
    payment_record.business_id =
      p_business_id;


  -- ==========================================================
  -- RESULT
  -- ==========================================================

  return jsonb_build_object(

    'saleId',
    p_sale_id,

    'receiptNumber',
    v_sale.receipt_number,

    'saleStatus',
    'voided',

    'restoredQuantity',
    v_sale.item_quantity_total,

    'loyaltyEarnedPointsReversed',
    v_loyalty_earned_reversed,

    'loyaltyRedeemedPointsRestored',
    v_loyalty_redeemed_restored,

    'loyaltyNetDelta',
    v_loyalty_net_delta

  );

end;

$$;


-- ============================================================
-- VOID SECURITY
-- ============================================================

revoke all
on function
public.void_sale(
  uuid,
  uuid,
  text,
  text
)

from
  public,
  anon;


grant execute
on function
public.void_sale(
  uuid,
  uuid,
  text,
  text
)

to authenticated;


-- ============================================================
-- POSTGREST
-- ============================================================

notify pgrst,
'reload schema';