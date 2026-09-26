-- ============================================================
-- ARC POS
-- PHASE 8B — SUPPLIER BONUS / FREE STOCK VERIFY
-- ============================================================


-- 1. Audit table must exist.
select
  to_regclass(
    'public.inventory_supplier_bonus_receipts'
  )
    as supplier_bonus_table;


-- 2. RPC must exist with the expected signature.
select
  to_regprocedure(
    'public.receive_inventory_supplier_bonus(uuid,uuid,integer,integer,numeric,numeric,text,text)'
  )
    as supplier_bonus_rpc;


-- 3. Required audit columns must exist.
select
  column_name,
  data_type
from information_schema.columns
where
  table_schema =
    'public'
  and
  table_name =
    'inventory_supplier_bonus_receipts'
  and
  column_name in (
    'business_id',
    'location_id',
    'variant_id',
    'movement_id',
    'batch_id',
    'paid_quantity',
    'bonus_quantity',
    'total_received',
    'supplier_unit_cost',
    'invoice_cost',
    'effective_unit_cost',
    'actor_user_id',
    'created_at'
  )
order by
  column_name;


-- 4. Existing audit rows must be internally consistent.
-- Expected: zero rows.
select
  id,
  paid_quantity,
  bonus_quantity,
  total_received
from public.inventory_supplier_bonus_receipts
where
  total_received <>
    paid_quantity +
    bonus_quantity
  or
  paid_quantity <= 0
  or
  bonus_quantity <= 0;


-- 5. Each audited receipt must point to the exact movement and FIFO batch.
-- Expected: zero rows.
select
  bonus.id
from public.inventory_supplier_bonus_receipts
  as bonus
left join public.inventory_movements
  as movement_record
  on
    movement_record.id =
      bonus.movement_id
    and
    movement_record.business_id =
      bonus.business_id
    and
    movement_record.location_id =
      bonus.location_id
    and
    movement_record.variant_id =
      bonus.variant_id
left join public.inventory_price_batches
  as batch_record
  on
    batch_record.id =
      bonus.batch_id
    and
    batch_record.business_id =
      bonus.business_id
    and
    batch_record.location_id =
      bonus.location_id
    and
    batch_record.variant_id =
      bonus.variant_id
where
  movement_record.id is null
  or
  batch_record.id is null;


-- 6. Audit quantities must match the created movement/batch.
-- Expected: zero rows.
select
  bonus.id,
  bonus.total_received,
  movement_record.quantity_delta,
  batch_record.initial_quantity
from public.inventory_supplier_bonus_receipts
  as bonus
join public.inventory_movements
  as movement_record
  on
    movement_record.id =
      bonus.movement_id
join public.inventory_price_batches
  as batch_record
  on
    batch_record.id =
      bonus.batch_id
where
  movement_record.quantity_delta <>
    bonus.total_received
  or
  batch_record.initial_quantity <>
    bonus.total_received;


notify pgrst,
'reload schema';
