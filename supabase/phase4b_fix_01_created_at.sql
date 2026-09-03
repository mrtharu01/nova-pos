-- ============================================================
-- NOVA POS
-- PHASE 4B FIX 01
--
-- Fix:
-- "column reference created_at is ambiguous"
--
-- Cause:
-- complete_sale() has an output column called created_at,
-- while public.sales also has a created_at column.
--
-- We explicitly alias the inserted sales row.
-- ============================================================


create or replace function
public.complete_sale(

  p_business_id uuid,

  p_checkout_key uuid,

  p_items jsonb,

  p_payment_method
    public.nova_payment_method,

  p_cash_received numeric
    default null,

  p_reference_number text
    default null,

  p_discount_total numeric
    default 0,

  p_customer_name text
    default null,

  p_customer_email text
    default null,

  p_customer_phone text
    default null,

  p_note text
    default ''

)

returns table (

  sale_id uuid,

  receipt_number text,

  receipt_sequence bigint,

  currency_code text,

  subtotal numeric,

  discount_total numeric,

  tax_total numeric,

  total numeric,

  item_quantity_total integer,

  payment_method text,

  cash_received numeric,

  change_due numeric,

  created_at timestamptz,

  was_existing boolean

)

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_location_id uuid;

  v_currency_code text;

  v_requested_count integer := 0;

  v_processed_count integer := 0;

  v_item_quantity_total integer := 0;

  v_subtotal numeric(12,2) := 0;

  v_discount_total numeric(12,2) :=
    round(
      coalesce(
        p_discount_total,
        0
      ),
      2
    );

  v_tax_total numeric(12,2) := 0;

  v_total numeric(12,2);

  v_cash_received numeric(12,2);

  v_change_due numeric(12,2) := 0;

  v_sale_id uuid;

  v_receipt_number text;

  v_receipt_sequence bigint;

  v_created_at timestamptz;

  v_customer_name text;

  v_customer_email text;

  v_customer_phone text;

  v_note text;

  v_reference_number text;

  v_existing_payment_method text;

  v_cashier_label text;

  v_item record;

  v_before integer;

  v_after integer;

  v_line_subtotal numeric(12,2);

  v_line_discount numeric(12,2);

  v_allocated_discount numeric(12,2) := 0;

  v_inserted_count integer := 0;


