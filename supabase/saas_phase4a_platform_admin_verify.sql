-- ============================================================
-- NOVA POS
-- SaaS Phase 4A — Platform admin verification
-- ============================================================
-- READ-ONLY.
-- ============================================================


do $$
begin

  if not exists (

    select
      1

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
      relation.relname =
        'platform_admins'

      and
      relation.relrowsecurity is true

  )
  then

    raise exception
      'platform_admins is missing or RLS is disabled';

  end if;


  if not exists (

    select
      1

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
      relation.relname =
        'platform_admin_audit_log'

      and
      relation.relrowsecurity is true

  )
  then

    raise exception
      'platform_admin_audit_log is missing or RLS is disabled';

  end if;


  if
    has_table_privilege(
      'anon',
      'public.platform_admins',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_admins',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_admins',
      'INSERT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_admins',
      'UPDATE'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_admins',
      'DELETE'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_admin_audit_log',
      'SELECT'
    )
  then

    raise exception
      'Direct application-role access exists on platform admin tables';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.get_my_platform_admin_access()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.get_platform_admin_overview()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.list_platform_businesses(text,integer)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute a platform admin RPC';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.get_my_platform_admin_access()',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.get_platform_admin_overview()',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.list_platform_businesses(text,integer)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role is missing a platform admin RPC grant';

  end if;


  if
    has_function_privilege(
      'authenticated',
      'private.bootstrap_platform_owner(text)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'private.bootstrap_platform_owner(text)',
      'EXECUTE'
    )
  then

    raise exception
      'Platform owner bootstrap is exposed to an application role';

  end if;

end;

$$;


select
  'PASS'
    as status,

  'NOVA SaaS Phase 4A platform admin foundation verified.'
    as result;
