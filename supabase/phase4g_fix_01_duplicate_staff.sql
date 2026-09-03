-- ============================================================
-- NOVA POS
-- PHASE 4G FIX 01
-- Prevent business owner appearing twice in staff list
-- ============================================================


-- ============================================================
-- CLEAN OLD OWNER STAFF ROWS
--
-- The business owner already receives full access through
-- businesses.owner_user_id and should never also exist as a
-- normal staff_members record for the same business.
-- ============================================================

delete from public.staff_members
where id in (

  select
    staff.id

  from public.staff_members
    as staff

  join public.businesses
    as business
    on business.id =
      staff.business_id

  where
    staff.user_id =
      business.owner_user_id

);


-- ============================================================
-- REPLACE STAFF LIST FUNCTION
-- ============================================================

create or replace function
public.list_business_staff(
  p_business_id uuid
)

returns table (

  staff_id uuid,

  user_id uuid,

  email text,

  role text,

  status text,

  is_owner boolean,

  created_at timestamptz

)

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );

  v_owner_user_id uuid;

begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if v_user_id is null then

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
      'Manager access required'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- OWNER
  -- ==========================================================

  select
    business.owner_user_id

  into
    v_owner_user_id

  from public.businesses
    as business

  where
    business.id =
      p_business_id;


  if v_owner_user_id is null then

    raise exception
      'Business not found';

  end if;


  -- ==========================================================
  -- RETURN OWNER + STAFF
  -- ==========================================================

  return query


  /*
   * BUSINESS OWNER
   *
   * Owner is represented as a virtual staff row.
   * There is intentionally no staff_members record.
   */

  select

    null::uuid
      as staff_id,

    owner_user.id
      as user_id,

    owner_user.email::text
      as email,

    'owner'::text
      as role,

    'active'::text
      as status,

    true
      as is_owner,

    business.created_at
      as created_at


  from public.businesses
    as business


  join auth.users
    as owner_user

    on
      owner_user.id =
        business.owner_user_id


  where
    business.id =
      p_business_id


  union all


  /*
   * NORMAL STAFF
   *
   * Explicitly exclude owner_user_id as a second defensive
   * layer even if bad historical data somehow appears later.
   */

  select

    staff.id
      as staff_id,

    staff.user_id
      as user_id,

    staff_user.email::text
      as email,

    staff.role::text
      as role,

    staff.status::text
      as status,

    false
      as is_owner,

    staff.created_at
      as created_at


  from public.staff_members
    as staff


  join auth.users
    as staff_user

    on
      staff_user.id =
        staff.user_id


  where
    staff.business_id =
      p_business_id

    and
    staff.user_id <>
      v_owner_user_id


  order by

    is_owner desc,

    created_at asc;

end;

$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function
public.list_business_staff(uuid)
from
  public,
  anon;


grant execute
on function
public.list_business_staff(uuid)
to authenticated;