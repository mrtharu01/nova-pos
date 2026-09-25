-- ============================================================
-- NOVA POS
-- SaaS Phase 4D — Backup / recovery foundation verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if to_regclass(
    'public.platform_backup_events'
  ) is null
  then

    raise exception
      'platform_backup_events table is missing';

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
        'platform_backup_events'

      and
      relation.relrowsecurity is true

  )
  then

    raise exception
      'platform_backup_events RLS is not enabled';

  end if;


  if
    has_table_privilege(
      'anon',
      'public.platform_backup_events',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_backup_events',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_backup_events',
      'INSERT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_backup_events',
      'UPDATE'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_backup_events',
      'DELETE'
    )
  then

    raise exception
      'Direct application-role access remains on platform_backup_events';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.record_platform_backup_event(text,text,uuid,text,jsonb,timestamptz)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.list_platform_backup_events(integer)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.get_platform_backup_overview()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.export_platform_business_snapshot(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute a backup / recovery RPC';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.record_platform_backup_event(text,text,uuid,text,jsonb,timestamptz)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.list_platform_backup_events(integer)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.get_platform_backup_overview()',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.export_platform_business_snapshot(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role is missing a backup / recovery RPC grant';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA SaaS Phase 4D backup/recovery foundation verified.'
    as result;
