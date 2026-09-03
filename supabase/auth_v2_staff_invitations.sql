-- ============================================================
-- NOVA POS
-- AUTH V2 — STAFF INVITATIONS
-- ============================================================


-- ============================================================
-- STAFF INVITATIONS
-- ============================================================

create table if not exists public.staff_invitations (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  email text not null,

  role public.nova_staff_role not null,

  status text not null
    default 'pending'
    check (
      status in (
        'pending',
        'accepted',
        'revoked',
        'expired'
      )
    ),

  invited_by_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  accepted_by_user_id uuid
    references auth.users(id)
    on delete set null,

  expires_at timestamptz not null
    default (
      now() +
      interval '24 hours'
    ),

  accepted_at timestamptz,

  revoked_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


create unique index if not exists
staff_invitations_pending_email_unique

on public.staff_invitations (
  business_id,
  lower(email)
)

where status = 'pending';


create index if not exists
staff_invitations_business_idx

on public.staff_invitations (
  business_id,
  created_at desc
);


create index if not exists
staff_invitations_email_idx

on public.staff_invitations (
  lower(email)
);


-- ============================================================
-- UPDATED AT
-- ============================================================

create or replace function
private.touch_staff_invitation_updated_at()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  new.updated_at :=
    now();

  return new;

end;

$$;


revoke all
on function
private.touch_staff_invitation_updated_at()
from public, anon, authenticated;


drop trigger if exists
nova_staff_invitation_updated_at
on public.staff_invitations;


create trigger
nova_staff_invitation_updated_at

before update

on public.staff_invitations

for each row

execute function
private.touch_staff_invitation_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table
public.staff_invitations
enable row level security;


revoke all
on public.staff_invitations
from anon;


revoke
  insert,
  update,
  delete
on public.staff_invitations
from authenticated;


grant select
on public.staff_invitations
to authenticated;


drop policy if exists
nova_staff_invitations_select
on public.staff_invitations;


create policy
nova_staff_invitations_select

on public.staff_invitations

for select

to authenticated

using (

  private.is_business_manager(
    business_id
  )

  or

  lower(email) =
    lower(
      coalesce(
        (
          select auth.jwt()
        )->>'email',
        ''
      )
    )

);


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

  v_existing_staff_id uuid;

  v_existing_staff_role
    public.nova_staff_role;

  v_invitation_id uuid;


begin

  -- ==========================================================
  -- AUTH
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


  -- Only owner can create managers.

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
  -- DOES AUTH USER ALREADY EXIST?
  -- ==========================================================

  select
    auth_user.id

  into
    v_existing_user_id

  from auth.users
    as auth_user

  where
    lower(
      auth_user.email
    ) =
      v_email

  limit 1;


  -- Cannot add the owner as staff.

  if
    v_existing_user_id =
      v_owner_user_id
  then

    raise exception
      'This email already belongs to the business owner';
  end if;


  -- ==========================================================
  -- EXISTING NOVA ACCOUNT
  -- ==========================================================

  if
    v_existing_user_id
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


    -- A manager cannot downgrade/change another manager.

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


    -- Clean up any old pending invitation.

    update public.staff_invitations

    set
      status =
        'accepted',

      accepted_by_user_id =
        v_existing_user_id,

      accepted_at =
        now()

    where
      business_id =
        p_business_id

      and
      lower(email) =
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
  -- NEW USER — CREATE PENDING INVITATION
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
    lower(email) =
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

  returning id

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
    p_role

  );

end;

$$;


-- ============================================================
-- ACCEPT INVITATION
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

  v_invitation
    public.staff_invitations%rowtype;

  v_existing_staff_id uuid;


begin

  if
    v_user_id
    is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  select
    lower(
      auth_user.email
    )

  into
    v_user_email

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


  -- Idempotent acceptance.

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


  if
    v_invitation.status <>
      'pending'
  then

    raise exception
      'This invitation is no longer active';
  end if;


  if
    v_invitation.expires_at <=
      now()
  then

    raise exception
      'This invitation has expired';
  end if;


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


  update public.staff_invitations

  set
    status =
      'accepted',

    accepted_by_user_id =
      v_user_id,

    accepted_at =
      now()

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
-- LIST BUSINESS INVITATIONS
-- ============================================================

