-- ============================================================
-- NOVA POS
-- SaaS Phase 3 — Single-tenant guardrails
-- ============================================================
--
-- NOVA currently exposes one active business per account.
-- This migration makes that rule a DATABASE rule instead of a
-- frontend convention.
--
-- It also centralizes RLS/RPC membership checks around the
-- database-resolved current business introduced in Phase 3A.
-- ============================================================


-- ============================================================
-- 1. BUSINESS MEMBER CHECK
--
-- A target business is accessible only when it is the single
-- active business resolved for the authenticated account.
-- ============================================================

create or replace function
private.is_business_member(
  target_business_id uuid
)

returns boolean

language plpgsql

stable

security definer

set search_path = ''

as $$

declare
  v_current_business_id uuid;

begin

  if
    (
      select auth.uid()
    ) is null

    or

    target_business_id is null
  then

    return false;

  end if;


  v_current_business_id :=
    private.current_business_id();


  return
    v_current_business_id is not null
    and
    v_current_business_id =
      target_business_id;

end;

$$;



-- ============================================================
-- 2. BUSINESS MANAGER CHECK
--
-- Tenant identity is resolved first. Role checks are then
-- evaluated only inside that tenant.
-- ============================================================

create or replace function
private.is_business_manager(
  target_business_id uuid
)

returns boolean

language plpgsql

stable

security definer

set search_path = ''

as $$

declare
  v_user_id uuid :=
    (
      select auth.uid()
    );

  v_current_business_id uuid;

begin

  if
    v_user_id is null

    or

    target_business_id is null
  then

    return false;

  end if;


  v_current_business_id :=
    private.current_business_id();


  if
    v_current_business_id is null

    or

    v_current_business_id <>
      target_business_id
  then

    return false;

  end if;


  return

    exists (

      select
        1

      from public.businesses
        as business

      where
        business.id =
          target_business_id

        and
        business.owner_user_id =
          v_user_id

    )

    or

    exists (

      select
        1

      from public.staff_members
        as staff

      where
        staff.business_id =
          target_business_id

        and
        staff.user_id =
          v_user_id

        and
        staff.status =
          'active'::public.nova_staff_status

        and
        staff.role =
          'manager'::public.nova_staff_role

    );

end;

$$;


revoke all
on function
private.is_business_member(uuid)
from public,
anon;


revoke all
on function
private.is_business_manager(uuid)
from public,
anon;


grant usage
on schema private
to authenticated;


grant execute
on function
private.is_business_member(uuid)
to authenticated;


grant execute
on function
private.is_business_manager(uuid)
to authenticated;



-- ============================================================
-- 3. PREVENT ONE USER FROM JOINING TWO ACTIVE BUSINESSES
--
-- This protects every code path:
--   staff invitation acceptance
--   existing-user staff add
--   direct SQL/API writes allowed by future migrations
-- ============================================================

create or replace function
private.enforce_single_active_business_membership()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  if
    new.status <>
      'active'::public.nova_staff_status
  then

    return new;

  end if;


  -- A business owner cannot simultaneously become active staff
  -- in a different tenant.

  if exists (

    select
      1

    from public.businesses
      as business

    where
      business.owner_user_id =
        new.user_id

      and
      business.id <>
        new.business_id

  )
  then

    raise exception
      'This account already belongs to another NOVA business'
      using errcode = '23514';

  end if;


  -- A staff account may have only one active tenant.

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

  )
  then

    raise exception
      'This account already belongs to another NOVA business'
      using errcode = '23514';

  end if;


  return new;

end;

$$;


drop trigger if exists
nova_single_active_business_membership
on public.staff_members;


create trigger
nova_single_active_business_membership

before insert
or update of
  business_id,
  user_id,
  status

on public.staff_members

for each row

execute function
private.enforce_single_active_business_membership();



-- ============================================================
-- 4. PREVENT AN OWNER FROM OWNING A TENANT WHILE ACTIVE STAFF
--    IN ANOTHER TENANT
--
-- The existing unique owner index already prevents owning two
-- businesses. This closes the owner <-> staff crossover case.
-- ============================================================

create or replace function
private.enforce_single_owner_workspace()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  if exists (

    select
      1

    from public.staff_members
      as staff

    where
      staff.user_id =
        new.owner_user_id

      and
      staff.status =
        'active'::public.nova_staff_status

      and
      staff.business_id <>
        new.id

  )
  then

    raise exception
      'This account already belongs to another NOVA business'
      using errcode = '23514';

  end if;


  return new;

end;

$$;


drop trigger if exists
nova_single_owner_workspace
on public.businesses;


create trigger
nova_single_owner_workspace

before insert
or update of
  owner_user_id

on public.businesses

for each row

execute function
private.enforce_single_owner_workspace();



-- ============================================================
-- 5. INTERNAL HELPER PRIVILEGES
-- ============================================================

revoke all
on function
private.enforce_single_active_business_membership()
from public,
anon,
authenticated;


revoke all
on function
private.enforce_single_owner_workspace()
from public,
anon,
authenticated;


notify pgrst,
'reload schema';
