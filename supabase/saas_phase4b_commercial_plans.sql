-- ============================================================
-- NOVA POS
-- SaaS Phase 4B — Commercial plan catalog
-- ============================================================
--
-- Correct commercial plan model:
--
--   Starter
--   Pro
--   Business
--
-- "Lifetime Free" is NOT a plan.
-- Complimentary access belongs to a tenant billing override
-- and is introduced with subscription controls in Phase 4C.
--
-- This migration is safe if the earlier deprecated Phase 4
-- draft was never run. If that draft was run, it also removes
-- an unused lifetime_free catalog row and reuses the table.
-- ============================================================


-- ============================================================
-- 1. CLEAN UP THE DEPRECATED DRAFT SURFACE
-- ============================================================

drop function if exists
public.get_my_subscription();


do $$
declare

  v_lifetime_plan_id uuid;

  v_reference_count integer := 0;

begin

  if to_regclass(
    'public.subscription_plans'
  ) is null
  then

    return;

  end if;


  select
    plan.id

  into
    v_lifetime_plan_id

  from public.subscription_plans
    as plan

  where
    plan.code =
      'lifetime_free'

  limit 1;


  if
    v_lifetime_plan_id is null
  then

    return;

  end if;


  if to_regclass(
    'public.business_subscriptions'
  ) is not null
  then

    execute
      'select count(*) from public.business_subscriptions where plan_id = $1'

    into
      v_reference_count

    using
      v_lifetime_plan_id;

  end if;


  if
    v_reference_count > 0
  then

    raise exception
      'Deprecated lifetime_free plan is assigned to % business subscription(s). Resolve those rows before running the corrected Phase 4B migration.',
      v_reference_count;

  end if;


  delete from public.subscription_plans

  where
    id =
      v_lifetime_plan_id;

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
    default true,

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
    default now()

);


alter table
public.subscription_plans

add column if not exists
description text
not null
default '';


alter table
public.subscription_plans

add column if not exists
is_public boolean
not null
default true;


alter table
public.subscription_plans

add column if not exists
is_active boolean
not null
default true;


alter table
public.subscription_plans

add column if not exists
monthly_price_lkr numeric(12,2);


alter table
public.subscription_plans

add column if not exists
yearly_price_lkr numeric(12,2);


alter table
public.subscription_plans

add column if not exists
entitlements jsonb
not null
default '{}'::jsonb;


alter table
public.subscription_plans

add column if not exists
usage_limits jsonb
not null
default '{}'::jsonb;


alter table
public.subscription_plans

add column if not exists
sort_order integer
not null
default 0;


alter table
public.subscription_plans

add column if not exists
created_at timestamptz
not null
default now();


alter table
public.subscription_plans

add column if not exists
updated_at timestamptz
not null
default now();



-- ============================================================
-- 3. CATALOG CONSTRAINTS
-- ============================================================

do $$
begin

  if not exists (

    select
      1

    from pg_constraint

    where
      conname =
        'subscription_plans_code_not_blank'

      and
      conrelid =
        'public.subscription_plans'::regclass

  )
  then

    alter table
    public.subscription_plans

    add constraint
    subscription_plans_code_not_blank

    check (
      btrim(
        code
      ) <> ''
    );

  end if;


  if not exists (

    select
      1

    from pg_constraint

    where
      conname =
        'subscription_plans_name_not_blank'

      and
      conrelid =
        'public.subscription_plans'::regclass

  )
  then

    alter table
    public.subscription_plans

    add constraint
    subscription_plans_name_not_blank

    check (
      btrim(
        name
      ) <> ''
    );

  end if;


  if not exists (

    select
      1

    from pg_constraint

    where
      conname =
        'subscription_plans_monthly_price_nonnegative'

      and
      conrelid =
        'public.subscription_plans'::regclass

  )
  then

    alter table
    public.subscription_plans

    add constraint
    subscription_plans_monthly_price_nonnegative

    check (
      monthly_price_lkr is null
      or
      monthly_price_lkr >= 0
    );

  end if;


  if not exists (

    select
      1

    from pg_constraint

    where
      conname =
        'subscription_plans_yearly_price_nonnegative'

      and
      conrelid =
        'public.subscription_plans'::regclass

  )
  then

    alter table
    public.subscription_plans

    add constraint
    subscription_plans_yearly_price_nonnegative

    check (
      yearly_price_lkr is null
      or
      yearly_price_lkr >= 0
    );

  end if;


  if not exists (

    select
      1

    from pg_constraint

    where
      conname =
        'subscription_plans_entitlements_object'

      and
      conrelid =
        'public.subscription_plans'::regclass

  )
  then

    alter table
    public.subscription_plans

    add constraint
    subscription_plans_entitlements_object

    check (
      jsonb_typeof(
        entitlements
      ) =
        'object'
    );

  end if;


  if not exists (

    select
      1

    from pg_constraint

    where
      conname =
        'subscription_plans_usage_limits_object'

      and
      conrelid =
        'public.subscription_plans'::regclass

  )
  then

    alter table
    public.subscription_plans

    add constraint
    subscription_plans_usage_limits_object

    check (
      jsonb_typeof(
        usage_limits
      ) =
        'object'
    );

  end if;

