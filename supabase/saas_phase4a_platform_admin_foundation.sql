-- ============================================================
-- NOVA POS
-- SaaS Phase 4A — Platform admin foundation
-- ============================================================
--
-- This is the NOVA operator control plane.
-- It is separate from each shop/business admin experience.
--
-- Phase 4A intentionally does NOT mutate subscriptions yet.
-- Phase 4B will connect Starter / Pro / Business package
-- management and complimentary billing overrides.
-- ============================================================


-- ============================================================
-- 1. PLATFORM ADMIN ROLE
-- ============================================================

do $$
begin
  create type
    public.nova_platform_admin_role
  as enum (
    'owner',
    'admin',
    'support'
  );
exception
  when duplicate_object
  then null;
end;
$$;



-- ============================================================
-- 2. PLATFORM ADMINS
-- ============================================================

create table if not exists
public.platform_admins (

  user_id uuid
    primary key
    references auth.users(id)
    on delete cascade,

  role public.nova_platform_admin_role
    not null
    default 'admin',

  created_at timestamptz
    not null
    default now(),

  created_by_user_id uuid
    references auth.users(id)
    on delete set null

);


alter table
public.platform_admins
enable row level security;


revoke all
on public.platform_admins
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 3. PLATFORM ADMIN AUDIT LOG
-- ============================================================

create table if not exists
public.platform_admin_audit_log (

  id uuid
    primary key
    default gen_random_uuid(),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  action text
    not null,

  target_business_id uuid
    references public.businesses(id)
    on delete set null,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint
    platform_admin_audit_action_not_blank
    check (
      btrim(
        action
      ) <> ''
    ),

  constraint
    platform_admin_audit_metadata_object
    check (
      jsonb_typeof(
        metadata
      ) =
        'object'
    )

);


create index if not exists
platform_admin_audit_created_at_idx

on public.platform_admin_audit_log (
  created_at desc
);


create index if not exists
platform_admin_audit_target_business_idx

on public.platform_admin_audit_log (
  target_business_id,
  created_at desc
);


alter table
public.platform_admin_audit_log
enable row level security;


revoke all
on public.platform_admin_audit_log
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 4. INTERNAL ADMIN CHECK
-- ============================================================

create or replace function
private.is_platform_admin()

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

    );

$$;


revoke all
on function
private.is_platform_admin()
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 5. ONE-TIME OWNER BOOTSTRAP
--
-- SQL Editor only.
--
-- Example:
--
-- select private.bootstrap_platform_owner(
--   'you@example.com'
-- );
--
-- Once one platform admin exists, this bootstrap permanently
-- closes. Future platform-admin management will go through
-- audited admin tooling.
-- ============================================================

create or replace function
private.bootstrap_platform_owner(
  p_email text
)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_email text :=
    lower(
      btrim(
        coalesce(
          p_email,
          ''
        )
      )
    );

  v_user_id uuid;

begin

  if
    v_email = ''
  then

    raise exception
      'Platform owner email is required';

  end if;


  if exists (

    select
      1

    from public.platform_admins

  )
  then

    raise exception
      'Platform owner bootstrap is already closed';

  end if;


  select
    auth_user.id

  into
    v_user_id

  from auth.users
    as auth_user

  where
    lower(
      auth_user.email
    ) =
      v_email

    and
    auth_user.email_confirmed_at
      is not null

  order by
    auth_user.created_at asc

  limit 1;


  if
    v_user_id is null
  then

    raise exception
      'A confirmed NOVA account with that email was not found';

  end if;


  insert into public.platform_admins (
    user_id,
    role,
    created_by_user_id
  )

  values (
    v_user_id,
    'owner'::public.nova_platform_admin_role,
    v_user_id
  );


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    metadata
  )

  values (
    v_user_id,
    'platform_owner_bootstrapped',
    jsonb_build_object(
      'email',
      v_email
    )
  );


  return
    v_user_id;

end;

$$;


revoke all
on function
private.bootstrap_platform_owner(text)
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 6. CURRENT PLATFORM ADMIN ACCESS
-- ============================================================

create or replace function
public.get_my_platform_admin_access()

returns jsonb

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

  v_role text;

begin

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'
      using errcode =
        '42501';

  end if;


  select
    platform_admin.role::text

  into
    v_role

  from public.platform_admins
    as platform_admin

  where
    platform_admin.user_id =
      v_user_id;


  return
    jsonb_build_object(
      'isPlatformAdmin',
      v_role is not null,
      'userId',
      v_user_id,
      'role',
      v_role
    );

