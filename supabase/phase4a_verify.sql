-- ============================================================
-- NOVA POS
-- PHASE 4A VERIFY
-- ============================================================


-- ============================================================
-- OBJECTS
-- ============================================================

select

  to_regclass(
    'public.sales'
  ) is not null
    as sales_exists,

  to_regclass(
    'public.sale_items'
  ) is not null
    as sale_items_exists,

  to_regclass(
    'public.payments'
  ) is not null
    as payments_exists,

  to_regclass(
    'public.sale_receipt_counters'
  ) is not null
    as receipt_counter_exists,

  to_regclass(
    'public.sales_list'
  ) is not null
    as sales_list_exists;


-- ============================================================
-- RLS
-- ============================================================

select

  relname
    as table_name,

  relrowsecurity
    as rls_enabled

from pg_class

where
  relname in (
    'sales',
    'sale_items',
    'payments',
    'sale_receipt_counters'
  )

order by
  relname;


-- ============================================================
-- SALES PRIVILEGES
--
-- Expected:
--
-- SELECT = true
-- INSERT = false
-- UPDATE = false
-- DELETE = false
-- ============================================================

select

  has_table_privilege(
    'authenticated',
    'public.sales',
    'SELECT'
  ) as sales_select,

  has_table_privilege(
    'authenticated',
    'public.sales',
    'INSERT'
  ) as sales_insert,

  has_table_privilege(
    'authenticated',
    'public.sales',
    'UPDATE'
  ) as sales_update,

  has_table_privilege(
    'authenticated',
    'public.sales',
    'DELETE'
  ) as sales_delete;


-- ============================================================
-- SALE ITEMS PRIVILEGES
-- ============================================================

select

  has_table_privilege(
    'authenticated',
    'public.sale_items',
    'SELECT'
  ) as items_select,

  has_table_privilege(
    'authenticated',
    'public.sale_items',
    'INSERT'
  ) as items_insert,

  has_table_privilege(
    'authenticated',
    'public.sale_items',
    'UPDATE'
  ) as items_update,

  has_table_privilege(
    'authenticated',
    'public.sale_items',
    'DELETE'
  ) as items_delete;


-- ============================================================
-- PAYMENTS PRIVILEGES
-- ============================================================

select

  has_table_privilege(
    'authenticated',
    'public.payments',
    'SELECT'
  ) as payments_select,

  has_table_privilege(
    'authenticated',
    'public.payments',
    'INSERT'
  ) as payments_insert,

  has_table_privilege(
    'authenticated',
    'public.payments',
    'UPDATE'
  ) as payments_update,

  has_table_privilege(
    'authenticated',
    'public.payments',
    'DELETE'
  ) as payments_delete;


-- ============================================================
-- RECEIPT COUNTERS
-- ============================================================

select

  b.name
    as business,

  c.prefix,

  c.next_sequence

from public.businesses b

left join
public.sale_receipt_counters c

on
  c.business_id =
  b.id;


-- ============================================================
-- INTERNAL RECEIPT FUNCTION
--
-- DO NOT CALL IT.
-- Calling it would consume a receipt number.
-- ============================================================

select

  to_regprocedure(
    'private.next_receipt_identity(uuid)'
  ) is not null

    as receipt_generator_exists;


-- ============================================================
-- SALES VIEW
--
-- Should currently return zero rows.
-- ============================================================

select *

from public.sales_list

order by
  created_at desc;