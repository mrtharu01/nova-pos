-- ============================================================
-- NOVA POS
-- SaaS Phase 4B — Commercial plan catalog verification
-- READ-ONLY
-- ============================================================

do $$

declare

  v_missing text;

  v_lifetime_count integer;

begin

  with expected(code) as (
    values
      ('starter'),
      ('pro'),
      ('business')
  ),

  missing as (
    select
      expected.code

    from expected

    left join public.subscription_plans
      as plan

      on
        plan.code =
          expected.code

    where
      plan.id is null
  )

  select
    string_agg(
      missing.code,
      ', '
      order by
        missing.code
    )

  into
    v_missing

  from missing;


  if
    v_missing is not null
  then

    raise exception
      'Missing NOVA commercial plan(s): %',
      v_missing;

  end if;


  select
    count(*)::integer

  into
    v_lifetime_count

  from public.subscription_plans
    as plan

  where
    plan.code =
      'lifetime_free';


  if
    v_lifetime_count > 0
  then

    raise exception
      'Deprecated lifetime_free plan still exists';

  end if;

end;
$$;


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
        'subscription_plans'

      and
      relation.relrowsecurity is true

  )
  then

    raise exception
      'subscription_plans RLS is not enabled';

  end if;


  if
    has_table_privilege(
      'anon',
      'public.subscription_plans',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.subscription_plans',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.subscription_plans',
      'UPDATE'
    )
  then

    raise exception
      'Direct application-role access remains on subscription_plans';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.list_platform_subscription_plans()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.save_platform_subscription_plan(text,text,text,numeric,numeric,boolean,boolean,jsonb,jsonb)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute a platform plan RPC';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.list_platform_subscription_plans()',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.save_platform_subscription_plan(text,text,text,numeric,numeric,boolean,boolean,jsonb,jsonb)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role is missing a platform plan RPC grant';

  end if;


  if
    has_function_privilege(
      'authenticated',
      'private.can_manage_platform_commercial()',
      'EXECUTE'
    )
  then

    raise exception
      'Private commercial-management helper is exposed';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA SaaS Phase 4B commercial plan catalog verified.'
    as result;