create or replace function
public.list_staff_invitations(

  p_business_id uuid

)

returns table (

  id uuid,

  email text,

  role public.nova_staff_role,

  status text,

  expires_at timestamptz,

  created_at timestamptz

)

language plpgsql

security definer

set search_path = ''

as $$

begin

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


  return query

  select

    invitation.id,

    invitation.email,

    invitation.role,

    case

      when
        invitation.status =
          'pending'

        and

        invitation.expires_at <=
          now()

      then
        'expired'

      else
        invitation.status

    end,

    invitation.expires_at,

    invitation.created_at

  from public.staff_invitations
    as invitation

  where
    invitation.business_id =
      p_business_id

  order by
    invitation.created_at desc;

end;

$$;


-- ============================================================
-- MY PENDING INVITATIONS
-- ============================================================

create or replace function
public.get_my_pending_staff_invitations()

returns table (

  id uuid,

  business_id uuid,

  business_name text,

  email text,

  role public.nova_staff_role,

  expires_at timestamptz

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


  v_email text;


begin

  if
    v_user_id
    is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  select
    lower(
      auth_user.email
    )

  into
    v_email

  from auth.users
    as auth_user

  where
    auth_user.id =
      v_user_id;


  return query

  select

    invitation.id,

    invitation.business_id,

    business.name,

    invitation.email,

    invitation.role,

    invitation.expires_at

  from public.staff_invitations
    as invitation

  join public.businesses
    as business

    on business.id =
      invitation.business_id

  where
    invitation.status =
      'pending'

    and
    invitation.expires_at >
      now()

    and
    lower(
      invitation.email
    ) =
      v_email

  order by
    invitation.created_at desc;

end;

$$;


-- ============================================================
-- REVOKE INVITATION
-- ============================================================

create or replace function
public.revoke_staff_invitation(

  p_invitation_id uuid

)

returns void

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_invitation
    public.staff_invitations%rowtype;

  v_owner_user_id uuid;


begin

  select
    invitation.*

  into
    v_invitation

  from public.staff_invitations
    as invitation

  where
    invitation.id =
      p_invitation_id

  limit 1;


  if
    v_invitation.id
    is null
  then

    raise exception
      'Invitation not found';
  end if;


  if not (
    select private.is_business_manager(
      v_invitation.business_id
    )
  ) then

    raise exception
      'Manager access required'

      using errcode =
        '42501';

  end if;


  select
    business.owner_user_id

  into
    v_owner_user_id

  from public.businesses
    as business

  where
    business.id =
      v_invitation.business_id;


  if
    v_invitation.role =
      'manager'::public.nova_staff_role

    and

    v_user_id <>
      v_owner_user_id
  then

    raise exception
      'Only the owner can revoke a manager invitation'

      using errcode =
        '42501';

  end if;


  update public.staff_invitations

  set
    status =
      'revoked',

    revoked_at =
      now()

  where
    id =
      p_invitation_id

    and
    status =
      'pending';

end;

$$;


-- ============================================================
-- FUNCTION PERMISSIONS
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
public.accept_staff_invitation(uuid)
from
  public,
  anon;


grant execute
on function
public.accept_staff_invitation(uuid)
to authenticated;


revoke all
on function
public.list_staff_invitations(uuid)
from
  public,
  anon;


grant execute
on function
public.list_staff_invitations(uuid)
to authenticated;


revoke all
on function
public.get_my_pending_staff_invitations()
from
  public,
  anon;


grant execute
on function
public.get_my_pending_staff_invitations()
to authenticated;


revoke all
on function
public.revoke_staff_invitation(uuid)
from
  public,
  anon;


grant execute
on function
public.revoke_staff_invitation(uuid)
to authenticated;


notify pgrst,
'reload schema';