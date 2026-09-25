-- ============================================================
-- NOVA POS
-- SaaS Phase 4C — Tenant subscriptions verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if to_regclass(
    'public.business_subscriptions'
  ) is null
  then

    raise exception
      'business_subscriptions table is missing';

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
        'business_subscriptions'

      and
      relation.relrowsecurity is true

  )
  then

    raise exception
      'business_subscriptions RLS is not enabled';

  end if;


  if
    has_table_privilege(
      'anon',
      'public.business_subscriptions',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.business_subscriptions',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.business_subscriptions',
      'INSERT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.business_subscriptions',
      'UPDATE'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.business_subscriptions',
      'DELETE'
    )
  then

    raise exception
      'Direct app-role access remains on business_subscriptions';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.list_platform_business_subscriptions(text,integer)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.save_platform_business_subscription(uuid,text,text,text,text,date,boolean)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.get_my_subscription()',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute a subscription RPC';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.list_platform_business_subscriptions(text,integer)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.save_platform_business_subscription(uuid,text,text,text,text,date,boolean)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.get_my_subscription()',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role is missing a subscription RPC grant';

  end if;

end;
$$;


do $$

declare

  v_invalid integer;

begin

  select
    count(*)::integer

  into
    v_invalid

  from public.business_subscriptions
    as subscription

  where
    (
      subscription.complimentary_mode =
        'none'::public.nova_complimentary_mode

      and
      subscription.complimentary_until is not null
    )

    or

    (
      subscription.complimentary_mode =
        'until_date'::public.nova_complimentary_mode

      and
      subscription.complimentary_until is null
    )

    or

    (
      subscription.complimentary_mode =
        'lifetime'::public.nova_complimentary_mode

      and
      subscription.complimentary_until is not null
    );


  if
    v_invalid > 0
  then

    raise exception
      'Invalid complimentary subscription rows found: %',
      v_invalid;

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA SaaS Phase 4C tenant subscriptions verified.'
    as result;
