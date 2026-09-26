-- ============================================================
-- ARC POS
-- PHASE 6B — CASHIER PRICE-BATCH SELECTION
--
-- Builds on:
--   phase6a_fifo_stock_price_batches.sql
--
-- Adds:
--   • optional batch_id on checkout cart lines
--   • authoritative selected-batch checkout allocation
--   • FIFO fallback when cashier does not override
--   • deferred stock/batch consistency reconciliation
-- ============================================================


-- ============================================================
-- 1. CHECKOUT ALLOCATOR
-- ============================================================

create or replace function
private.arc_fifo_checkout_allocations(
  p_business_id uuid,
  p_location_id uuid,
  p_items jsonb
)
returns table (
  variant_id uuid,
  batch_id uuid,
  quantity integer,
  regular_price numeric,
  unit_price numeric,
  unit_cost numeric,
  batch_order integer
)
language sql
stable
set search_path = ''
as $$

  with raw_requested as (

    select
      (
        item.value ->>
        'variant_id'
      )::uuid
        as variant_id,

      nullif(
        item.value ->>
        'batch_id',
        ''
      )::uuid
        as requested_batch_id,

      (
        item.value ->>
        'quantity'
      )::integer
        as quantity

    from jsonb_array_elements(
      p_items
    )
      as item(value)

  ),

  requested as (

    select
      raw_requested.variant_id,

      raw_requested.requested_batch_id,

      sum(
        raw_requested.quantity
      )::integer
        as quantity

    from raw_requested

    group by
      raw_requested.variant_id,
      raw_requested.requested_batch_id

  ),

  batches as (

    select
      batch_record.id
        as batch_id,

      batch_record.variant_id,

      batch_record.remaining_quantity,

      batch_record.regular_unit_price,

      batch_record.unit_cost,

      row_number() over (
        partition by
          batch_record.variant_id
        order by
          batch_record.received_at,
          batch_record.created_at,
          batch_record.id
      )::integer
        as batch_order,

      product_record.promotion_enabled,

      product_record.promotion_type,

      product_record.promotion_value,

      product_record.promotion_starts_at,

      product_record.promotion_ends_at

    from public.inventory_price_batches
      as batch_record

    join public.product_variants
      as variant_record
      on
        variant_record.id =
          batch_record.variant_id
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
          p_business_id
      and
        product_record.status =
          'active'::public.nova_product_status

    where
      batch_record.business_id =
        p_business_id
      and
      batch_record.location_id =
        p_location_id
      and
      batch_record.remaining_quantity >
        0

  ),

  explicit_requested as (

    select
      requested.variant_id,

      requested.requested_batch_id
        as batch_id,

      requested.quantity

    from requested

    where
      requested.requested_batch_id
        is not null

  ),

  explicit_allocations as (

    select
      batches.variant_id,

      batches.batch_id,

      least(
        explicit_requested.quantity,
        batches.remaining_quantity
      )::integer
        as quantity,

      batches.regular_unit_price
        as regular_price,

      private.nova_effective_product_price(
        batches.regular_unit_price,
        batches.promotion_enabled,
        batches.promotion_type,
        batches.promotion_value,
        batches.promotion_starts_at,
        batches.promotion_ends_at
      )::numeric(12,2)
        as unit_price,

      batches.unit_cost,

      batches.batch_order

    from explicit_requested

    join batches
      on
        batches.variant_id =
          explicit_requested.variant_id
      and
        batches.batch_id =
          explicit_requested.batch_id

  ),

  reserved as (

    select
      explicit_allocations.variant_id,

      explicit_allocations.batch_id,

      sum(
        explicit_allocations.quantity
      )::integer
        as quantity

    from explicit_allocations

    group by
      explicit_allocations.variant_id,
      explicit_allocations.batch_id

  ),

  automatic_requested as (

    select
      requested.variant_id,

      sum(
        requested.quantity
      )::integer
        as quantity

    from requested

    where
      requested.requested_batch_id
        is null

    group by
      requested.variant_id

  ),

  available_for_auto as (

    select
      batches.*,

      greatest(
        0,
        batches.remaining_quantity -
        coalesce(
          reserved.quantity,
          0
        )
      )::integer
        as available_quantity

    from batches

    left join reserved
      on
        reserved.variant_id =
          batches.variant_id
      and
        reserved.batch_id =
          batches.batch_id

  ),

  ranked_auto as (

    select
      automatic_requested.variant_id,

      automatic_requested.quantity
        as requested_quantity,

      available_for_auto.batch_id,

      available_for_auto.available_quantity,

      available_for_auto.regular_unit_price,

      available_for_auto.unit_cost,

      available_for_auto.batch_order,

      available_for_auto.promotion_enabled,

      available_for_auto.promotion_type,

      available_for_auto.promotion_value,

      available_for_auto.promotion_starts_at,

      available_for_auto.promotion_ends_at,

      coalesce(
        sum(
          available_for_auto.available_quantity
        ) over (
          partition by
            automatic_requested.variant_id
          order by
            available_for_auto.batch_order,
            available_for_auto.batch_id
          rows between
            unbounded preceding
            and
            1 preceding
        ),
        0
      )::integer
        as quantity_before

    from automatic_requested

    join available_for_auto
      on
        available_for_auto.variant_id =
          automatic_requested.variant_id
      and
        available_for_auto.available_quantity >
          0

  ),

  automatic_allocations as (

    select
      ranked_auto.variant_id,

      ranked_auto.batch_id,

      greatest(
        0,
        least(
          ranked_auto.available_quantity,
          ranked_auto.requested_quantity -
          ranked_auto.quantity_before
        )
      )::integer
        as quantity,

      ranked_auto.regular_unit_price
        as regular_price,

      private.nova_effective_product_price(
        ranked_auto.regular_unit_price,
        ranked_auto.promotion_enabled,
        ranked_auto.promotion_type,
        ranked_auto.promotion_value,
        ranked_auto.promotion_starts_at,
        ranked_auto.promotion_ends_at
      )::numeric(12,2)
        as unit_price,

      ranked_auto.unit_cost,

      ranked_auto.batch_order

    from ranked_auto

  )

  select
    allocation.variant_id,

    allocation.batch_id,

    allocation.quantity,

    allocation.regular_price,

    allocation.unit_price,

    allocation.unit_cost,

    allocation.batch_order

  from (

    select
      explicit_allocations.variant_id,

      explicit_allocations.batch_id,

      explicit_allocations.quantity,

      explicit_allocations.regular_price,

      explicit_allocations.unit_price,

      explicit_allocations.unit_cost,

      explicit_allocations.batch_order

    from explicit_allocations

    where
      explicit_allocations.quantity >
        0


    union all


    select
      automatic_allocations.variant_id,

      automatic_allocations.batch_id,

      automatic_allocations.quantity,

      automatic_allocations.regular_price,

      automatic_allocations.unit_price,

      automatic_allocations.unit_cost,

      automatic_allocations.batch_order

    from automatic_allocations

    where
      automatic_allocations.quantity >
        0

  ) as allocation

  order by
    allocation.variant_id,
    allocation.batch_order,
    allocation.batch_id;

