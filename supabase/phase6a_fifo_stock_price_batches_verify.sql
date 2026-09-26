-- ============================================================
-- ARC POS
-- PHASE 6A — FIFO STOCK + PRICE BATCHES VERIFY
-- ============================================================

-- 1. FIFO batch table
select
  to_regclass(
    'public.inventory_price_batches'
  )
    as inventory_price_batches_table;


-- 2. Stock receiving RPC
select
  to_regprocedure(
    'public.receive_inventory_batch(uuid,uuid,integer,numeric,numeric,text,text)'
  )
    as receive_inventory_batch_function;


-- 3. FIFO allocator
select
  to_regprocedure(
    'private.arc_fifo_checkout_allocations(uuid,uuid,jsonb)'
  )
    as fifo_checkout_allocator;


-- 4. Sale item batch snapshot column
select
  exists (
    select 1
    from information_schema.columns
    where
      table_schema =
        'public'
      and
      table_name =
        'sale_items'
      and
      column_name =
        'batch_id'
  )
    as sale_items_batch_id_exists;


-- 5. Catalog FIFO fields
select
  column_name
from information_schema.columns
where
  table_schema =
    'public'
  and
  table_name =
    'catalog_variant_inventory'
  and
  column_name in (
    'price_batches',
    'default_price',
    'default_cost'
  )
order by
  column_name;


-- 6. Force PostgREST schema refresh
notify pgrst,
'reload schema';
