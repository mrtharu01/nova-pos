-- ============================================================
-- NOVA POS
-- SaaS Phase 4C — Tenant subscriptions + complimentary access
-- ============================================================
--
-- Commercial plans remain:
--   Starter / Pro / Business
--
-- Complimentary access is a per-business billing override.
-- It is NOT a plan.
--
-- This phase also reserves payment-provider identifiers for the
-- future commercial payment gateway without coupling NOVA to a
-- provider yet.
-- ============================================================


-- ============================================================
-- 1. TYPES
-- ============================================================

do $$
begin
  create type
    public.nova_subscription_status
  as enum (
    'incomplete',
    'trialing',
    'active',
    'past_due',
    'paused',
    'cancelled',
    'expired'
  );
exception
  when duplicate_object
  then null;
end;
$$;


do $$
begin
  create type
    public.nova_subscription_billing_interval
  as enum (
    'monthly',
    'yearly'
  );
exception
  when duplicate_object
  then null;
end;
$$;


do $$
begin
  create type
    public.nova_complimentary_mode
  as enum (
    'none',
    'until_date',
    'lifetime'
  );
exception
  when duplicate_object
  then null;
end;
$$;



-- ============================================================
-- 2. BUSINESS SUBSCRIPTIONS
-- ============================================================

create table if not exists
public.business_subscriptions (

  id uuid
    primary key
    default gen_random_uuid(),

  business_id uuid
    not null
    unique
    references public.businesses(id)
    on delete cascade,

  plan_id uuid
    not null
    references public.subscription_plans(id)
    on delete restrict,

  status public.nova_subscription_status
    not null
    default 'active',

  billing_interval public.nova_subscription_billing_interval
    not null
    default 'monthly',

  complimentary_mode public.nova_complimentary_mode
    not null
    default 'none',

  complimentary_until date,

  cancel_at_period_end boolean
    not null
    default false,

  current_period_start timestamptz,

  current_period_end timestamptz,

  provider text,

  provider_customer_id text,

  provider_subscription_id text,

  entitlement_overrides jsonb
    not null
    default '{}'::jsonb,

  usage_limit_overrides jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
    business_subscriptions_period_order
    check (
      current_period_start is null
      or
      current_period_end is null
      or
      current_period_end >
        current_period_start
    ),

  constraint
    business_subscriptions_complimentary_shape
    check (
      (
        complimentary_mode =
          'none'::public.nova_complimentary_mode

        and
        complimentary_until is null
      )

      or

      (
        complimentary_mode =
          'until_date'::public.nova_complimentary_mode

        and
        complimentary_until is not null
      )

      or

      (
        complimentary_mode =
          'lifetime'::public.nova_complimentary_mode

        and
        complimentary_until is null
      )
    ),

  constraint
    business_subscriptions_provider_shape
    check (
      provider is not null
      or
      (
        provider_customer_id is null
        and
        provider_subscription_id is null
      )
    ),

  constraint
    business_subscriptions_entitlement_overrides_object
    check (
      jsonb_typeof(
        entitlement_overrides
      ) =
        'object'
    ),

  constraint
    business_subscriptions_usage_limit_overrides_object
    check (
      jsonb_typeof(
        usage_limit_overrides
      ) =
        'object'
    )

);


create unique index if not exists
business_subscriptions_provider_customer_unique_idx

on public.business_subscriptions (
  provider,
  provider_customer_id
)

where
  provider is not null
  and
  provider_customer_id is not null;


create unique index if not exists
business_subscriptions_provider_subscription_unique_idx

on public.business_subscriptions (
  provider,
  provider_subscription_id
)

where
  provider is not null
  and
  provider_subscription_id is not null;


create index if not exists
business_subscriptions_plan_status_idx

on public.business_subscriptions (
  plan_id,
  status
);



-- ============================================================
-- 3. UPDATED_AT
-- ============================================================

drop trigger if exists
business_subscriptions_set_updated_at

on public.business_subscriptions;


create trigger
business_subscriptions_set_updated_at

before update

on public.business_subscriptions

for each row

execute function
public.set_updated_at();



-- ============================================================
-- 4. DIRECT DATA API LOCKDOWN
-- ============================================================

alter table
public.business_subscriptions
enable row level security;


revoke all
on public.business_subscriptions
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 5. LIST TENANT SUBSCRIPTIONS FOR NOVA CONTROL
-- ============================================================

create or replace function
public.list_platform_business_subscriptions(
  p_search text
    default '',

  p_limit integer
    default 250
)

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_search text :=
    lower(
      btrim(
        coalesce(
          p_search,
          ''
        )
      )
    );

  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(
          p_limit,
          250
        ),
        500
      )
    );

  v_result jsonb :=
    '[]'::jsonb;

