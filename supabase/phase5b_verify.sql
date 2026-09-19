-- ============================================================
-- NOVA POS — PHASE 5B PRODUCT PROMOTIONS VERIFY
-- Run AFTER phase5b_product_promotions.sql.
-- This file performs read-only verification.
-- ============================================================

-- 1. Required product promotion columns.
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name in (
    'promotion_enabled',
    'promotion_type',
    'promotion_value',
    'promotion_starts_at',
    'promotion_ends_at'
  )
order by column_name;


-- 2. Required sale snapshot columns.
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (
      table_name = 'sale_items'
      and column_name in (
        'regular_unit_price',
        'product_discount_total'
      )
    )
    or
    (
      table_name = 'sales'
      and column_name = 'product_discount_total'
    )
  )
order by table_name, column_name;


-- 3. Promotion RPCs must exist.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n
  on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_product_promotion',
    'save_product_with_promotion',
    'complete_sale'
  )
order by p.proname;


-- 4. Catalog view exposes both normal and effective prices.
select
  product_name,
  variant_name,
  regular_price,
  price as effective_price,
  promotion_enabled,
  promotion_active,
  promotion_type,
  promotion_value,
  promotion_starts_at,
  promotion_ends_at
from public.catalog_variant_inventory
order by product_name, variant_name
limit 50;


-- 5. No active variant should resolve to a zero/negative effective price.
select
  product_name,
  variant_name,
  sku,
  regular_price,
  price as effective_price
from public.catalog_variant_inventory
where is_active = true
  and price <= 0;


-- 6. Historical promotion totals should never be negative.
select
  count(*) as invalid_sale_item_promotion_rows
from public.sale_items
where product_discount_total < 0
   or regular_unit_price < unit_price;


-- 7. Sale-level promotion snapshot must equal its item snapshots.
select
  s.id as sale_id,
  s.receipt_number,
  s.product_discount_total as sale_product_discount_total,
  coalesce(sum(si.product_discount_total), 0) as item_product_discount_total
from public.sales s
left join public.sale_items si
  on si.sale_id = s.id
 and si.business_id = s.business_id
group by
  s.id,
  s.receipt_number,
  s.product_discount_total
having
  s.product_discount_total
  <> coalesce(sum(si.product_discount_total), 0)
limit 50;