end;

$$;


revoke all
on function
public.get_my_platform_admin_access()
from
  public,
  anon;


grant execute
on function
public.get_my_platform_admin_access()
to authenticated;



-- ============================================================
-- 7. PLATFORM OVERVIEW
-- ============================================================

create or replace function
public.get_platform_admin_overview()

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_business_count bigint;

  v_active_staff_count bigint;

  v_platform_admin_count bigint;

  v_businesses_last_30_days bigint;

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
    count(*)

  into
    v_business_count

  from public.businesses;


  select
    count(*)

  into
    v_active_staff_count

  from public.staff_members
    as staff

  where
    staff.status =
      'active'::public.nova_staff_status;


  select
    count(*)

  into
    v_platform_admin_count

  from public.platform_admins;


  select
    count(*)

  into
    v_businesses_last_30_days

  from public.businesses
    as business

  where
    business.created_at >=
      now() -
      interval '30 days';


  return
    jsonb_build_object(

      'businessCount',
      v_business_count,

      'activeStaffCount',
      v_active_staff_count,

      'platformAdminCount',
      v_platform_admin_count,

      'businessesLast30Days',
      v_businesses_last_30_days

    );

end;

$$;


revoke all
on function
public.get_platform_admin_overview()
from
  public,
  anon;


grant execute
on function
public.get_platform_admin_overview()
to authenticated;



-- ============================================================
-- 8. TENANT DIRECTORY
-- ============================================================

create or replace function
public.list_platform_businesses(

  p_search text
    default '',

  p_limit integer
    default 100

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
          100
        ),
        250
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

          'id',
          business_record.id,

          'name',
          business_record.name,

          'ownerUserId',
          business_record.owner_user_id,

          'ownerEmail',
          business_record.owner_email,

          'currencyCode',
          business_record.currency_code,

          'timezone',
          business_record.timezone,

          'staffCount',
          business_record.staff_count,

          'createdAt',
          business_record.created_at

        )

        order by
          business_record.created_at desc

      ),

      '[]'::jsonb

    )

  into
    v_result

  from (

    select

      business.id,

      business.name,

      business.owner_user_id,

      owner_user.email::text
        as owner_email,

      business.currency_code,

      business.timezone,

      business.created_at,

      (
        select
          count(*)::integer

        from public.staff_members
          as staff

        where
          staff.business_id =
            business.id

          and
          staff.status =
            'active'::public.nova_staff_status

      )
        as staff_count

    from public.businesses
      as business

    join auth.users
      as owner_user

      on
        owner_user.id =
          business.owner_user_id

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
          owner_user.email,
          ''
        )
      ) like
        '%' ||
        v_search ||
        '%'

    order by
      business.created_at desc

    limit
      v_limit

  )
    as business_record;


  return
    v_result;

end;

$$;


revoke all
on function
public.list_platform_businesses(
  text,
  integer
)
from
  public,
  anon;


grant execute
on function
public.list_platform_businesses(
  text,
  integer
)
to authenticated;



-- ============================================================
-- 9. AUDIT LOG READER
-- ============================================================

create or replace function
public.list_platform_admin_audit(
  p_limit integer
    default 100
)

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(
          p_limit,
          100
        ),
        250
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

          'id',
          audit_record.id,

          'actorUserId',
          audit_record.actor_user_id,

          'actorEmail',
          audit_record.actor_email,

          'action',
          audit_record.action,

          'targetBusinessId',
          audit_record.target_business_id,

          'targetBusinessName',
          audit_record.target_business_name,

          'metadata',
          audit_record.metadata,

          'createdAt',
          audit_record.created_at

        )

        order by
          audit_record.created_at desc

      ),

      '[]'::jsonb

    )

  into
    v_result

  from (

    select

      audit.id,

      audit.actor_user_id,

      actor_user.email::text
        as actor_email,

      audit.action,

      audit.target_business_id,

      business.name
        as target_business_name,

      audit.metadata,

      audit.created_at

    from public.platform_admin_audit_log
      as audit

    left join auth.users
      as actor_user

      on
        actor_user.id =
          audit.actor_user_id

    left join public.businesses
      as business

      on
        business.id =
          audit.target_business_id

    order by
      audit.created_at desc

    limit
      v_limit

  )
    as audit_record;


  return
    v_result;

end;

$$;


revoke all
on function
public.list_platform_admin_audit(integer)
from
  public,
  anon;


grant execute
on function
public.list_platform_admin_audit(integer)
to authenticated;


notify pgrst,
'reload schema';
