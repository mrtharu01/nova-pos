-- ============================================================
-- ARC POS
-- PHASE 8A — PACK / LOOSE UNIT VERIFY
-- ============================================================


-- 1. Required columns
select
  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and
      table_name = 'products'
      and
      column_name = 'multi_unit_enabled'
  )
    as products_multi_unit_enabled,

  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and
      table_name = 'product_variants'
      and
      column_name = 'unit_parent_variant_id'
  )
    as variants_parent_link,

  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and
      table_name = 'product_variants'
      and
      column_name = 'units_per_parent'
  )
    as variants_conversion_quantity;


-- 2. Required RPCs
select
  to_regprocedure(
    'public.save_product_with_promotion_v4(uuid,text,text,uuid,text,public.nova_product_status,jsonb,boolean,text,numeric,timestamptz,timestamptz,boolean)'
  )
    as product_save_v4,

  to_regprocedure(
    'public.break_inventory_unit(uuid,uuid,integer)'
  )
    as break_inventory_unit;


-- 3. Break audit table
select
  to_regclass(
    'public.inventory_unit_breaks'
  )
    as inventory_unit_breaks_table;


-- 4. Catalog fields
select
  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and
      table_name = 'catalog_variant_inventory'
      and
      column_name = 'multi_unit_enabled'
  )
    as catalog_multi_unit_enabled,

  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and
      table_name = 'catalog_variant_inventory'
      and
      column_name = 'unit_parent_variant_id'
  )
    as catalog_parent_link,

  exists (
    select 1
    from information_schema.columns
    where
      table_schema = 'public'
      and
      table_name = 'catalog_variant_inventory'
      and
      column_name = 'units_per_parent'
  )
    as catalog_conversion_quantity;


-- 5. Invalid unit links
--
-- Expected: zero rows.

select
  child_variant.id
    as child_variant_id,

  child_variant.name
    as child_variant_name,

  parent_variant.id
    as parent_variant_id,

  parent_variant.name
    as parent_variant_name,

  child_variant.units_per_parent

from public.product_variants
  as child_variant

left join public.product_variants
  as parent_variant
  on
    parent_variant.id =
      child_variant.unit_parent_variant_id

where
  child_variant.unit_parent_variant_id
    is not null
  and
  (
    parent_variant.id is null
    or
    parent_variant.business_id <>
      child_variant.business_id
    or
    parent_variant.product_id <>
      child_variant.product_id
    or
    child_variant.units_per_parent <
      2
  );


-- 6. Inventory and FIFO batches must still agree.
--
-- Expected: zero rows.

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


notify pgrst,
'reload schema';