begin

  if not (
    select private.is_platform_admin()
  )
  then

    raise exception
      'Platform administrator access required'
      using errcode =
        '42501';

  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'businessId',
          row_data.business_id,

          'businessName',
          row_data.business_name,

          'ownerEmail',
          row_data.owner_email,

          'subscriptionId',
          row_data.subscription_id,

          'planCode',
          row_data.plan_code,

          'planName',
          row_data.plan_name,

          'status',
          row_data.status,

          'billingInterval',
          row_data.billing_interval,

          'complimentaryMode',
          row_data.complimentary_mode,

          'complimentaryUntil',
          row_data.complimentary_until,

          'complimentaryActive',
          row_data.complimentary_active,

          'cancelAtPeriodEnd',
          row_data.cancel_at_period_end,

          'currentPeriodStart',
          row_data.current_period_start,

          'currentPeriodEnd',
          row_data.current_period_end,

          'provider',
          row_data.provider,

          'updatedAt',
          row_data.updated_at
        )

        order by
          row_data.business_name,
          row_data.owner_email
      ),
      '[]'::jsonb
    )

  into
    v_result

  from (

    select
      business.id
        as business_id,

      business.name
        as business_name,

      auth_user.email::text
        as owner_email,

      subscription.id
        as subscription_id,

      plan.code
        as plan_code,

      plan.name
        as plan_name,

      subscription.status::text
        as status,

      subscription.billing_interval::text
        as billing_interval,

      subscription.complimentary_mode::text
        as complimentary_mode,

      subscription.complimentary_until,

      (
        subscription.complimentary_mode =
          'lifetime'::public.nova_complimentary_mode

        or

        (
          subscription.complimentary_mode =
            'until_date'::public.nova_complimentary_mode

          and

          subscription.complimentary_until >=
            current_date
        )
      )
        as complimentary_active,

      subscription.cancel_at_period_end,

      subscription.current_period_start,

      subscription.current_period_end,

      subscription.provider,

      subscription.updated_at

    from public.businesses
      as business

    join auth.users
      as auth_user

      on
        auth_user.id =
          business.owner_user_id

    left join public.business_subscriptions
      as subscription

      on
        subscription.business_id =
          business.id

    left join public.subscription_plans
      as plan

      on
        plan.id =
          subscription.plan_id

    where
      v_search = ''

      or

      lower(
        business.name
      ) like
        '%' ||
        v_search ||
        '%'

      or

      lower(
        coalesce(
          auth_user.email,
          ''
        )
      ) like
        '%' ||
        v_search ||
        '%'

    order by
      business.name,
      auth_user.email

    limit
      v_limit

  )
    as row_data;


  return
    v_result;

end;

$$;


revoke all
on function
public.list_platform_business_subscriptions(
  text,
  integer
)
from
  public,
  anon;


grant execute
on function
public.list_platform_business_subscriptions(
  text,
  integer
)
to authenticated;



-- ============================================================
-- 6. SAVE / ASSIGN TENANT SUBSCRIPTION
--
-- Platform Owner + Admin may mutate.
-- Support remains read-only.
-- ============================================================

create or replace function
public.save_platform_business_subscription(
  p_business_id uuid,
  p_plan_code text,
  p_status text,
  p_billing_interval text,
  p_complimentary_mode text,
  p_complimentary_until date,
  p_cancel_at_period_end boolean
)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_actor_user_id uuid :=
    (
      select auth.uid()
    );

  v_plan_code text :=
    lower(
      btrim(
        coalesce(
          p_plan_code,
          ''
        )
      )
    );

  v_status public.nova_subscription_status;

  v_billing_interval
    public.nova_subscription_billing_interval;

  v_complimentary_mode
    public.nova_complimentary_mode;

  v_plan_id uuid;

  v_subscription_id uuid;

