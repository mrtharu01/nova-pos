-- NOVA POS — Phase 3A verification (read-only)
-- Expected: all rows below should report true / exist.

select
  to_regprocedure('public.bootstrap_business(text,text,text)') is not null as bootstrap_business_exists,
  to_regclass('public.businesses_owner_user_id_unique_idx') is not null as one_owner_index_exists;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'bootstrap_business';

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('businesses', 'staff_members', 'inventory_locations')
order by tablename;