end;
$$;



-- ============================================================
-- 4. ONLY THE THREE NOVA COMMERCIAL PLANS
-- ============================================================

insert into public.subscription_plans (
  code,
  name,
  description,
  is_public,
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
    true,
    null,
    null,
    '{}'::jsonb,
    '{}'::jsonb,
    30
  )

on conflict (
  code
)

do update

set
  sort_order =
    excluded.sort_order,

  updated_at =
    now();



-- Any unexpected rows from experiments are kept out of the
-- commercial surface instead of silently deleting real data.

update public.subscription_plans

set
  is_public =
    false,

  is_active =
    false,

  updated_at =
    now()

where
  code not in (
    'starter',
    'pro',
    'business'
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



-- ============================================================
-- 6. DATA API LOCKDOWN
-- ============================================================

alter table
public.subscription_plans
enable row level security;


revoke all
on public.subscription_plans
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 7. COMMERCIAL-MANAGEMENT ROLE CHECK
--
-- Owner + Admin can change plan configuration.
-- Support is read-only.
-- ============================================================

create or replace function
private.can_manage_platform_commercial()

returns boolean

language sql

stable

security definer

set search_path = ''

as $$

  select
    (
      select auth.uid()
    ) is not null

    and

    exists (

      select
        1

      from public.platform_admins
        as platform_admin

      where
        platform_admin.user_id =
          (
            select auth.uid()
          )

        and
        platform_admin.role in (
          'owner'::public.nova_platform_admin_role,
          'admin'::public.nova_platform_admin_role
        )

    );

$$;


revoke all
on function
private.can_manage_platform_commercial()
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 8. LIST PLANS
-- ============================================================

create or replace function
public.list_platform_subscription_plans()

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

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
          'id',
          plan.id,

          'code',
          plan.code,

          'name',
          plan.name,

          'description',
          plan.description,

          'isPublic',
          plan.is_public,

          'isActive',
          plan.is_active,

          'monthlyPriceLkr',
          plan.monthly_price_lkr,

          'yearlyPriceLkr',
          plan.yearly_price_lkr,

          'entitlements',
          plan.entitlements,

          'usageLimits',
          plan.usage_limits,

          'sortOrder',
          plan.sort_order,

          'updatedAt',
          plan.updated_at
        )
        order by
          plan.sort_order,
          plan.code
      ),
      '[]'::jsonb
    )

  into
    v_result

  from public.subscription_plans
    as plan

  where
    plan.code in (
      'starter',
      'pro',
      'business'
    );


  return
    v_result;

end;

$$;


revoke all
on function
public.list_platform_subscription_plans()
from
  public,
  anon;


grant execute
on function
public.list_platform_subscription_plans()
to authenticated;



-- ============================================================
-- 9. SAVE PLAN
-- ============================================================

