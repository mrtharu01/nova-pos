-- ============================================================
-- NOVA POS
-- SaaS Phase 4A — Platform administrator management
-- ============================================================
--
-- Extends the existing hidden NOVA Control foundation with:
--   • owner-only platform-admin management
--   • list/add/change-role/remove RPCs
--   • last-owner protection
--   • audit logging for every mutation
--
-- Admin accounts must already exist as confirmed Supabase Auth
-- users. Creating/inviting platform accounts is intentionally
-- kept separate from the browser-facing control plane.
-- ============================================================


-- ============================================================
-- 1. OWNER CHECK
-- ============================================================

create or replace function
private.is_platform_owner()

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
        platform_admin.role =
          'owner'::public.nova_platform_admin_role

    );

$$;


revoke all
on function
private.is_platform_owner()
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 2. LIST PLATFORM ADMINS
-- ============================================================

create or replace function
public.list_platform_admins()

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
          'userId',
          platform_admin.user_id,

          'email',
          auth_user.email,

          'role',
          platform_admin.role::text,

          'createdAt',
          platform_admin.created_at,

          'createdByUserId',
          platform_admin.created_by_user_id
        )
        order by
          case
            when platform_admin.role =
              'owner'::public.nova_platform_admin_role
            then 0
            when platform_admin.role =
              'admin'::public.nova_platform_admin_role
            then 1
            else 2
          end,
          platform_admin.created_at asc
      ),
      '[]'::jsonb
    )

  into
    v_result

  from public.platform_admins
    as platform_admin

  join auth.users
    as auth_user

    on
      auth_user.id =
        platform_admin.user_id;


  return
    v_result;

end;

$$;


revoke all
on function
public.list_platform_admins()
from
  public,
  anon;


grant execute
on function
public.list_platform_admins()
to authenticated;



-- ============================================================
-- 3. ADD EXISTING AUTH USER AS PLATFORM ADMIN
-- ============================================================

create or replace function
public.add_platform_admin(
  p_email text,
  p_role text
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
      btrim(
        coalesce(
          p_email,
          ''
        )
      )
    );

  v_role public.nova_platform_admin_role;

  v_user_id uuid;

begin

  if not (
    select private.is_platform_owner()
  )
  then

    raise exception
      'Platform owner access required'
      using errcode =
        '42501';

  end if;


  if
    v_email = ''
  then

    raise exception
      'Email is required';

  end if;


  if
    lower(
      btrim(
        coalesce(
          p_role,
          ''
        )
      )
    ) not in (
      'owner',
      'admin',
      'support'
    )
  then

    raise exception
      'Invalid platform administrator role';

  end if;


  v_role :=
    lower(
      btrim(
        p_role
      )
    )::public.nova_platform_admin_role;


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


  if exists (

    select
      1

    from public.platform_admins
      as platform_admin

    where
      platform_admin.user_id =
        v_user_id

  )
  then

    raise exception
      'That account is already a platform administrator';

  end if;


  insert into public.platform_admins (
    user_id,
    role,
    created_by_user_id
  )

  values (
    v_user_id,
    v_role,
    v_actor_user_id
  );


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    metadata
  )

  values (
    v_actor_user_id,
    'platform_admin_added',
    jsonb_build_object(
      'userId',
      v_user_id,
      'email',
      v_email,
      'role',
      v_role::text
    )
  );


  return
    jsonb_build_object(
      'ok',
      true,
      'userId',
      v_user_id,
      'email',
      v_email,
      'role',
      v_role::text
    );

end;

$$;


revoke all
on function
public.add_platform_admin(
  text,
  text
)
from
  public,
  anon;


grant execute
on function
public.add_platform_admin(
  text,
  text
)
to authenticated;



-- ============================================================
-- 4. CHANGE PLATFORM ADMIN ROLE
-- ============================================================

