-- ============================================================
-- NOVA POS
-- AUTH V2 — INVITATION ACCOUNT STATE FIX
--
-- Run AFTER:
--
--   auth_v2_staff_invitations.sql
--   auth_v2_production_hardening.sql
--
-- Purpose:
--
--   • confirmed Auth users may be added directly
--   • unconfirmed Auth users must NOT become active staff
--   • previous Supabase invitation users remain pending
--   • invitation acceptance requires a confirmed email
-- ============================================================



-- ============================================================
-- CREATE STAFF INVITATION
-- ============================================================

create or replace function
public.create_staff_invitation(

  p_business_id uuid,

  p_email text,

  p_role public.nova_staff_role

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


  v_email text :=
    lower(
      trim(
        coalesce(
          p_email,
          ''
        )
      )
    );


  v_owner_user_id uuid;

  v_business_name text;


  v_existing_user_id uuid;

  v_existing_email_confirmed_at
    timestamptz;

  v_existing_invited_at
    timestamptz;


  v_existing_staff_id uuid;

  v_existing_staff_role
    public.nova_staff_role;


  v_invitation_id uuid;


begin

  -- ==========================================================
  -- AUTHENTICATION
  -- ==========================================================

  if
    v_actor_user_id
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
    p_business_id
    is null
  then

    raise exception
      'Business is required';

  end if;


  if
    v_email = ''
    or
    position(
      '@'
      in v_email
    ) = 0
  then

    raise exception
      'Enter a valid email address';

  end if;


  if
    p_role
    is null
  then

    raise exception
      'Staff role is required';

  end if;


  -- ==========================================================
  -- BUSINESS ACCESS
  -- ==========================================================

  if not (
    select
      private.is_business_manager(
        p_business_id
      )
  ) then

    raise exception
      'Manager access required'

      using errcode =
        '42501';

  end if;


  select

    business.owner_user_id,

    business.name

  into

    v_owner_user_id,

    v_business_name

  from public.businesses
    as business

  where
    business.id =
      p_business_id;


  if
    v_owner_user_id
    is null
  then

    raise exception
      'Business not found';

  end if;


  -- ==========================================================
  -- MANAGER INVITATIONS ARE OWNER-ONLY
  -- ==========================================================

  if
    p_role =
      'manager'::public.nova_staff_role

    and

    v_actor_user_id <>
      v_owner_user_id
  then

    raise exception
      'Only the business owner can invite a manager'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- LOOK FOR EXISTING AUTH ACCOUNT
  -- ==========================================================

  select

    auth_user.id,

    auth_user.email_confirmed_at,

    auth_user.invited_at

  into

    v_existing_user_id,

    v_existing_email_confirmed_at,

    v_existing_invited_at

  from auth.users
    as auth_user

  where
    lower(
      auth_user.email
    ) =
      v_email

  limit 1;


  -- ==========================================================
  -- OWNER CANNOT BE ADDED AS STAFF
  -- ==========================================================

  if
    v_existing_user_id =
      v_owner_user_id
  then

    raise exception
      'This email belongs to the business owner';

  end if;


  -- ==========================================================
  -- CONFIRMED EXISTING NOVA ACCOUNT
  --
  -- Only confirmed Auth accounts qualify for immediate access.
  --
  -- An auth.users row alone is NOT enough because
  -- inviteUserByEmail() creates an unconfirmed Auth user.
  -- ==========================================================

  if
    v_existing_user_id
      is not null

    and

    v_existing_email_confirmed_at
      is not null
  then

    select

      staff.id,

      staff.role

    into

      v_existing_staff_id,

      v_existing_staff_role

    from public.staff_members
      as staff

    where
      staff.business_id =
        p_business_id

      and
      staff.user_id =
        v_existing_user_id

    limit 1;


    -- ========================================================
    -- MANAGER CANNOT MODIFY ANOTHER MANAGER
    -- ========================================================

    if
      v_existing_staff_id
        is not null

      and

      v_existing_staff_role =
        'manager'::public.nova_staff_role

      and

      v_actor_user_id <>
        v_owner_user_id
    then

      raise exception
        'Only the business owner can modify a manager'

        using errcode =
          '42501';

    end if;


    -- ========================================================
    -- CREATE / REACTIVATE STAFF ACCESS
    --
    -- The single-workspace trigger installed by
    -- auth_v2_production_hardening.sql protects against
    -- cross-business access.
    -- ========================================================

    if
      v_existing_staff_id
      is null
    then

      insert into public.staff_members (

        business_id,

        user_id,

        role,

        status

      )

      values (

        p_business_id,

        v_existing_user_id,

        p_role,

        'active'::public.nova_staff_status

      );

    else

      update public.staff_members

      set

        role =
          p_role,

        status =
          'active'::public.nova_staff_status

      where
        id =
          v_existing_staff_id;

    end if;


    -- ========================================================
    -- CLOSE ANY OLD PENDING INVITATIONS
    -- ========================================================

    update public.staff_invitations

    set

      status =
        'accepted',

      accepted_by_user_id =
        v_existing_user_id,

      accepted_at =
        now(),

      revoked_at =
        null

    where
      business_id =
        p_business_id

      and
      lower(
        email
      ) =
        v_email

      and
      status =
        'pending';


    return jsonb_build_object(

      'status',
      'existing_user_added',

      'businessId',
      p_business_id,

      'businessName',
      v_business_name,

      'email',
      v_email,

      'role',
      p_role,

      'userId',
      v_existing_user_id

    );

  end if;


  -- ==========================================================
  -- NEW / UNCONFIRMED USER
  --
  -- Always create a real pending invitation.
  --
  -- This includes:
  --
  --   • email with no auth.users row
  --   • old Supabase invitation user
  --   • unconfirmed normal NOVA signup
  --
  -- The API route decides how the Auth user should be handled.
  -- ==========================================================

  update public.staff_invitations

  set

    status =
      'revoked',

    revoked_at =
      now()

  where
    business_id =
      p_business_id

    and
    lower(
      email
    ) =
      v_email

    and
    status =
      'pending';


  insert into public.staff_invitations (

    business_id,

    email,

    role,

    status,

    invited_by_user_id,

    expires_at

  )

  values (

    p_business_id,

    v_email,

    p_role,

    'pending',

    v_actor_user_id,

    now() +
      interval '24 hours'

  )

  returning
    id

  into
    v_invitation_id;


  return jsonb_build_object(

    'status',
    'pending',

    'invitationId',
    v_invitation_id,

    'businessId',
    p_business_id,

    'businessName',
    v_business_name,

    'email',
    v_email,

    'role',
    p_role,

    'existingAuthUserId',
    v_existing_user_id,

    'existingAuthUserWasInvited',
    (
      v_existing_user_id
        is not null

      and

      v_existing_invited_at
        is not null
    )

  );

end;

$$;



-- ============================================================
-- ACCEPT STAFF INVITATION
-- ============================================================

create or replace function
public.accept_staff_invitation(

  p_invitation_id uuid

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


  v_user_email text;

  v_email_confirmed_at
    timestamptz;


  v_invitation
    public.staff_invitations%rowtype;


  v_existing_staff_id uuid;


begin

  -- ==========================================================
  -- AUTHENTICATION
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
  -- AUTH USER
  -- ==========================================================

  select

    lower(
      auth_user.email
    ),

    auth_user.email_confirmed_at

  into

    v_user_email,

    v_email_confirmed_at

  from auth.users
    as auth_user

  where
    auth_user.id =
      v_user_id;


  if
    v_user_email
    is null
  then

    raise exception
      'Authenticated email could not be resolved';

  end if;


  -- Invitation verification should confirm the email before
  -- this RPC can activate business access.

  if
    v_email_confirmed_at
    is null
  then

    raise exception
      'Verify your email before accepting this invitation'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- LOCK INVITATION
  -- ==========================================================

  select
    invitation.*

  into
    v_invitation

  from public.staff_invitations
    as invitation

  where
    invitation.id =
      p_invitation_id

  for update;


  if
    v_invitation.id
    is null
  then

    raise exception
      'Invitation not found';

  end if;


  -- ==========================================================
  -- IDEMPOTENT ACCEPTANCE
  -- ==========================================================

  if
    v_invitation.status =
      'accepted'

    and

    v_invitation.accepted_by_user_id =
      v_user_id
  then

    return jsonb_build_object(

      'status',
      'accepted',

      'businessId',
      v_invitation.business_id,

      'role',
      v_invitation.role

    );

  end if;


  -- ==========================================================
  -- STATUS
  -- ==========================================================

  if
    v_invitation.status <>
      'pending'
  then

    raise exception
      'This invitation is no longer active';

  end if;


  -- ==========================================================
  -- EXPIRY
  -- ==========================================================

  if
    v_invitation.expires_at <=
      now()
  then

    update public.staff_invitations

    set
      status =
        'expired'

    where
      id =
        p_invitation_id

      and
      status =
        'pending';


    raise exception
      'This invitation has expired';

  end if;


  -- ==========================================================
  -- EMAIL OWNERSHIP
  -- ==========================================================

  if
    lower(
      v_invitation.email
    ) <>
      v_user_email
  then

    raise exception
      'This invitation belongs to another email address'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- EXISTING STAFF ROW
  -- ==========================================================

  select
    staff.id

  into
    v_existing_staff_id

  from public.staff_members
    as staff

  where
    staff.business_id =
      v_invitation.business_id

    and
    staff.user_id =
      v_user_id

  limit 1;


  -- ==========================================================
  -- ACTIVATE STAFF ACCESS
  -- ==========================================================

  if
    v_existing_staff_id
    is null
  then

    insert into public.staff_members (

      business_id,

      user_id,

      role,

      status

    )

    values (

      v_invitation.business_id,

      v_user_id,

      v_invitation.role,

      'active'::public.nova_staff_status

    );

  else

    update public.staff_members

    set

      role =
        v_invitation.role,

      status =
        'active'::public.nova_staff_status

    where
      id =
        v_existing_staff_id;

  end if;


  -- ==========================================================
  -- ACCEPT INVITATION
  -- ==========================================================

  update public.staff_invitations

  set

    status =
      'accepted',

    accepted_by_user_id =
      v_user_id,

    accepted_at =
      now(),

    revoked_at =
      null

  where
    id =
      p_invitation_id;


  return jsonb_build_object(

    'status',
    'accepted',

    'businessId',
    v_invitation.business_id,

    'role',
    v_invitation.role

  );

end;

$$;



-- ============================================================
-- PERMISSIONS
-- ============================================================

revoke all
on function
public.create_staff_invitation(
  uuid,
  text,
  public.nova_staff_role
)
from
  public,
  anon;


grant execute
on function
public.create_staff_invitation(
  uuid,
  text,
  public.nova_staff_role
)
to authenticated;



revoke all
on function
public.accept_staff_invitation(
  uuid
)
from
  public,
  anon;


grant execute
on function
public.accept_staff_invitation(
  uuid
)
to authenticated;



-- ============================================================
-- POSTGREST SCHEMA REFRESH
-- ============================================================

notify pgrst,
'reload schema';