begin


  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if v_user_id is null then

    raise exception
      'Authentication required'

      using errcode = '42501';

  end if;


  if p_business_id is null then

    raise exception
      'Business is required';

  end if;


  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'You do not have access to this business'

      using errcode = '42501';

  end if;


  if p_checkout_key is null then

    raise exception
      'Checkout key is required';

  end if;


  if p_payment_method is null then

    raise exception
      'Payment method is required';

  end if;


  -- ==========================================================
  -- IDEMPOTENCY LOCK
  -- ==========================================================

  perform
    pg_catalog.pg_advisory_xact_lock(

      pg_catalog.hashtextextended(

        p_business_id::text
        ||
        ':'
        ||
        p_checkout_key::text,

        0

      )

    );


  -- ==========================================================
  -- EXISTING SALE CHECK
  -- ==========================================================

  select

    existing_sale.id,

    existing_sale.receipt_number,

    existing_sale.receipt_sequence,

    existing_sale.currency_code,

    existing_sale.subtotal,

    existing_sale.discount_total,

    existing_sale.tax_total,

    existing_sale.total,

    existing_sale.item_quantity_total,

    existing_payment.method::text,

    existing_payment.cash_received,

    existing_payment.change_due,

    existing_sale.created_at

  into

    v_sale_id,

    v_receipt_number,

    v_receipt_sequence,

    v_currency_code,

    v_subtotal,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    v_existing_payment_method,

    v_cash_received,

    v_change_due,

    v_created_at

  from public.sales
    as existing_sale


  left join lateral (

    select
      pay.*

    from public.payments
      as pay

    where
      pay.sale_id =
        existing_sale.id

      and
      pay.business_id =
        existing_sale.business_id

    order by
      pay.created_at asc

    limit 1

  ) as existing_payment

  on true


  where
    existing_sale.business_id =
      p_business_id

    and
    existing_sale.checkout_key =
      p_checkout_key

  limit 1;


  if v_sale_id is not null then

    return query

    select

      v_sale_id,

      v_receipt_number,

      v_receipt_sequence,

      v_currency_code,

      v_subtotal,

      v_discount_total,

      v_tax_total,

      v_total,

      v_item_quantity_total,

      coalesce(
        v_existing_payment_method,
        'cash'
      ),

      v_cash_received,

      v_change_due,

      v_created_at,

      true;


    return;

  end if;


  -- ==========================================================
  -- CART VALIDATION
  -- ==========================================================

  if
    p_items is null

    or

    jsonb_typeof(
      p_items
    ) <> 'array'
  then

    raise exception
      'Checkout items must be a JSON array';

  end if;


  if
    jsonb_array_length(
      p_items
    ) = 0
  then

    raise exception
      'Cart is empty';

  end if;


  if
    jsonb_array_length(
      p_items
    ) > 200
  then

    raise exception
      'Too many cart lines';

  end if;


  if v_discount_total < 0 then

    raise exception
      'Discount cannot be negative';

  end if;


  -- ==========================================================
  -- CASHIER
  -- ==========================================================

  select

    coalesce(
      user_record.email,
      'Cashier'
    )

  into
    v_cashier_label

  from auth.users
    as user_record

  where
    user_record.id =
      v_user_id;


  v_cashier_label :=
    coalesce(
      v_cashier_label,
      'Cashier'
    );


  -- ==========================================================
  -- CUSTOMER DATA
  -- ==========================================================

  v_customer_name :=
    nullif(
      trim(
        coalesce(
          p_customer_name,
          ''
        )
      ),
      ''
    );


  v_customer_email :=
    nullif(
      lower(
        trim(
          coalesce(
            p_customer_email,
            ''
          )
        )
      ),
      ''
    );


  v_customer_phone :=
    nullif(
      trim(
        coalesce(
          p_customer_phone,
          ''
        )
      ),
      ''
    );


  v_note :=
    trim(
      coalesce(
        p_note,
        ''
      )
    );


  v_reference_number :=
    nullif(
      trim(
        coalesce(
          p_reference_number,
          ''
        )
      ),
      ''
    );


  if
    v_customer_name is not null

    and

    length(
      v_customer_name
    ) > 160
  then

    raise exception
      'Customer name is too long';

  end if;


  if v_customer_email is not null then

    if
      length(
        v_customer_email
      ) > 320

      or

      position(
        '@'
        in
        v_customer_email
      ) = 0
    then

      raise exception
        'Customer email is invalid';

    end if;

  end if;


  if
    v_customer_phone is not null

    and

    length(
      v_customer_phone
    ) > 50
  then

    raise exception
      'Customer phone is too long';

  end if;


  if length(v_note) > 1000 then

    raise exception
      'Sale note is too long';

  end if;


  if
    v_reference_number is not null

    and

    length(
      v_reference_number
    ) > 160
  then

    raise exception
      'Payment reference is too long';

  end if;


  -- ==========================================================
  -- BUSINESS
  -- ==========================================================

  select
    business_record.currency_code

  into
    v_currency_code

  from public.businesses
    as business_record

  where
    business_record.id =
      p_business_id;


  if v_currency_code is null then

    raise exception
      'Business not found';

  end if;


  -- ==========================================================
  -- DEFAULT INVENTORY LOCATION
  -- ==========================================================

  select
    location_record.id

  into
    v_location_id

  from public.inventory_locations
    as location_record

  where
    location_record.business_id =
      p_business_id

    and
    location_record.is_default =
      true

    and
    location_record.is_active =
      true

  limit 1;


  if v_location_id is null then

    raise exception
      'No active default inventory location is configured';

  end if;


  -- ==========================================================
  -- COUNT UNIQUE CART VARIANTS
  -- ==========================================================

  select
    count(*)::integer

  into
    v_requested_count

  from private.nova_checkout_items(
    p_items
  );


  if v_requested_count = 0 then

    raise exception
      'Cart is empty';

  end if;


  -- ==========================================================
  -- ENSURE INVENTORY ROWS EXIST
  -- ==========================================================

  insert into public.inventory_levels (

    business_id,

    location_id,

    variant_id,

    on_hand,

    low_stock_threshold

  )

  select

    p_business_id,

    v_location_id,

    requested.variant_id,

    0,

    5

  from private.nova_checkout_items(
    p_items
  )
    as requested


  join public.product_variants
    as variant_record

    on
      variant_record.id =
        requested.variant_id

    and
      variant_record.business_id =
        p_business_id


  on conflict (
    location_id,
    variant_id
  )

  do nothing;


  -- ==========================================================
  -- LOCK AND VALIDATE LIVE INVENTORY
  -- ==========================================================

  for v_item in

    select

      requested.variant_id,

      requested.quantity,

      variant_record.product_id,

      product_record.name
        as product_name,

      variant_record.name
        as variant_name,

      variant_record.sku,

      variant_record.price,

      variant_record.cost,

      inventory_record.on_hand


    from private.nova_checkout_items(
      p_items
    )
      as requested


    join public.product_variants
      as variant_record

      on
        variant_record.id =
          requested.variant_id

      and
        variant_record.business_id =
          p_business_id

      and
        variant_record.is_active =
          true


    join public.products
      as product_record

      on
        product_record.id =
          variant_record.product_id

      and
        product_record.business_id =
          variant_record.business_id

      and
        product_record.status =
          'active'::public.nova_product_status


    join public.inventory_levels
      as inventory_record

      on
        inventory_record.business_id =
          p_business_id

      and
        inventory_record.location_id =
          v_location_id

      and
        inventory_record.variant_id =
          variant_record.id


    order by
      requested.variant_id


    for update
      of inventory_record


  loop


    v_processed_count :=
      v_processed_count + 1;


    if
      v_item.quantity is null

      or

      v_item.quantity <= 0
    then

      raise exception
        'Item quantity must be greater than zero';

    end if;


    if v_item.quantity > 9999 then

      raise exception
        'Item quantity is too large';

    end if;


    if
      v_item.on_hand <
      v_item.quantity
    then

      raise exception

        'Insufficient stock for % (%): requested %, available %',

        v_item.product_name,

        v_item.sku,

        v_item.quantity,

        v_item.on_hand;

    end if;


    v_subtotal :=
      v_subtotal
      +
      round(
        v_item.price
        *
        v_item.quantity,
        2
      );


    v_item_quantity_total :=
      v_item_quantity_total
      +
      v_item.quantity;


  end loop;


  if
    v_processed_count <>
    v_requested_count
  then

    raise exception
      'One or more cart items are unavailable, inactive, or belong to another business';

  end if;


  v_subtotal :=
    round(
      v_subtotal,
      2
    );


  if v_subtotal <= 0 then

    raise exception
      'Sale subtotal must be greater than zero';

  end if;


  if
    v_discount_total >=
    v_subtotal
  then

    raise exception
      'Discount must be less than the subtotal';

  end if;


  -- ==========================================================
  -- AUTHORITATIVE TOTAL
  -- ==========================================================

  v_total :=
    round(

      v_subtotal
      -
      v_discount_total
      +
      v_tax_total,

      2

    );


  if v_total <= 0 then

    raise exception
      'Sale total must be greater than zero';

  end if;


  -- ==========================================================
  -- PAYMENT VALIDATION
  -- ==========================================================

  if
    p_payment_method =
      'cash'::public.nova_payment_method
  then


    v_cash_received :=
      round(
        coalesce(
          p_cash_received,
          0
        ),
        2
      );


    if
      v_cash_received <
      v_total
    then

      raise exception

        'Cash received is less than the live sale total of % %',

        v_currency_code,

        v_total;

    end if;


    v_change_due :=
      round(
        v_cash_received
        -
        v_total,
        2
      );


  else


    v_cash_received :=
      null;


    v_change_due :=
      null;


  end if;


  -- ==========================================================
  -- RECEIPT NUMBER
  -- ==========================================================

  select

    receipt_identity.receipt_sequence,

    receipt_identity.receipt_number

  into

    v_receipt_sequence,

    v_receipt_number

  from private.next_receipt_identity(
    p_business_id
  )
    as receipt_identity;


  -- ==========================================================
  -- CREATE SALE
  --
  -- IMPORTANT FIX:
  --
  -- public.sales is explicitly aliased as created_sale.
  --
  -- So PostgreSQL knows that:
  --
  -- created_sale.created_at
  --
  -- means the TABLE COLUMN and not the function output
  -- variable named created_at.
  -- ==========================================================

  insert into public.sales
    as created_sale (

      business_id,

      location_id,

      checkout_key,

      receipt_sequence,

      receipt_number,

      currency_code,

      status,

      cashier_user_id,

      cashier_label,

      customer_name,

      customer_email,

      customer_phone,

      subtotal,

      discount_total,

      tax_total,

      total,

      item_quantity_total,

      note

    )

  values (

    p_business_id,

    v_location_id,

    p_checkout_key,

    v_receipt_sequence,

    v_receipt_number,

    v_currency_code,

    'completed'::public.nova_sale_status,

    v_user_id,

    v_cashier_label,

    v_customer_name,

    v_customer_email,

    v_customer_phone,

    v_subtotal,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    v_note

  )

  returning

    created_sale.id,

    created_sale.created_at

  into

    v_sale_id,

    v_created_at;


  -- ==========================================================
  -- ITEMS + INVENTORY
  -- ==========================================================

  for v_item in

    select

      requested.variant_id,

      requested.quantity,

      variant_record.product_id,

      product_record.name
        as product_name,

      variant_record.name
        as variant_name,

      variant_record.sku,

      variant_record.price,

      variant_record.cost,

      inventory_record.on_hand


    from private.nova_checkout_items(
      p_items
    )
      as requested


    join public.product_variants
      as variant_record

      on
        variant_record.id =
          requested.variant_id

      and
        variant_record.business_id =
          p_business_id


    join public.products
      as product_record

      on
        product_record.id =
          variant_record.product_id

      and
        product_record.business_id =
          variant_record.business_id


    join public.inventory_levels
      as inventory_record

      on
        inventory_record.business_id =
          p_business_id

      and
        inventory_record.location_id =
          v_location_id

      and
        inventory_record.variant_id =
          variant_record.id


    order by
      requested.variant_id


  loop


    v_inserted_count :=
      v_inserted_count + 1;


    v_line_subtotal :=
      round(
        v_item.price
        *
        v_item.quantity,
        2
      );


    if v_discount_total > 0 then


      if
        v_inserted_count =
        v_requested_count
      then


        v_line_discount :=
          round(
            v_discount_total
            -
            v_allocated_discount,
            2
          );


      else


        v_line_discount :=
          round(
            v_discount_total
            *
            v_line_subtotal
            /
            v_subtotal,
            2
          );


      end if;


    else


      v_line_discount :=
        0;


    end if;


    v_allocated_discount :=
      v_allocated_discount
      +
      v_line_discount;


    -- ========================================================
    -- SALE ITEM
    -- ========================================================

    insert into public.sale_items (

      business_id,

      sale_id,

      product_id,

      variant_id,

      product_name,

      variant_name,

      sku,

      quantity,

      unit_price,

      unit_cost,

      line_subtotal,

      discount_total,

      tax_total,

      line_total

    )

    values (

      p_business_id,

      v_sale_id,

      v_item.product_id,

      v_item.variant_id,

      v_item.product_name,

      v_item.variant_name,

      v_item.sku,

      v_item.quantity,

      v_item.price,

      v_item.cost,

      v_line_subtotal,

      v_line_discount,

      0,

      round(
        v_line_subtotal
        -
        v_line_discount,
        2
      )

    );


    -- ========================================================
    -- INVENTORY
    -- ========================================================

    v_before :=
      v_item.on_hand;


    v_after :=
      v_before
      -
      v_item.quantity;


    update public.inventory_levels
      as inventory_to_update

    set

      on_hand =
        v_after,

      updated_at =
        now()

    where

      inventory_to_update.business_id =
        p_business_id

      and

      inventory_to_update.location_id =
        v_location_id

      and

      inventory_to_update.variant_id =
        v_item.variant_id;


    -- ========================================================
    -- INVENTORY MOVEMENT
    -- ========================================================

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

      v_location_id,

      v_item.variant_id,

      'sale'::public.nova_inventory_movement_type,

      -v_item.quantity,

      v_before,

      v_after,

      'Sale',

      v_receipt_number,

      'sale',

      v_sale_id,

      v_user_id

    );


  end loop;


  -- ==========================================================
  -- PAYMENT
  -- ==========================================================

  insert into public.payments (

    business_id,

    sale_id,

    method,

    status,

    amount,

    reference_number,

    cash_received,

    change_due,

    received_by_user_id

  )

  values (

    p_business_id,

    v_sale_id,

    p_payment_method,

    'completed'::public.nova_payment_status,

    v_total,

    v_reference_number,

    v_cash_received,

    v_change_due,

    v_user_id

  );


  -- ==========================================================
  -- RETURN RESULT
  -- ==========================================================

  return query

  select

    v_sale_id,

    v_receipt_number,

    v_receipt_sequence,

    v_currency_code,

    v_subtotal,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    p_payment_method::text,

    v_cash_received,

    v_change_due,

    v_created_at,

    false;


end;

$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function
public.complete_sale(
  uuid,
  uuid,
  jsonb,
  public.nova_payment_method,
  numeric,
  text,
  numeric,
  text,
  text,
  text,
  text
)
from public,
anon;


grant execute
on function
public.complete_sale(
  uuid,
  uuid,
  jsonb,
  public.nova_payment_method,
  numeric,
  text,
  numeric,
  text,
  text,
  text,
  text
)
to authenticated;