-- ============================================================
-- NOVA POS
-- SaaS Phase 3F.2 — Access RPC tenant hardening
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
      using errcode =
        '42501';

  end if;


  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'You do not have active access to this business'
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
      p_business_id;


  if
    v_owner_user_id is null
  then

    raise exception
      'Business not found';

  end if;


  v_is_owner :=
    v_owner_user_id =
      v_user_id;


  if
    v_is_owner
  then

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
      v_status <>
        'active'
    )

  then

    raise exception
      'You do not have active access to this business'
      using errcode =
        '42501';

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
        v_role =
          'manager'
      ),

      'manageInventory',
      (
        v_is_owner
        or
        v_role =
          'manager'
      ),

      'viewReports',
      (
        v_is_owner
        or
        v_role =
          'manager'
      ),

      'manageSettings',
      (
        v_is_owner
        or
        v_role =
          'manager'
      ),

      'manageStaff',
      (
        v_is_owner
        or
        v_role =
          'manager'
      ),

      'manageManagers',
      v_is_owner,

      'refundSales',
      (
        v_is_owner
        or
        v_role =
          'manager'
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


notify pgrst,
'reload schema';