create or replace function
public.set_platform_admin_role(
  p_user_id uuid,
  p_role text
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

  v_role public.nova_platform_admin_role;

  v_old_role public.nova_platform_admin_role;

  v_email text;

  v_owner_count integer;

begin

  if not (
    select private.is_platform_owner()
  )
  then

    raise exception
      'Platform owner access required'
      using errcode =
        '42501';

  end if;


  if
    p_user_id is null
  then

    raise exception
      'Platform administrator user id is required';

  end if;


  if
    lower(
      btrim(
        coalesce(
          p_role,
          ''
        )
      )
    ) not in (
      'owner',
      'admin',
      'support'
    )
  then

    raise exception
      'Invalid platform administrator role';

  end if;


  v_role :=
    lower(
      btrim(
        p_role
      )
    )::public.nova_platform_admin_role;


  select
    platform_admin.role,
    auth_user.email

  into
    v_old_role,
    v_email

  from public.platform_admins
    as platform_admin

  join auth.users
    as auth_user

    on
      auth_user.id =
        platform_admin.user_id

  where
    platform_admin.user_id =
      p_user_id;


  if
    v_old_role is null
  then

    raise exception
      'Platform administrator was not found';

  end if;


  if
    v_old_role =
      'owner'::public.nova_platform_admin_role

    and
    v_role <>
      'owner'::public.nova_platform_admin_role
  then

    select
      count(*)::integer

    into
      v_owner_count

    from public.platform_admins
      as platform_admin

    where
      platform_admin.role =
        'owner'::public.nova_platform_admin_role;


    if
      v_owner_count <= 1
    then

      raise exception
        'NOVA must keep at least one Platform Owner';

    end if;

  end if;


  update public.platform_admins

  set
    role =
      v_role

  where
    user_id =
      p_user_id;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    metadata
  )

  values (
    v_actor_user_id,
    'platform_admin_role_changed',
    jsonb_build_object(
      'userId',
      p_user_id,
      'email',
      v_email,
      'previousRole',
      v_old_role::text,
      'role',
      v_role::text
    )
  );


  return
    jsonb_build_object(
      'ok',
      true,
      'userId',
      p_user_id,
      'email',
      v_email,
      'role',
      v_role::text
    );

end;

$$;


revoke all
on function
public.set_platform_admin_role(
  uuid,
  text
)
from
  public,
  anon;


grant execute
on function
public.set_platform_admin_role(
  uuid,
  text
)
to authenticated;



-- ============================================================
-- 5. REMOVE PLATFORM ADMIN
-- ============================================================

create or replace function
public.remove_platform_admin(
  p_user_id uuid
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

  v_role public.nova_platform_admin_role;

  v_email text;

  v_owner_count integer;

begin

  if not (
    select private.is_platform_owner()
  )
  then

    raise exception
      'Platform owner access required'
      using errcode =
        '42501';

  end if;


  if
    p_user_id is null
  then

    raise exception
      'Platform administrator user id is required';

  end if;


  select
    platform_admin.role,
    auth_user.email

  into
    v_role,
    v_email

  from public.platform_admins
    as platform_admin

  join auth.users
    as auth_user

    on
      auth_user.id =
        platform_admin.user_id

  where
    platform_admin.user_id =
      p_user_id;


  if
    v_role is null
  then

    raise exception
      'Platform administrator was not found';

  end if;


  if
    v_role =
      'owner'::public.nova_platform_admin_role
  then

    select
      count(*)::integer

    into
      v_owner_count

    from public.platform_admins
      as platform_admin

    where
      platform_admin.role =
        'owner'::public.nova_platform_admin_role;


    if
      v_owner_count <= 1
    then

      raise exception
        'NOVA must keep at least one Platform Owner';

    end if;

  end if;


  delete from public.platform_admins

  where
    user_id =
      p_user_id;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    metadata
  )

  values (
    v_actor_user_id,
    'platform_admin_removed',
    jsonb_build_object(
      'userId',
      p_user_id,
      'email',
      v_email,
      'role',
      v_role::text
    )
  );


  return
    jsonb_build_object(
      'ok',
      true,
      'userId',
      p_user_id
    );

end;

$$;


revoke all
on function
public.remove_platform_admin(uuid)
from
  public,
  anon;


grant execute
on function
public.remove_platform_admin(uuid)
to authenticated;


notify pgrst,
'reload schema';
