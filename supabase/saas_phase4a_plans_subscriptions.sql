-- ============================================================
-- NOVA POS
-- SaaS Phase 4A — Plans + subscription foundation
-- ============================================================
--
-- No payment gateway is connected in this phase.
--
-- This establishes:
--   • Starter / Pro / Business / Lifetime Free plans
--   • one subscription record per business
--   • monthly / yearly / lifetime billing intervals
--   • lifecycle status + billing period fields
--   • provider identifiers for future Phase 8 billing
--   • feature entitlements + usage limits
--   • per-business entitlement / limit overrides
--
-- App users receive subscription data only through
-- get_my_subscription(). Direct writes remain unavailable.
-- ============================================================


-- ============================================================
-- 1. TYPES
-- ============================================================

do $$
begin
  create type
    public.nova_billing_interval
  as enum (
    'monthly',
    'yearly',
    'lifetime'
  );
exception
  when duplicate_object
  then null;
end;
$$;


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



-- ============================================================
-- 2. PLAN CATALOG
-- ============================================================

create table if not exists
public.subscription_plans (

  id uuid
    primary key
    default gen_random_uuid(),

  code text
    not null
    unique,

  name text
    not null,

  description text
    not null
    default '',

  is_public boolean
    not null
    default false,

  is_internal boolean
    not null
    default false,

  is_active boolean
    not null
    default true,

  monthly_price_lkr numeric(12,2),

  yearly_price_lkr numeric(12,2),

  entitlements jsonb
    not null
    default '{}'::jsonb,

  usage_limits jsonb
    not null
    default '{}'::jsonb,

  sort_order integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint
    subscription_plans_code_not_blank
    check (
      btrim(
        code
      ) <> ''
    ),

  constraint
    subscription_plans_name_not_blank
    check (
      btrim(
        name
      ) <> ''
    ),

  constraint
    subscription_plans_monthly_price_nonnegative
    check (
      monthly_price_lkr is null
      or
      monthly_price_lkr >= 0
    ),

  constraint
    subscription_plans_yearly_price_nonnegative
    check (
      yearly_price_lkr is null
      or
      yearly_price_lkr >= 0
    ),

  constraint
    subscription_plans_entitlements_object
    check (
      jsonb_typeof(
        entitlements
      ) =
        'object'
    ),

  constraint
    subscription_plans_usage_limits_object
    check (
      jsonb_typeof(
        usage_limits
      ) =
        'object'
    )

);



-- ============================================================
-- 3. SEEDED PLANS
--
-- Commercial pricing / limits are intentionally not invented
-- here. Phase 8 can fill them once pricing is finalized.
-- ============================================================

insert into public.subscription_plans (

  code,

  name,

  description,

  is_public,

  is_internal,

  is_active,

  monthly_price_lkr,

  yearly_price_lkr,

  entitlements,

  usage_limits,

  sort_order

)

values

  (
    'starter',
    'Starter',
    'NOVA Starter plan.',
    true,
    false,
    true,
    null,
    null,
    '{}'::jsonb,
    '{}'::jsonb,
    10
  ),

  (
    'pro',
    'Pro',
    'NOVA Pro plan.',
    true,
    false,
    true,
    null,
    null,
    '{}'::jsonb,
    '{}'::jsonb,
    20
  ),

  (
    'business',
    'Business',
    'NOVA Business plan.',
    true,
    false,
    true,
    null,
    null,
    '{}'::jsonb,
    '{}'::jsonb,
    30
  ),

  (
    'lifetime_free',
    'Lifetime Free',
    'Internal lifetime subscription with no recurring billing.',
    false,
    true,
    true,
    0,
    0,
    '{}'::jsonb,
    '{}'::jsonb,
    100
  )

on conflict (
  code
)

do update

set

  name =
    excluded.name,

  description =
    excluded.description,

  is_public =
    excluded.is_public,

  is_internal =
    excluded.is_internal,

  is_active =
    excluded.is_active,

  sort_order =
    excluded.sort_order,

  updated_at =
    now();