$$;


revoke all
on function private.arc_fifo_checkout_allocations(
  uuid,
  uuid,
  jsonb
)
from
  public,
  anon,
  authenticated;


-- ============================================================
-- 2. DEFERRED STOCK ↔ BATCH RECONCILIATION
--
-- This catches future stock creation paths such as a newly
-- created product with initial stock. It runs at transaction
-- end, after the normal FIFO functions have finished creating
-- or consuming their explicit batches.
-- ============================================================

create or replace function
private.arc_reconcile_inventory_price_batches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand integer :=
    0;

  v_batch_quantity integer :=
    0;

  v_missing_quantity integer :=
    0;

  v_cost numeric(12,2) :=
    0;

  v_price numeric(12,2) :=
    0;
begin

  select
    level_record.on_hand
  into
    v_on_hand
  from public.inventory_levels
    as level_record
  where
    level_record.id =
      new.id;


  if not found then
    return new;
  end if;


  select
    coalesce(
      sum(
        batch_record.remaining_quantity
      ),
      0
    )::integer
  into
    v_batch_quantity
  from public.inventory_price_batches
    as batch_record
  where
    batch_record.business_id =
      new.business_id
    and
    batch_record.location_id =
      new.location_id
    and
    batch_record.variant_id =
      new.variant_id;


  if
    v_batch_quantity =
    v_on_hand
  then
    return new;
  end if;


  if
    v_batch_quantity >
    v_on_hand
  then
    raise exception
      'FIFO price-batch quantity (%) exceeds inventory on hand (%) for variant %',
      v_batch_quantity,
      v_on_hand,
      new.variant_id;
  end if;


  v_missing_quantity :=
    v_on_hand -
    v_batch_quantity;


  if
    v_missing_quantity <= 0
  then
    return new;
  end if;


  select
    coalesce(
      variant_record.cost,
      0
    ),

    coalesce(
      variant_record.price,
      0
    )

  into
    v_cost,
    v_price

  from public.product_variants
    as variant_record

  where
    variant_record.id =
      new.variant_id

    and
    variant_record.business_id =
      new.business_id;


  if not found then
    raise exception
      'Variant not found while reconciling FIFO stock';
  end if;


  insert into public.inventory_price_batches (
    business_id,
    location_id,
    variant_id,
    initial_quantity,
    remaining_quantity,
    unit_cost,
    regular_unit_price,
    received_at,
    created_by_user_id
  )
  values (
    new.business_id,
    new.location_id,
    new.variant_id,
    v_missing_quantity,
    v_missing_quantity,
    v_cost,
    v_price,
    now(),
    (
      select auth.uid()
    )
  );


  return new;

end;
$$;


drop trigger if exists
inventory_levels_reconcile_fifo_batches
on public.inventory_levels;


create constraint trigger
inventory_levels_reconcile_fifo_batches
after insert or update of on_hand
on public.inventory_levels
deferrable initially deferred
for each row
execute function
private.arc_reconcile_inventory_price_batches();


-- ============================================================
-- 3. POSTGREST REFRESH
-- ============================================================

notify pgrst,
'reload schema';
