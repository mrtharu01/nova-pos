-- ============================================================
-- NOVA POS
-- SaaS Phase 3A — Tenant foundation verification
-- ============================================================
--
-- Run AFTER:
--   saas_phase3a_tenant_identity.sql
--
-- This is intentionally read-only.
-- It fails if a known tenant-owned table loses business_id,
-- NOT NULL tenant ownership, or RLS.
-- ============================================================

do $$

declare
  v_missing text;

begin

  -- ----------------------------------------------------------
  -- 1. Tenant-owned tables must have a NOT NULL business_id.
  -- ----------------------------------------------------------

  with required_tables(table_name) as (

    values
      ('staff_members'),
      ('categories'),
      ('products'),
      ('product_variants'),
      ('inventory_locations'),
      ('inventory_levels'),
      ('inventory_movements'),
      ('remote_scanner_sessions'),
      ('sale_receipt_counters'),
      ('sales'),
      ('sale_items'),
      ('payments'),
      ('receipt_settings'),
      ('sale_refund_counters'),
      ('sale_refunds'),
      ('sale_refund_items'),
      ('sale_voids'),
      ('customers'),
      ('loyalty_settings'),
      ('loyalty_transactions'),
      ('report_settings'),
      ('expenses'),
      ('staff_invitations')

  ),

  invalid as (

    select
      required.table_name

    from required_tables
      as required

    left join information_schema.columns
      as column_record

      on
        column_record.table_schema =
          'public'

        and
        column_record.table_name =
          required.table_name

        and
        column_record.column_name =
          'business_id'

    where
      column_record.column_name
        is null

      or
      column_record.is_nullable <>
        'NO'

  )

  select
    string_agg(
      invalid.table_name,
      ', '
      order by invalid.table_name
    )

  into
    v_missing

  from invalid;


  if
    v_missing is not null
  then

    raise exception
      'Tenant ownership check failed. Missing/non-NOT-NULL business_id: %',
      v_missing;

  end if;


  -- ----------------------------------------------------------
  -- 2. Every known tenant table must have RLS enabled.
  -- ----------------------------------------------------------

  with required_tables(table_name) as (

    values
      ('businesses'),
      ('staff_members'),
      ('categories'),
      ('products'),
      ('product_variants'),
      ('inventory_locations'),
      ('inventory_levels'),
      ('inventory_movements'),
      ('remote_scanner_sessions'),
      ('sale_receipt_counters'),
      ('sales'),
      ('sale_items'),
      ('payments'),
      ('receipt_settings'),
      ('sale_refund_counters'),
      ('sale_refunds'),
      ('sale_refund_items'),
      ('sale_voids'),
      ('customers'),
      ('loyalty_settings'),
      ('loyalty_transactions'),
      ('report_settings'),
      ('expenses'),
      ('staff_invitations')

  ),

  invalid as (

    select
      required.table_name

    from required_tables
      as required

    left join pg_catalog.pg_class
      as relation

      on
        relation.relname =
          required.table_name

    left join pg_catalog.pg_namespace
      as namespace

      on
        namespace.oid =
          relation.relnamespace

        and
        namespace.nspname =
          'public'

    where
      relation.oid
        is null

      or
      namespace.oid
        is null

      or
      relation.relrowsecurity
        is not true

  )

  select
    string_agg(
      invalid.table_name,
      ', '
      order by invalid.table_name
    )

  into
    v_missing

  from invalid;


  if
    v_missing is not null
  then

    raise exception
      'Tenant RLS check failed: %',
      v_missing;

  end if;


  -- ----------------------------------------------------------
  -- 3. The browser-facing resolver must be authenticated-only.
  -- ----------------------------------------------------------

  if
    has_function_privilege(
      'anon',
      'public.get_my_current_business()',
      'EXECUTE'
    )
  then

    raise exception
      'anon must not execute get_my_current_business()';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.get_my_current_business()',
      'EXECUTE'
    )
  then

    raise exception
      'authenticated must be able to execute get_my_current_business()';

  end if;


  raise notice
    'NOVA SaaS Phase 3A tenant identity verification passed.';

end;

$$;


-- Useful human-readable audit output.

select
  table_record.tablename,
  table_record.rowsecurity

from pg_catalog.pg_tables
  as table_record

where
  table_record.schemaname =
    'public'

  and
  table_record.tablename in (
    'businesses',
    'staff_members',
    'categories',
    'products',
    'product_variants',
    'inventory_locations',
    'inventory_levels',
    'inventory_movements',
    'remote_scanner_sessions',
    'sale_receipt_counters',
    'sales',
    'sale_items',
    'payments',
    'receipt_settings',
    'sale_refund_counters',
    'sale_refunds',
    'sale_refund_items',
    'sale_voids',
    'customers',
    'loyalty_settings',
    'loyalty_transactions',
    'report_settings',
    'expenses',
    'staff_invitations'
  )

order by
  table_record.tablename;
