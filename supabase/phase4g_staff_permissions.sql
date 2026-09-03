-- ============================================================
-- NOVA POS
-- PHASE 4G.1 — STAFF & PERMISSIONS
-- ============================================================


-- ============================================================
-- CURRENT USER ACCESS
-- ============================================================

create or replace function
public.get_my_business_access(
  p_business_id uuid
)

returns jsonb

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

  v_role text;

  v_status text;

  v_is_owner boolean :=
    false;

begin

  if v_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


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


  v_is_owner :=
    v_owner_user_id =
    v_user_id;


  if v_is_owner then

    v_role :=
      'owner';

    v_status :=
      'active';

  else

    select
      staff.role::text,
      staff.status::text
    into
      v_role,
      v_status
    from public.staff_members
      as staff
    where
      staff.business_id =
        p_business_id
      and
      staff.user_id =
        v_user_id
    limit 1;

  end if;


  if
    not v_is_owner
    and
    (
      v_role is null
      or
      v_status <> 'active'
    )
  then
    raise exception
      'You do not have active access to this business'
      using errcode = '42501';
  end if;


  return jsonb_build_object(

    'businessId',
    p_business_id,

    'userId',
    v_user_id,

    'isOwner',
    v_is_owner,

    'role',
    v_role,

    'status',
    v_status,

    'permissions',
    jsonb_build_object(

      'checkout',
      true,

      'viewSales',
      true,

      'manageCatalog',
      (
        v_is_owner
        or
        v_role = 'manager'
      ),

      'manageInventory',
      (
        v_is_owner
        or
        v_role = 'manager'
      ),

      'viewReports',
      (
        v_is_owner
        or
        v_role = 'manager'
      ),

      'manageSettings',
      (
        v_is_owner
        or
        v_role = 'manager'
      ),

      'manageStaff',
      (
        v_is_owner
        or
        v_role = 'manager'
      ),

      'manageManagers',
      v_is_owner,

      'refundSales',
      (
        v_is_owner
        or
        v_role = 'manager'
      )

    )

  );

end;

$$;


revoke all
on function
public.get_my_business_access(uuid)
from public,
anon;


grant execute
on function
public.get_my_business_access(uuid)
to authenticated;



-- ============================================================
-- LIST STAFF
--
-- Includes business owner as a virtual staff row.
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

begin

  if v_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  return query


  -- OWNER

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


  -- STAFF

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

  order by
    is_owner desc,
    created_at asc;

end;

$$;


revoke all
on function
public.list_business_staff(uuid)
from public,
anon;


grant execute
on function
public.list_business_staff(uuid)
to authenticated;



-- ============================================================
-- ADD STAFF BY EXISTING NOVA ACCOUNT EMAIL
--
-- Staff member first creates/signs into a NOVA account.
-- Manager/owner can then attach that account to the business.
-- ============================================================

create or replace function
public.add_business_staff(
  p_business_id uuid,
  p_email text,
  p_role public.nova_staff_role
)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_actor_id uuid :=
    (
      select auth.uid()
    );

  v_target_user_id uuid;

  v_owner_user_id uuid;

  v_actor_is_owner boolean :=
    false;

  v_staff_id uuid;

  v_email text;

begin

  if v_actor_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  v_email :=
    lower(
      trim(
        coalesce(
          p_email,
          ''
        )
      )
    );


  if
    v_email = ''
    or
    position('@' in v_email) = 0
  then
    raise exception
      'Enter a valid staff email address';
  end if;


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


  v_actor_is_owner :=
    v_owner_user_id =
    v_actor_id;


  -- Managers may only create cashiers.

  if
    not v_actor_is_owner
    and
    p_role <>
      'cashier'::public.nova_staff_role
  then
    raise exception
      'Only the business owner can add managers'
      using errcode = '42501';
  end if;


  select
    user_record.id
  into
    v_target_user_id
  from auth.users
    as user_record
  where
    lower(
      user_record.email
    ) =
      v_email
  limit 1;


  if v_target_user_id is null then

    raise exception
      'No NOVA account exists for this email. Ask the staff member to create an account first.';

  end if;


  if
    v_target_user_id =
    v_owner_user_id
  then

    raise exception
      'The business owner already has full access';

  end if;


  insert into public.staff_members (

    business_id,

    user_id,

    role,

    status

  )

  values (

    p_business_id,

    v_target_user_id,

    p_role,

    'active'::public.nova_staff_status

  )

  on conflict (
    business_id,
    user_id
  )

  do update

  set

    role =
      excluded.role,

    status =
      'active'::public.nova_staff_status,

    updated_at =
      now()

  returning
    id

  into
    v_staff_id;


  return v_staff_id;

end;

$$;


revoke all
on function
public.add_business_staff(
  uuid,
  text,
  public.nova_staff_role
)
from public,
anon;


grant execute
on function
public.add_business_staff(
  uuid,
  text,
  public.nova_staff_role
)
to authenticated;



-- ============================================================
-- UPDATE STAFF
-- ============================================================

create or replace function
public.update_business_staff(
  p_business_id uuid,
  p_staff_id uuid,
  p_role public.nova_staff_role,
  p_status public.nova_staff_status
)

returns void

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_actor_id uuid :=
    (
      select auth.uid()
    );

  v_owner_user_id uuid;

  v_actor_is_owner boolean :=
    false;

  v_existing_role
    public.nova_staff_role;

begin

  if v_actor_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  select
    business.owner_user_id
  into
    v_owner_user_id
  from public.businesses
    as business
  where
    business.id =
      p_business_id;


  v_actor_is_owner :=
    v_owner_user_id =
    v_actor_id;


  select
    staff.role
  into
    v_existing_role
  from public.staff_members
    as staff
  where
    staff.id =
      p_staff_id
    and
    staff.business_id =
      p_business_id;


  if v_existing_role is null then
    raise exception
      'Staff member not found';
  end if;


  /*
   * Managers cannot:
   *
   * - edit another manager
   * - promote someone to manager
   */

  if
    not v_actor_is_owner
    and
    (
      v_existing_role =
        'manager'::public.nova_staff_role
      or
      p_role =
        'manager'::public.nova_staff_role
    )
  then
    raise exception
      'Only the business owner can manage manager accounts'
      using errcode = '42501';
  end if;


  update public.staff_members
    as staff

  set

    role =
      p_role,

    status =
      p_status,

    updated_at =
      now()

  where
    staff.id =
      p_staff_id
    and
    staff.business_id =
      p_business_id;

end;

$$;


revoke all
on function
public.update_business_staff(
  uuid,
  uuid,
  public.nova_staff_role,
  public.nova_staff_status
)
from public,
anon;


grant execute
on function
public.update_business_staff(
  uuid,
  uuid,
  public.nova_staff_role,
  public.nova_staff_status
)
to authenticated;



-- ============================================================
-- HARDEN RECEIPT SETTINGS
--
-- Cashiers should be able to PRINT receipts,
-- but not change business receipt configuration.
-- ============================================================

drop policy if exists
nova_receipt_settings_update
on public.receipt_settings;


create policy
nova_receipt_settings_update

on public.receipt_settings

for update

to authenticated

using (
  (
    select private.is_business_manager(
      business_id
    )
  )
)

with check (
  (
    select private.is_business_manager(
      business_id
    )
  )
);