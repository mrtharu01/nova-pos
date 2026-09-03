-- ============================================================
-- NOVA POS
-- PHASE 4H.1 — REFUNDS, RETURNS & VOIDS
-- ============================================================


-- ============================================================
-- REFUND COUNTERS
-- ============================================================

create table if not exists
public.sale_refund_counters (

  business_id uuid primary key
    references public.businesses(id)
    on delete cascade,

  prefix text not null
    default 'REF',

  next_sequence bigint not null
    default 1
    check (next_sequence > 0),

  updated_at timestamptz not null
    default now()

);


alter table
public.sale_refund_counters
enable row level security;


revoke all
on public.sale_refund_counters
from
  anon,
  authenticated;



-- ============================================================
-- REFUNDS
-- ============================================================

create table if not exists
public.sale_refunds (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete restrict,

  sale_id uuid not null,

  refund_sequence bigint not null,

  refund_number text not null,

  refund_method public.nova_payment_method
    not null,

  amount numeric(12,2) not null
    check (amount > 0),

  reason text not null
    default '',

  note text not null
    default '',

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint sale_refunds_sale_fk
    foreign key (
      sale_id,
      business_id
    )
    references public.sales(
      id,
      business_id
    )
    on delete restrict,

  constraint sale_refunds_business_sequence_unique
    unique (
      business_id,
      refund_sequence
    ),

  constraint sale_refunds_business_number_unique
    unique (
      business_id,
      refund_number
    ),

  constraint sale_refunds_id_business_unique
    unique (
      id,
      business_id
    )

);


create index if not exists
sale_refunds_sale_id_idx
on public.sale_refunds(
  sale_id,
  created_at desc
);


alter table
public.sale_refunds
enable row level security;


revoke all
on public.sale_refunds
from anon;


grant select
on public.sale_refunds
to authenticated;


drop policy if exists
nova_sale_refunds_select
on public.sale_refunds;


create policy
nova_sale_refunds_select

on public.sale_refunds

for select

to authenticated

using (
  (
    select private.is_business_member(
      business_id
    )
  )
);



-- ============================================================
-- REFUND ITEMS
-- ============================================================

create table if not exists
public.sale_refund_items (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null,

  refund_id uuid not null,

  sale_id uuid not null,

  sale_item_id uuid not null,

  product_id uuid,

  variant_id uuid,

  product_name text not null,

  variant_name text not null
    default 'Standard',

  sku text not null
    default '',

  quantity integer not null
    check (quantity > 0),

  unit_refund_amount numeric(12,2) not null
    check (unit_refund_amount >= 0),

  line_refund_total numeric(12,2) not null
    check (line_refund_total > 0),

  restocked boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  constraint sale_refund_items_refund_fk
    foreign key (
      refund_id,
      business_id
    )
    references public.sale_refunds(
      id,
      business_id
    )
    on delete restrict,

  constraint sale_refund_items_sale_fk
    foreign key (
      sale_id,
      business_id
    )
    references public.sales(
      id,
      business_id
    )
    on delete restrict,

  constraint sale_refund_items_sale_item_fk
    foreign key (
      sale_item_id,
      business_id
    )
    references public.sale_items(
      id,
      business_id
    )
    on delete restrict

);


create index if not exists
sale_refund_items_sale_item_idx
on public.sale_refund_items(
  sale_item_id
);


create index if not exists
sale_refund_items_sale_idx
on public.sale_refund_items(
  sale_id
);


alter table
public.sale_refund_items
enable row level security;


revoke all
on public.sale_refund_items
from anon;


grant select
on public.sale_refund_items
to authenticated;


drop policy if exists
nova_sale_refund_items_select
on public.sale_refund_items;


create policy
nova_sale_refund_items_select

on public.sale_refund_items

for select

to authenticated

using (
  (
    select private.is_business_member(
      business_id
    )
  )
);



-- ============================================================
-- SALE VOIDS AUDIT
-- ============================================================

create table if not exists
public.sale_voids (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null,

  sale_id uuid not null,

  reason text not null
    default '',

  note text not null
    default '',

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  constraint sale_voids_sale_fk
    foreign key (
      sale_id,
      business_id
    )
    references public.sales(
      id,
      business_id
    )
    on delete restrict,

  constraint sale_voids_sale_unique
    unique (
      sale_id
    )

);


alter table
public.sale_voids
enable row level security;


revoke all
on public.sale_voids
from anon;


grant select
on public.sale_voids
to authenticated;


drop policy if exists
nova_sale_voids_select
on public.sale_voids;


create policy
nova_sale_voids_select

on public.sale_voids

for select

to authenticated

using (
  (
    select private.is_business_member(
      business_id
    )
  )
);



-- ============================================================
-- PRIVATE REFUND NUMBER GENERATOR
-- ============================================================

create or replace function
private.next_refund_identity(
  p_business_id uuid
)

returns table (

  refund_sequence bigint,

  refund_number text

)

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_sequence bigint;

  v_prefix text;

begin

  insert into public.sale_refund_counters (
    business_id
  )

  values (
    p_business_id
  )

  on conflict (
    business_id
  )

  do nothing;


  select

    counter.prefix,

    counter.next_sequence

  into

    v_prefix,

    v_sequence

  from public.sale_refund_counters
    as counter

  where
    counter.business_id =
      p_business_id

  for update;


  update public.sale_refund_counters
    as counter

  set

    next_sequence =
      counter.next_sequence + 1,

    updated_at =
      now()

  where
    counter.business_id =
      p_business_id;


  return query

  select

    v_sequence,

    (
      v_prefix
      ||
      '-'
      ||
      lpad(
        v_sequence::text,
        6,
        '0'
      )
    );

