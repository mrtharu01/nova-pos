-- ============================================================
-- NOVA POS
-- SaaS Phase 4A — Plans + subscription verification
-- ============================================================
--
-- READ-ONLY.
-- ============================================================


do $$

declare

  v_missing text;

begin

  with expected(code) as (

    values
      ('starter'),
      ('pro'),
      ('business'),
      ('lifetime_free')

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
      order by missing.code
    )

  into
    v_missing

  from missing;


  if
    v_missing is not null
  then

    raise exception
      'Missing NOVA subscription plans: %',
      v_missing;

  end if;

end;

$$;



do $$

declare

  v_invalid_count integer;

begin

  select
    count(*)::integer

  into
    v_invalid_count

  from public.subscription_plans
    as plan

  where
    plan.code =
      'lifetime_free'

    and
    (
      plan.is_internal is not true
      or
      plan.is_public is not false
      or
      plan.monthly_price_lkr is distinct from 0
      or
      plan.yearly_price_lkr is distinct from 0
    );


  if
    v_invalid_count > 0
  then

    raise exception
      'Lifetime Free plan configuration is invalid';

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
      'Direct app-role access remains on subscription tables';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.get_my_subscription()',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous users can execute get_my_subscription()';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.get_my_subscription()',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated users cannot execute get_my_subscription()';

  end if;

end;

$$;



do $$

declare

  v_invalid_count integer;

begin

  select
    count(*)::integer

  into
    v_invalid_count

  from public.business_subscriptions
    as subscription

  join public.subscription_plans
    as plan

    on
      plan.id =
        subscription.plan_id

  where
    (
      plan.code =
        'lifetime_free'

      and

      (
        subscription.status <>
          'active'::public.nova_subscription_status

        or
        subscription.billing_interval <>
          'lifetime'::public.nova_billing_interval

        or
        subscription.current_period_start is not null

        or
        subscription.current_period_end is not null

        or
        subscription.provider is not null

        or
        subscription.provider_customer_id is not null

        or
        subscription.provider_subscription_id is not null

        or
        subscription.cancel_at_period_end is true
      )
    )

    or

    (
      plan.code <>
        'lifetime_free'

      and

      subscription.billing_interval =
        'lifetime'::public.nova_billing_interval
    );


  if
    v_invalid_count > 0
  then

    raise exception
      'Invalid subscription rows found: %',
      v_invalid_count;

  end if;

end;

$$;



do $$
begin

  raise notice
    'NOVA SaaS Phase 4A plans/subscription foundation verified.';

end;
$$;


select
  plan.code,
  plan.name,
  plan.is_public,
  plan.is_internal,
  plan.monthly_price_lkr,
  plan.yearly_price_lkr

from public.subscription_plans
  as plan

order by
  plan.sort_order,
  plan.code;
