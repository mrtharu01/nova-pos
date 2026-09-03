-- ============================================================
-- NOVA POS
-- AUTH V2 — PRODUCTION ACCESS HARDENING
--
-- Run AFTER:
--   phase4g_staff_permissions.sql
--   phase4g_fix_01_duplicate_staff.sql
--   phase4i_checkout_loyalty.sql
--   auth_v2_staff_invitations.sql
-- ============================================================



-- ============================================================
-- 1. STAFF MEMBERS MUST NOT BE DIRECTLY MUTATED BY CLIENTS
--
-- Staff changes must go through trusted SECURITY DEFINER RPCs:
--
--   create_staff_invitation()
--   accept_staff_invitation()
--   update_business_staff()
--
-- This prevents a Manager bypassing our RPC and promoting
-- somebody directly to Manager through the REST API.
-- ============================================================

revoke insert
on public.staff_members
from authenticated;


revoke delete
on public.staff_members
from authenticated;


revoke update
on public.staff_members
from authenticated;


revoke update (
  role,
  status
)
on public.staff_members
from authenticated;


-- Remove direct-write RLS policies as an additional defensive
-- layer. SELECT remains available through the existing policy.

drop policy if exists
staff_insert_manager
on public.staff_members;


drop policy if exists
staff_update_manager
on public.staff_members;


drop policy if exists
staff_delete_manager
on public.staff_members;



-- ============================================================
-- 2. ONE ACTIVE NOVA WORKSPACE PER USER — V1
--
-- Current frontend chooses one business workspace.
--
-- Until NOVA gets an explicit business switcher, an account:
--
--   • may own one business
--   OR
--   • belong to one active business as staff
--
-- but not both / multiple active businesses.
--
-- This trigger protects EVERY path that writes staff_members,
-- including SECURITY DEFINER RPCs.
-- ============================================================

create or replace function
private.enforce_single_nova_workspace()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  -- ==========================================================
  -- OWNER MUST NEVER ALSO EXIST AS STAFF
  -- ==========================================================

  if exists (

    select
      1

    from public.businesses
      as business

    where
      business.id =
        new.business_id

      and
      business.owner_user_id =
        new.user_id

  ) then

    raise exception
      'The business owner must not also exist as a staff member';

  end if;


  -- Disabled staff rows do not represent active access.
  if
    new.status <>
      'active'::public.nova_staff_status
  then

    return new;

  end if;


  -- ==========================================================
  -- USER CANNOT OWN ANOTHER NOVA WORKSPACE
  -- ==========================================================

  if exists (

    select
      1

    from public.businesses
      as business

    where
      business.owner_user_id =
        new.user_id

  ) then

    raise exception
      'This NOVA account already owns a business workspace'

      using errcode =
        '23514';

  end if;


  -- ==========================================================
  -- USER CANNOT HAVE ANOTHER ACTIVE STAFF WORKSPACE
  -- ==========================================================

  if exists (

    select
      1

    from public.staff_members
      as staff

    where
      staff.user_id =
        new.user_id

      and
      staff.status =
        'active'::public.nova_staff_status

      and
      staff.business_id <>
        new.business_id

      and
      (
        tg_op = 'INSERT'
        or
        staff.id <>
          new.id
      )

  ) then

    raise exception
      'This NOVA account already belongs to another business workspace'

      using errcode =
        '23514';

  end if;


  return new;

end;

$$;


revoke all
on function
private.enforce_single_nova_workspace()
from
  public,
  anon,
  authenticated;


drop trigger if exists
nova_staff_single_workspace_insert
on public.staff_members;


create trigger
nova_staff_single_workspace_insert

before insert

on public.staff_members

for each row

execute function
private.enforce_single_nova_workspace();


drop trigger if exists
nova_staff_single_workspace_update
on public.staff_members;


create trigger
nova_staff_single_workspace_update

before update of
  user_id,
  business_id,
  status

on public.staff_members

for each row

execute function
private.enforce_single_nova_workspace();



-- ============================================================
-- 3. CLEAN HISTORICAL OWNER STAFF ROWS
--
-- Owner authority comes ONLY from businesses.owner_user_id.
-- ============================================================

delete from public.staff_members
where id in (

  select
    staff.id

  from public.staff_members
    as staff

  join public.businesses
    as business

    on
      business.id =
        staff.business_id

  where
    staff.user_id =
      business.owner_user_id

);



-- ============================================================
-- 4. FIX OWNER BUSINESS ONBOARDING
--
-- Old bootstrap_business() recreated an unnecessary manager
-- staff row for every new owner.
--
-- Owner authority must come from businesses.owner_user_id.
-- ============================================================

create or replace function
public.bootstrap_business(

  p_name text,

  p_currency_code text,

  p_timezone text

)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_business_id uuid;


begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if
    v_user_id
    is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- VALIDATION
  -- ==========================================================

  if
    length(
      trim(
        coalesce(
          p_name,
          ''
        )
      )
    ) < 2
  then

    raise exception
      'Business name is required';

  end if;


  if
    upper(
      trim(
        coalesce(
          p_currency_code,
          ''
        )
      )
    ) !~ '^[A-Z]{3}$'
  then

    raise exception
      'Currency code must contain exactly three letters';

  end if;


  if
    length(
      trim(
        coalesce(
          p_timezone,
          ''
        )
      )
    ) = 0
  then

    raise exception
      'Timezone is required';

  end if;


  -- ==========================================================
  -- ONE WORKSPACE PER ACCOUNT
  -- ==========================================================

  if exists (

    select
      1

    from public.businesses
      as business

    where
      business.owner_user_id =
        v_user_id

  ) then

    raise exception
      'This account already owns a NOVA business';

  end if;


  if exists (

    select
      1

    from public.staff_members
      as staff

    where
      staff.user_id =
        v_user_id

      and
      staff.status =
        'active'::public.nova_staff_status

  ) then

    raise exception
      'This account already belongs to a NOVA business';

  end if;


  -- ==========================================================
  -- CREATE BUSINESS
  -- ==========================================================

  insert into public.businesses (

    name,

    currency_code,

    timezone,

    owner_user_id

  )

  values (

    trim(
      p_name
    ),

    upper(
      trim(
        p_currency_code
      )
    ),

    trim(
      p_timezone
    ),

    v_user_id

  )

  returning id

  into
    v_business_id;


  -- ==========================================================
  -- DEFAULT INVENTORY LOCATION
  -- ==========================================================

  insert into public.inventory_locations (

    business_id,

    name,

    code,

    is_default,

    is_active

  )

  values (

    v_business_id,

    'Main',

    'MAIN',

    true,

    true

  );


  /*
   * IMPORTANT:
   *
   * Do NOT insert the owner into staff_members.
   *
   * businesses.owner_user_id is the source of owner authority.
   */


  return
    v_business_id;

end;

$$;


revoke all
on function
public.bootstrap_business(
  text,
  text,
  text
)
from
  public,
  anon;


grant execute
on function
public.bootstrap_business(
  text,
  text,
  text
)
to authenticated;



comment on function
public.bootstrap_business(
  text,
  text,
  text
)

is
'Creates one NOVA owner workspace and its default inventory location. Owner authority comes exclusively from businesses.owner_user_id.';



-- ============================================================
-- 5. MANUAL DISCOUNT PERMISSION
--
-- Customer permanent discounts and loyalty discounts are
-- separate fields and continue working for permitted flows.
--
-- manual_discount_total > 0 requires Owner / Manager.
--
-- Protecting the sales table with a trigger means we do NOT
-- need to rewrite the large complete_sale() RPC.
-- ============================================================

create or replace function
private.enforce_manual_discount_permission()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  if
    coalesce(
      new.manual_discount_total,
      0
    ) > 0

    and

    not private.is_business_manager(
      new.business_id
    )
  then

    raise exception
      'Manager approval is required for manual discounts'

      using errcode =
        '42501';

  end if;


  return new;

end;

$$;


revoke all
on function
private.enforce_manual_discount_permission()
from
  public,
  anon,
  authenticated;


drop trigger if exists
nova_sales_manual_discount_insert
on public.sales;


create trigger
nova_sales_manual_discount_insert

before insert

on public.sales

for each row

execute function
private.enforce_manual_discount_permission();


drop trigger if exists
nova_sales_manual_discount_update
on public.sales;


create trigger
nova_sales_manual_discount_update

before update of
  manual_discount_total,
  business_id

on public.sales

for each row

execute function
private.enforce_manual_discount_permission();



-- ============================================================
-- 6. MANAGER-ONLY FINANCIAL REPORT RPC
--
-- The frontend already calls get_financial_report().
-- The SQL migration was missing from the repository.
--
-- Dashboard remains available through get_dashboard_report().
-- Detailed Reports require Manager / Owner.
-- ============================================================

create or replace function
public.get_financial_report(

  p_business_id uuid,

  p_start_date date,

  p_end_date date

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

begin

  if
    (
      select auth.uid()
    )
    is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then

    raise exception
      'Manager access required for financial reports'

      using errcode =
        '42501';

  end if;


  return
    public.get_dashboard_report(

      p_business_id,

      p_start_date,

      p_end_date

    );

end;

$$;


revoke all
on function
public.get_financial_report(
  uuid,
  date,
  date
)
from
  public,
  anon;


grant execute
on function
public.get_financial_report(
  uuid,
  date,
  date
)
to authenticated;



comment on function
public.get_financial_report(
  uuid,
  date,
  date
)

is
'Manager-only NOVA financial report wrapper.';



-- ============================================================
-- 7. OLD STAFF CREATION FLOW
--
-- Keep the function installed temporarily because older code
-- may still reference it, but remove client execution.
--
-- The new Staff UI will use:
--
--   /api/staff/invite
--       ↓
--   create_staff_invitation()
--
-- ============================================================

revoke execute
on function
public.add_business_staff(
  uuid,
  text,
  public.nova_staff_role
)
from
  authenticated,
  anon,
  public;



-- ============================================================
-- 8. API SCHEMA REFRESH
-- ============================================================

notify pgrst,
'reload schema';