begin

  if not (
    select private.can_manage_platform_commercial()
  )
  then

    raise exception
      'Platform commercial-management access required'
      using errcode =
        '42501';

  end if;


  if
    p_business_id is null

    or not exists (

      select
        1

      from public.businesses
        as business

      where
        business.id =
          p_business_id

    )
  then

    raise exception
      'NOVA business was not found';

  end if;


  if
    v_plan_code not in (
      'starter',
      'pro',
      'business'
    )
  then

    raise exception
      'Unknown NOVA commercial plan';

  end if;


  select
    plan.id

  into
    v_plan_id

  from public.subscription_plans
    as plan

  where
    plan.code =
      v_plan_code

    and
    plan.is_active is true;


  if
    v_plan_id is null
  then

    raise exception
      'The selected NOVA plan is not active';

  end if;


  begin

    v_status :=
      lower(
        btrim(
          coalesce(
            p_status,
            ''
          )
        )
      )::public.nova_subscription_status;

  exception
    when invalid_text_representation
    then
      raise exception
        'Invalid subscription status';
  end;


  begin

    v_billing_interval :=
      lower(
        btrim(
          coalesce(
            p_billing_interval,
            ''
          )
        )
      )::public.nova_subscription_billing_interval;

  exception
    when invalid_text_representation
    then
      raise exception
        'Invalid billing interval';
  end;


  begin

    v_complimentary_mode :=
      lower(
        btrim(
          coalesce(
            p_complimentary_mode,
            ''
          )
        )
      )::public.nova_complimentary_mode;

  exception
    when invalid_text_representation
    then
      raise exception
        'Invalid complimentary access mode';
  end;


  if
    v_complimentary_mode =
      'until_date'::public.nova_complimentary_mode

    and
    p_complimentary_until is null
  then

    raise exception
      'Complimentary-until date is required';

  end if;


  if
    v_complimentary_mode <>
      'until_date'::public.nova_complimentary_mode

    and
    p_complimentary_until is not null
  then

    raise exception
      'Complimentary-until date is only valid for until-date complimentary access';

  end if;


  insert into public.business_subscriptions (
    business_id,
    plan_id,
    status,
    billing_interval,
    complimentary_mode,
    complimentary_until,
    cancel_at_period_end
  )

  values (
    p_business_id,
    v_plan_id,
    v_status,
    v_billing_interval,
    v_complimentary_mode,
    p_complimentary_until,
    coalesce(
      p_cancel_at_period_end,
      false
    )
  )

  on conflict (
    business_id
  )

  do update

  set
    plan_id =
      excluded.plan_id,

    status =
      excluded.status,

    billing_interval =
      excluded.billing_interval,

    complimentary_mode =
      excluded.complimentary_mode,

    complimentary_until =
      excluded.complimentary_until,

    cancel_at_period_end =
      excluded.cancel_at_period_end

  returning
    id

  into
    v_subscription_id;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    target_business_id,
    metadata
  )

  values (
    v_actor_user_id,
    'business_subscription_saved',
    p_business_id,
    jsonb_build_object(
      'subscriptionId',
      v_subscription_id,
      'planCode',
      v_plan_code,
      'status',
      v_status::text,
      'billingInterval',
      v_billing_interval::text,
      'complimentaryMode',
      v_complimentary_mode::text,
      'complimentaryUntil',
      p_complimentary_until,
      'cancelAtPeriodEnd',
      coalesce(
        p_cancel_at_period_end,
        false
      )
    )
  );


  return
    jsonb_build_object(
      'ok',
      true,
      'subscriptionId',
      v_subscription_id,
      'businessId',
      p_business_id
    );

end;

$$;


revoke all
on function
public.save_platform_business_subscription(
  uuid,
  text,
  text,
  text,
  text,
  date,
  boolean
)
from
  public,
  anon;


grant execute
on function
public.save_platform_business_subscription(
  uuid,
  text,
  text,
  text,
  text,
  date,
  boolean
)
to authenticated;



-- ============================================================
-- 7. CURRENT BUSINESS SUBSCRIPTION
--
-- This is the tenant-facing read boundary the POS can use later
-- for feature / limit enforcement. Direct subscription-table
-- access remains unavailable.
-- ============================================================

create or replace function
public.get_my_subscription()

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_business_id uuid;

  v_result jsonb;

begin

  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null
  then

    return
      jsonb_build_object(
        'configured',
        false
      );

  end if;


  select
    jsonb_build_object(
      'configured',
      true,

      'businessId',
      subscription.business_id,

      'subscriptionId',
      subscription.id,

      'status',
      subscription.status::text,

      'billingInterval',
      subscription.billing_interval::text,

      'complimentaryMode',
      subscription.complimentary_mode::text,

      'complimentaryUntil',
      subscription.complimentary_until,

      'complimentaryActive',
      (
        subscription.complimentary_mode =
          'lifetime'::public.nova_complimentary_mode

        or

        (
          subscription.complimentary_mode =
            'until_date'::public.nova_complimentary_mode

          and

          subscription.complimentary_until >=
            current_date
        )
      ),

      'cancelAtPeriodEnd',
      subscription.cancel_at_period_end,

      'currentPeriodStart',
      subscription.current_period_start,

      'currentPeriodEnd',
      subscription.current_period_end,

      'plan',
      jsonb_build_object(
        'id',
        plan.id,

        'code',
        plan.code,

        'name',
        plan.name,

        'isPublic',
        plan.is_public,

        'isActive',
        plan.is_active
      ),

      'entitlements',
      (
        plan.entitlements
        ||
        subscription.entitlement_overrides
      ),

      'usageLimits',
      (
        plan.usage_limits
        ||
        subscription.usage_limit_overrides
      )
    )

  into
    v_result

  from public.business_subscriptions
    as subscription

  join public.subscription_plans
    as plan

    on
      plan.id =
        subscription.plan_id

  where
    subscription.business_id =
      v_business_id;


  return
    coalesce(
      v_result,
      jsonb_build_object(
        'configured',
        false,
        'businessId',
        v_business_id
      )
    );

end;

$$;


revoke all
on function
public.get_my_subscription()
from
  public,
  anon;


grant execute
on function
public.get_my_subscription()
to authenticated;


notify pgrst,
'reload schema';