create or replace function
public.save_platform_subscription_plan(
  p_code text,
  p_name text,
  p_description text,
  p_monthly_price_lkr numeric,
  p_yearly_price_lkr numeric,
  p_is_public boolean,
  p_is_active boolean,
  p_entitlements jsonb,
  p_usage_limits jsonb
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

  v_code text :=
    lower(
      btrim(
        coalesce(
          p_code,
          ''
        )
      )
    );

  v_name text :=
    btrim(
      coalesce(
        p_name,
        ''
      )
    );

  v_description text :=
    btrim(
      coalesce(
        p_description,
        ''
      )
    );

  v_plan_id uuid;

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
    v_code not in (
      'starter',
      'pro',
      'business'
    )
  then

    raise exception
      'Unknown NOVA commercial plan';

  end if;


  if
    v_name = ''
  then

    raise exception
      'Plan name is required';

  end if;


  if
    p_monthly_price_lkr is not null
    and
    p_monthly_price_lkr < 0
  then

    raise exception
      'Monthly price cannot be negative';

  end if;


  if
    p_yearly_price_lkr is not null
    and
    p_yearly_price_lkr < 0
  then

    raise exception
      'Yearly price cannot be negative';

  end if;


  if
    jsonb_typeof(
      coalesce(
        p_entitlements,
        '{}'::jsonb
      )
    ) <>
      'object'
  then

    raise exception
      'Entitlements must be a JSON object';

  end if;


  if exists (

    select
      1

    from jsonb_each(
      coalesce(
        p_entitlements,
        '{}'::jsonb
      )
    ) as entitlement(
      key,
      value
    )

    where
      jsonb_typeof(
        entitlement.value
      ) <>
        'boolean'

  )
  then

    raise exception
      'Every entitlement must be true or false';

  end if;


  if
    jsonb_typeof(
      coalesce(
        p_usage_limits,
        '{}'::jsonb
      )
    ) <>
      'object'
  then

    raise exception
      'Usage limits must be a JSON object';

  end if;


  if exists (

    select
      1

    from jsonb_each(
      coalesce(
        p_usage_limits,
        '{}'::jsonb
      )
    ) as usage_limit(
      key,
      value
    )

    where
      jsonb_typeof(
        usage_limit.value
      ) not in (
        'number',
        'null'
      )

      or

      (
        jsonb_typeof(
          usage_limit.value
        ) =
          'number'

        and

        (
          usage_limit.value
            #>>
              '{}'
        )::numeric < 0
      )

  )
  then

    raise exception
      'Usage limits must be non-negative numbers or null for unlimited';

  end if;


  update public.subscription_plans

  set
    name =
      v_name,

    description =
      v_description,

    monthly_price_lkr =
      p_monthly_price_lkr,

    yearly_price_lkr =
      p_yearly_price_lkr,

    is_public =
      coalesce(
        p_is_public,
        false
      ),

    is_active =
      coalesce(
        p_is_active,
        false
      ),

    entitlements =
      coalesce(
        p_entitlements,
        '{}'::jsonb
      ),

    usage_limits =
      coalesce(
        p_usage_limits,
        '{}'::jsonb
      )

  where
    code =
      v_code

  returning
    id

  into
    v_plan_id;


  if
    v_plan_id is null
  then

    raise exception
      'NOVA commercial plan was not found';

  end if;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    metadata
  )

  values (
    v_actor_user_id,
    'subscription_plan_updated',
    jsonb_build_object(
      'planId',
      v_plan_id,
      'code',
      v_code,
      'name',
      v_name,
      'monthlyPriceLkr',
      p_monthly_price_lkr,
      'yearlyPriceLkr',
      p_yearly_price_lkr,
      'isPublic',
      coalesce(
        p_is_public,
        false
      ),
      'isActive',
      coalesce(
        p_is_active,
        false
      )
    )
  );


  return
    jsonb_build_object(
      'ok',
      true,
      'planId',
      v_plan_id,
      'code',
      v_code
    );

end;

$$;


revoke all
on function
public.save_platform_subscription_plan(
  text,
  text,
  text,
  numeric,
  numeric,
  boolean,
  boolean,
  jsonb,
  jsonb
)
from
  public,
  anon;


grant execute
on function
public.save_platform_subscription_plan(
  text,
  text,
  text,
  numeric,
  numeric,
  boolean,
  boolean,
  jsonb,
  jsonb
)
to authenticated;


notify pgrst,
'reload schema';
