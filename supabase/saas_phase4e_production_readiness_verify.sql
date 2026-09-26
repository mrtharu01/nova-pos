-- ============================================================
-- NOVA POS
-- SaaS Phase 4E — Production readiness verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if to_regclass(
    'public.platform_business_handoff'
  ) is null
  then

    raise exception
      'platform_business_handoff table is missing';

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
        'platform_business_handoff'

      and
      relation.relrowsecurity is true

  )
  then

    raise exception
      'platform_business_handoff RLS is not enabled';

  end if;


  if
    has_table_privilege(
      'authenticated',
      'public.platform_business_handoff',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_business_handoff',
      'INSERT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_business_handoff',
      'UPDATE'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.platform_business_handoff',
      'DELETE'
    )

    or
    has_table_privilege(
      'anon',
      'public.platform_business_handoff',
      'SELECT'
    )
  then

    raise exception
      'Direct application-role access remains on platform_business_handoff';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.get_platform_business_production_readiness(uuid)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.save_platform_business_handoff_checklist(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.set_platform_business_handoff_approval(uuid,boolean)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute a production-readiness RPC';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.get_platform_business_production_readiness(uuid)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.save_platform_business_handoff_checklist(uuid,boolean,boolean,boolean,boolean,boolean,boolean,text)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.set_platform_business_handoff_approval(uuid,boolean)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role is missing a production-readiness RPC grant';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA SaaS Phase 4E production-readiness foundation verified.'
    as result;
