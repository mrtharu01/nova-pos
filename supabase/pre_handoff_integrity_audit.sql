-- ============================================================
-- ARC POS
-- PRE-HANDOFF DATA INTEGRITY AUDIT
-- READ-ONLY
--
-- Run after all required migrations and after the real catalog
-- / opening stock have been loaded.
--
-- Sections labelled "Expected: zero rows" must return nothing.
-- ============================================================


-- ============================================================
-- 1. BUSINESS READINESS SUMMARY
-- ============================================================

select
  business_record.id
    as business_id,

  business_record.name
    as business_name,

  (
    select count(*)
    from public.products
      as product_record
    where
      product_record.business_id =
        business_record.id
      and
      product_record.status =
        'active'::public.nova_product_status
  )
    as active_products,

  (
    select count(*)
    from public.product_variants
      as variant_record
    where
      variant_record.business_id =
        business_record.id
      and
      variant_record.is_active
  )
    as active_variants,

  (
    select count(*)
    from public.inventory_levels
      as level_record
    where level_record.business_id =
      business_record.id
  )
    as inventory_rows,

  (
    select coalesce(
      sum(
        level_record.on_hand
      ),
      0
    )
    from public.inventory_levels
      as level_record
    where level_record.business_id =
      business_record.id
  )
    as units_on_hand,

  (
    select count(*)
    from public.staff_members
      as staff_record
    where
      staff_record.business_id =
        business_record.id
      and
      staff_record.status =
        'active'::public.nova_staff_status
  )
    as active_staff,

  (
    select count(*)
    from public.sales
      as sale_record
    where sale_record.business_id =
      business_record.id
  )
    as sales,

  (
    select count(*)
    from public.customers
      as customer_record
    where customer_record.business_id =
      business_record.id
  )
    as customers

from public.businesses
  as business_record

order by
  business_record.created_at;


-- ============================================================
-- 2. DUPLICATE SKU
-- Expected: zero rows
-- ============================================================

select
  variant_record.business_id,

  upper(
    btrim(
      variant_record.sku
    )
  )
    as normalized_sku,

  count(*)
    as duplicate_count

from public.product_variants
  as variant_record

group by
  variant_record.business_id,
  upper(
    btrim(
      variant_record.sku
    )
  )

having
  count(*) >
    1;


-- ============================================================
-- 3. DUPLICATE MANUFACTURER BARCODE
-- Empty barcodes ignored.
-- Expected: zero rows
-- ============================================================

select
  variant_record.business_id,

  btrim(
    variant_record.barcode
  )
    as barcode,

  count(*)
    as duplicate_count

from public.product_variants
  as variant_record

where
  nullif(
    btrim(
      coalesce(
        variant_record.barcode,
        ''
      )
    ),
    ''
  ) is not null

group by
  variant_record.business_id,
  btrim(
    variant_record.barcode
  )

having
  count(*) >
    1;


-- ============================================================
-- 4. DEFAULT INVENTORY LOCATION
-- Every business should have exactly one active default.
-- Expected: zero rows
-- ============================================================

select
  business_record.id
    as business_id,

  business_record.name
    as business_name,

  count(
    location_record.id
  ) filter (
    where
      location_record.is_default
      and
      location_record.is_active
  )
    as active_default_locations

from public.businesses
  as business_record

left join public.inventory_locations
  as location_record
  on
    location_record.business_id =
      business_record.id

group by
  business_record.id,
  business_record.name

having
  count(
    location_record.id
  ) filter (
    where
      location_record.is_default
      and
      location_record.is_active
  ) <>
    1;


-- ============================================================
-- 5. INVENTORY LEVEL VS FIFO BATCH QUANTITY
-- This is one of the most important ARC invariants.
-- Expected: zero rows
-- ============================================================

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
  )::bigint
    as fifo_remaining

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
    and
    batch_record.remaining_quantity >
      0

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
    );


-- ============================================================
-- 6. STOCK ON ARCHIVED / INACTIVE CATALOG RECORDS
-- Expected: zero rows before handoff unless intentionally kept.
-- ============================================================

select
  product_record.business_id,

  product_record.name
    as product_name,

  variant_record.name
    as variant_name,

  variant_record.sku,

  product_record.status
    as product_status,

  variant_record.is_active,

  level_record.on_hand

from public.inventory_levels
  as level_record

join public.product_variants
  as variant_record
  on
    variant_record.id =
      level_record.variant_id
    and
    variant_record.business_id =
      level_record.business_id

join public.products
  as product_record
  on
    product_record.id =
      variant_record.product_id
    and
    product_record.business_id =
      variant_record.business_id

where
  level_record.on_hand >
    0
  and
  (
    product_record.status <>
      'active'::public.nova_product_status
    or
    variant_record.is_active is false
  );


-- ============================================================
-- 7. ACTIVE PRODUCT WITHOUT ACTIVE VARIANT
-- Expected: zero rows
-- ============================================================

select
  product_record.business_id,

  product_record.id
    as product_id,

  product_record.name

from public.products
  as product_record