-- ============================================================
-- 4. BUSINESS SUBSCRIPTIONS
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
    default 'incomplete',

  billing_interval public.nova_billing_interval
    not null
    default 'monthly',

  current_period_start timestamptz,

  current_period_end timestamptz,

  cancel_at_period_end boolean
    not null
    default false,

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
    business_subscriptions_provider_not_blank
    check (
      provider is null
      or
      btrim(
        provider
      ) <> ''
    ),

  constraint
    business_subscriptions_provider_customer_not_blank
    check (
      provider_customer_id is null
      or
      btrim(
        provider_customer_id
      ) <> ''
    ),

  constraint
    business_subscriptions_provider_subscription_not_blank
    check (
      provider_subscription_id is null
      or
      btrim(
        provider_subscription_id
      ) <> ''
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
-- 5. UPDATED_AT
-- ============================================================

drop trigger if exists
subscription_plans_set_updated_at

on public.subscription_plans;


create trigger
subscription_plans_set_updated_at

before update

on public.subscription_plans

for each row

execute function
public.set_updated_at();



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
-- 6. SUBSCRIPTION INVARIANTS
-- ============================================================

create or replace function
private.validate_business_subscription()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_plan_code text;

begin

  select
    plan.code

  into
    v_plan_code

  from public.subscription_plans
    as plan

  where
    plan.id =
      new.plan_id;


  if
    v_plan_code is null
  then

    raise exception
      'Subscription plan was not found';

  end if;


  if
    new.provider is null

    and

    (
      new.provider_customer_id is not null
      or
      new.provider_subscription_id is not null
    )
  then

    raise exception
      'Provider identifiers require a provider';

  end if;


  if
    v_plan_code =
      'lifetime_free'
  then

    if
      new.billing_interval <>
        'lifetime'::public.nova_billing_interval
    then

      raise exception
        'Lifetime Free must use lifetime billing';

    end if;


    if
      new.status <>
        'active'::public.nova_subscription_status
    then

      raise exception
        'Lifetime Free must remain active';

    end if;


    if
      new.current_period_start is not null
      or
      new.current_period_end is not null
      or
      new.provider is not null
      or
      new.provider_customer_id is not null
      or
      new.provider_subscription_id is not null
      or
      new.cancel_at_period_end is true
    then

      raise exception
        'Lifetime Free cannot have billing periods, cancellation scheduling or provider identifiers';

    end if;

  else

    if
      new.billing_interval =
        'lifetime'::public.nova_billing_interval
    then

      raise exception
        'Commercial plans must use monthly or yearly billing';

    end if;

  end if;


  return
    new;

end;

$$;


drop trigger if exists
business_subscriptions_validate

on public.business_subscriptions;


create trigger
business_subscriptions_validate

before insert
or update

on public.business_subscriptions

for each row

execute function
private.validate_business_subscription();


revoke all
on function
private.validate_business_subscription()
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 7. RLS / DIRECT DATA API ACCESS
--
-- Subscription mutation remains internal until Phase 8.
-- ============================================================

alter table
public.subscription_plans
enable row level security;


alter table
public.business_subscriptions
enable row level security;


revoke all
on public.subscription_plans
from
  anon,
  authenticated;


revoke all
on public.business_subscriptions
from
  anon,
  authenticated;



-- ============================================================
-- 8. CURRENT BUSINESS SUBSCRIPTION RPC
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

      'currentPeriodStart',
      subscription.current_period_start,

      'currentPeriodEnd',
      subscription.current_period_end,

      'cancelAtPeriodEnd',
      subscription.cancel_at_period_end,

      'provider',
      subscription.provider,

      'plan',
      jsonb_build_object(

        'id',
        plan.id,

        'code',
        plan.code,

        'name',
        plan.name,

        'isInternal',
        plan.is_internal,

        'isPublic',
        plan.is_public

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


comment on function
public.get_my_subscription()
is
  'Returns the subscription and effective entitlements for the authenticated account single active NOVA business.';


notify pgrst,
'reload schema';