end;

$$;


revoke all
on function
private.next_refund_identity(uuid)
from public,
anon,
authenticated;



-- ============================================================
-- COMPLETE REFUND
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

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_sale public.sales%rowtype;


  v_refund_id uuid;

  v_refund_sequence bigint;

  v_refund_number text;


  v_total_refund numeric(12,2) :=
    0;


  v_total_original_quantity integer :=
    0;

  v_total_refunded_quantity integer :=
    0;


  v_item jsonb;

  v_sale_item public.sale_items%rowtype;


  v_requested_quantity integer;

  v_restock boolean;


  v_already_refunded_quantity integer;

  v_remaining_quantity integer;


  v_already_refunded_amount numeric(12,2);

  v_remaining_amount numeric(12,2);

  v_line_refund numeric(12,2);

  v_unit_refund numeric(12,2);


  v_inventory_before integer;

  v_inventory_after integer;


begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if v_user_id is null then

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
  -- VALIDATE INPUT
  -- ==========================================================

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
  -- GET REFUND IDENTITY
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
  -- PROCESS REQUESTED ITEMS
  -- ==========================================================

  for v_item in

    select
      value

    from jsonb_array_elements(
      p_items
    )

  loop

    -- --------------------------------------------------------
    -- PARSE REQUEST
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


    v_restock :=
      coalesce(
        (
          v_item
          ->>
          'restock'
        )::boolean,
        true
      );


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
        (
          v_item
          ->>
          'saleItemId'
        )::uuid

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
    -- PREVIOUS REFUNDS FOR THIS LINE
    -- --------------------------------------------------------

    select

      coalesce(
        sum(
          refund_item.quantity
        ),
        0
      ),

      coalesce(
        sum(
          refund_item.line_refund_total
        ),
        0
      )

    into

      v_already_refunded_quantity,

      v_already_refunded_amount

    from public.sale_refund_items
      as refund_item

    where
      refund_item.sale_item_id =
        v_sale_item.id;


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
      v_sale_item.line_total
      -
      v_already_refunded_amount;


    /*
     * If refunding all remaining units, use the exact remaining
     * line amount. This prevents cumulative rounding drift.
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
          (
            v_sale_item.line_total
            *
            v_requested_quantity
            /
            v_sale_item.quantity
          ),
          2
        );

    end if;


    if
      v_line_refund <= 0
    then

      raise exception
        'Calculated refund amount is invalid';

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


    v_total_refund :=
      v_total_refund
      +
      v_line_refund;


    -- --------------------------------------------------------
    -- RESTOCK INVENTORY
    -- --------------------------------------------------------

    if
      v_restock
      and
      v_sale_item.variant_id is not null
    then

      select
        inventory.on_hand

      into
        v_inventory_before

      from public.inventory_levels
        as inventory

      where
        inventory.business_id =
          p_business_id

        and
        inventory.location_id =
          v_sale.location_id

        and
        inventory.variant_id =
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
        as inventory

      set

        on_hand =
          v_inventory_after,

        updated_at =
          now()

      where
        inventory.business_id =
          p_business_id

        and
        inventory.location_id =
          v_sale.location_id

        and
        inventory.variant_id =
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
  -- CREATE REFUND HEADER
  --
  -- FK items reference refund_id, so we need the header before
  -- transaction completion. PostgreSQL FK validation happens
  -- within this same transaction.
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

    trim(
      coalesce(
        p_reason,
        ''
      )
    ),

    trim(
      coalesce(
        p_note,
        ''
      )
    ),

    v_user_id

  );


  -- ==========================================================
  -- DETERMINE NEW SALE STATUS
  -- ==========================================================

  select

    coalesce(
      sum(
        item_record.quantity
      ),
      0
    )

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
    )

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
    end

  );

end;

$$;


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


begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if v_user_id is null then

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
      p_sale_id;


  if
    v_existing_refunds > 0
  then

    raise exception
      'A sale with refund history cannot be voided';

  end if;


  -- ==========================================================
  -- RESTORE ALL INVENTORY
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
        inventory.on_hand

      into
        v_inventory_before

      from public.inventory_levels
        as inventory

      where
        inventory.business_id =
          p_business_id

        and
        inventory.location_id =
          v_sale.location_id

        and
        inventory.variant_id =
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
        as inventory

      set

        on_hand =
          v_inventory_after,

        updated_at =
          now()

      where
        inventory.business_id =
          p_business_id

        and
        inventory.location_id =
          v_sale.location_id

        and
        inventory.variant_id =
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
  -- AUDIT RECORD
  -- ==========================================================

  insert into public.sale_voids (

    business_id,

    sale_id,

    reason,

    note,

    actor_user_id

  )

  values (

    p_business_id,

    p_sale_id,

    trim(
      coalesce(
        p_reason,
        ''
      )
    ),

    trim(
      coalesce(
        p_note,
        ''
      )
    ),

    v_user_id

  );


  -- ==========================================================
  -- UPDATE SALE + PAYMENT STATUS
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
    v_sale.item_quantity_total

  );

end;

$$;


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