where
  product_record.status =
    'active'::public.nova_product_status

  and not exists (
    select 1
    from public.product_variants
      as variant_record
    where
      variant_record.business_id =
        product_record.business_id
      and
      variant_record.product_id =
        product_record.id
      and
      variant_record.is_active
  );


-- ============================================================
-- 8. INVALID PACK / LOOSE RELATIONSHIP
-- Expected: zero rows
-- ============================================================

select
  child_variant.business_id,

  child_variant.id
    as child_variant_id,

  child_variant.name
    as child_name,

  child_variant.sku
    as child_sku,

  parent_variant.id
    as parent_variant_id,

  parent_variant.name
    as parent_name,

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
    or
    parent_variant.unit_parent_variant_id
      is not null
  );


-- ============================================================
-- 9. SALE PAYMENT TOTAL MISMATCH
-- Original tender amount should equal the saved sale total.
-- Expected: zero rows
-- ============================================================

select
  sale_record.business_id,

  sale_record.id
    as sale_id,

  sale_record.receipt_number,

  sale_record.status,

  sale_record.total
    as sale_total,

  coalesce(
    sum(
      payment_record.amount
    ),
    0
  )
    as payment_total

from public.sales
  as sale_record

left join public.payments
  as payment_record
  on
    payment_record.business_id =
      sale_record.business_id
    and
    payment_record.sale_id =
      sale_record.id

group by
  sale_record.business_id,
  sale_record.id,
  sale_record.receipt_number,
  sale_record.status,
  sale_record.total

having
  sale_record.total <>
    coalesce(
      sum(
        payment_record.amount
      ),
      0
    );


-- ============================================================
-- 10. REFUND HEADER VS ITEM TOTAL
-- Expected: zero rows
-- ============================================================

select
  refund_record.business_id,

  refund_record.id
    as refund_id,

  refund_record.refund_number,

  refund_record.amount
    as refund_total,

  coalesce(
    sum(
      refund_item.line_refund_total
    ),
    0
  )
    as refund_item_total

from public.sale_refunds
  as refund_record

left join public.sale_refund_items
  as refund_item
  on
    refund_item.business_id =
      refund_record.business_id
    and
    refund_item.refund_id =
      refund_record.id

group by
  refund_record.business_id,
  refund_record.id,
  refund_record.refund_number,
  refund_record.amount

having
  refund_record.amount <>
    coalesce(
      sum(
        refund_item.line_refund_total
      ),
      0
    );


-- ============================================================
-- 11. RECEIPT COUNTER BEHIND EXISTING SALES
-- Expected: zero rows
-- ============================================================

select
  counter.business_id,

  counter.next_sequence,

  coalesce(
    max(
      sale_record.receipt_sequence
    ),
    0
  )
    as max_used_sequence

from public.sale_receipt_counters
  as counter

left join public.sales
  as sale_record
  on
    sale_record.business_id =
      counter.business_id

group by
  counter.business_id,
  counter.next_sequence

having
  counter.next_sequence <=
    coalesce(
      max(
        sale_record.receipt_sequence
      ),
      0
    );


-- ============================================================
-- 12. REFUND COUNTER BEHIND EXISTING REFUNDS
-- Expected: zero rows
-- ============================================================

select
  counter.business_id,

  counter.next_sequence,

  coalesce(
    max(
      refund_record.refund_sequence
    ),
    0
  )
    as max_used_sequence

from public.sale_refund_counters
  as counter

left join public.sale_refunds
  as refund_record
  on
    refund_record.business_id =
      counter.business_id

group by
  counter.business_id,
  counter.next_sequence

having
  counter.next_sequence <=
    coalesce(
      max(
        refund_record.refund_sequence
      ),
      0
    );


-- ============================================================
-- 13. MISSING BUSINESS SETTINGS
-- Expected: zero rows
-- ============================================================

select
  business_record.id
    as business_id,

  business_record.name
    as business_name,

  receipt_record.business_id is null
    as missing_receipt_settings,

  loyalty_record.business_id is null
    as missing_loyalty_settings,

  report_record.business_id is null
    as missing_report_settings

from public.businesses
  as business_record

left join public.receipt_settings
  as receipt_record
  on
    receipt_record.business_id =
      business_record.id

left join public.loyalty_settings
  as loyalty_record
  on
    loyalty_record.business_id =
      business_record.id

left join public.report_settings
  as report_record
  on
    report_record.business_id =
      business_record.id

where
  receipt_record.business_id is null
  or
  loyalty_record.business_id is null
  or
  report_record.business_id is null;


-- ============================================================
-- 14. EXPIRED REMOTE SCANNER SESSIONS STILL ACTIVE
-- Expected: zero rows
-- ============================================================

select
  scanner_record.id,

  scanner_record.business_id,

  scanner_record.expires_at,

  scanner_record.status

from public.remote_scanner_sessions
  as scanner_record

where
  scanner_record.status =
    'active'

  and
  scanner_record.expires_at <=
    now();


-- ============================================================
-- 15. FINAL MARKER
-- ============================================================

select
  'ARC pre-handoff integrity audit completed. Review every result set above; all exception sections should be empty.'
    as result;
