-- ============================================================
-- ARC POS
-- PHASE 6B — CASHIER PRICE-BATCH SELECTION VERIFY
-- ============================================================

-- 1. Cashier-selectable allocator exists
select
  to_regprocedure(
    'private.arc_fifo_checkout_allocations(uuid,uuid,jsonb)'
  )
    as fifo_checkout_allocator;


-- 2. Deferred reconciliation trigger exists
select
  exists (
    select 1
    from pg_catalog.pg_trigger
    where
      tgname =
        'inventory_levels_reconcile_fifo_batches'
      and
      not tgisinternal
  )
    as inventory_fifo_reconcile_trigger_exists;


-- 3. Current stock and FIFO batches agree
select
  level_record.business_id,
  level_record.location_id,
  level_record.variant_id,
  level_record.on_hand,
  coalesce(
    sum(
      batch_record.remaining_quantity
    ),
    0
  )::integer
    as fifo_quantity,
  (
    level_record.on_hand -
    coalesce(
      sum(
        batch_record.remaining_quantity
      ),
      0
    )::integer
  )
    as difference
from public.inventory_levels
  as level_record
left join public.inventory_price_batches
  as batch_record
  on
    batch_record.business_id =
      level_record.business_id
    and
    batch_record.location_id =
      level_record.location_id
    and
    batch_record.variant_id =
      level_record.variant_id
group by
  level_record.business_id,
  level_record.location_id,
  level_record.variant_id,
  level_record.on_hand
having
  level_record.on_hand <>
  coalesce(
    sum(
      batch_record.remaining_quantity
    ),
    0
  )::integer;


-- Expected result for query 3:
--   zero rows


notify pgrst,
'reload schema';
