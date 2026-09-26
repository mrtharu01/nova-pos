-- ============================================================
-- ARC POS
-- PRE-HANDOFF SECURITY AUDIT
-- READ-ONLY
--
-- This complements the earlier phase-specific verification files
-- and includes the current FIFO / pack-loose / supplier-bonus
-- surface.
-- ============================================================


-- ============================================================
-- 1. RLS MUST BE ENABLED ON TENANT DATA TABLES
-- Expected: zero rows
-- ============================================================

with expected_tables(
  schema_name,
  table_name
) as (
  values
    ('public', 'businesses'),
    ('public', 'staff_members'),
    ('public', 'categories'),
    ('public', 'products'),
    ('public', 'product_variants'),
    ('public', 'inventory_locations'),
    ('public', 'inventory_levels'),
    ('public', 'inventory_movements'),
    ('public', 'inventory_price_batches'),
    ('public', 'remote_scanner_sessions'),
    ('public', 'sales'),
    ('public', 'sale_items'),
    ('public', 'payments'),
    ('public', 'sale_refunds'),
    ('public', 'sale_refund_items'),
    ('public', 'sale_voids'),
    ('public', 'customers'),
    ('public', 'loyalty_settings'),
    ('public', 'loyalty_transactions'),
    ('public', 'receipt_settings'),
    ('public', 'report_settings'),
    ('public', 'expenses')
)

select
  expected.schema_name,

  expected.table_name,

  relation.relrowsecurity
    as rls_enabled

from expected_tables
  as expected

left join pg_catalog.pg_namespace
  as namespace
  on
    namespace.nspname =
      expected.schema_name

left join pg_catalog.pg_class
  as relation
  on
    relation.relnamespace =
      namespace.oid
    and
    relation.relname =
      expected.table_name
    and
    relation.relkind =
      'r'

where
  relation.oid is null
  or
  relation.relrowsecurity is false;


-- ============================================================
-- 2. OPTIONAL CURRENT FEATURE TABLES
-- If present, RLS must be enabled.
-- Expected: zero rows
-- ============================================================

select
  namespace.nspname
    as schema_name,

  relation.relname
    as table_name,

  relation.relrowsecurity
    as rls_enabled

from pg_catalog.pg_class
  as relation

join pg_catalog.pg_namespace
  as namespace
  on
    namespace.oid =
      relation.relnamespace

where
  namespace.nspname =
    'public'

  and
  relation.relname in (
    'inventory_unit_breaks',
    'inventory_supplier_bonus_receipts',
    'staff_invitations',
    'platform_business_handoff',
    'platform_backup_events'
  )

  and
  relation.relkind =
    'r'

  and
  relation.relrowsecurity is false;


-- ============================================================
-- 3. ANON MUST NOT WRITE CORE TENANT TABLES
-- Expected: zero rows
-- ============================================================

with protected_tables(
  table_name
) as (
  values
    ('businesses'),
    ('staff_members'),
    ('categories'),
    ('products'),
    ('product_variants'),
    ('inventory_locations'),
    ('inventory_levels'),
    ('inventory_movements'),
    ('inventory_price_batches'),
    ('sales'),
    ('sale_items'),
    ('payments'),
    ('sale_refunds'),
    ('sale_refund_items'),
    ('sale_voids'),
    ('customers'),
    ('loyalty_transactions'),
    ('expenses')
)

select
  protected.table_name,

  privilege.privilege_type

from protected_tables
  as protected

join information_schema.role_table_grants
  as privilege
  on
    privilege.table_schema =
      'public'
    and
    privilege.table_name =
      protected.table_name
    and
    privilege.grantee =
      'anon'

where
  privilege.privilege_type in (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'TRIGGER',
    'REFERENCES'
  );


-- ============================================================
-- 4. PRE-PRODUCTION RESET MUST NEVER BE APP-CALLABLE
-- Expected: all false
-- ============================================================

select
  has_function_privilege(
    'anon',
    'private.arc_preproduction_reset_business(uuid,text,text,boolean,boolean,boolean,boolean)',
    'EXECUTE'
  )
    as anon_can_reset,

  has_function_privilege(
    'authenticated',
    'private.arc_preproduction_reset_business(uuid,text,text,boolean,boolean,boolean,boolean)',
    'EXECUTE'
  )
    as authenticated_can_reset,

  has_function_privilege(
    'anon',
    'private.arc_preproduction_reset_snapshot(uuid)',
    'EXECUTE'
  )
    as anon_can_read_reset_snapshot,

  has_function_privilege(
    'authenticated',
    'private.arc_preproduction_reset_snapshot(uuid)',
    'EXECUTE'
  )
    as authenticated_can_read_reset_snapshot;


-- ============================================================
-- 5. SECURITY DEFINER FUNCTIONS SHOULD HAVE A FIXED SEARCH PATH
-- ARC security-definer functions in public/private only.
-- Expected: zero rows
-- ============================================================

select
  namespace.nspname
    as schema_name,

  procedure.proname
    as function_name,

  pg_get_function_identity_arguments(
    procedure.oid
  )
    as arguments,

  procedure.proconfig

from pg_catalog.pg_proc
  as procedure

join pg_catalog.pg_namespace
  as namespace
  on
    namespace.oid =
      procedure.pronamespace

where
  namespace.nspname in (
    'public',
    'private'
  )

  and
  procedure.prosecdef is true

  and not (
    coalesce(
      procedure.proconfig,
      array[]::text[]
    )
    @>
    array[
      'search_path=""'
    ]::text[]
  );


-- ============================================================
-- 6. SUPPLIER BONUS AUDIT TABLE — NO DIRECT WRITE ACCESS
-- Only runs when Phase 8B has been installed.
-- Expected: zero rows
-- ============================================================

select
  privilege.grantee,

  privilege.privilege_type

from information_schema.role_table_grants
  as privilege

where
  privilege.table_schema =
    'public'

  and
  privilege.table_name =
    'inventory_supplier_bonus_receipts'

  and
  privilege.grantee in (
    'anon',
    'authenticated'
  )

  and
  privilege.privilege_type in (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE'
  );


-- ============================================================
-- 7. FINAL MARKER
-- ============================================================

select
  'ARC pre-handoff security audit completed. Every exception query above should return zero rows / false flags.'
    as result;
