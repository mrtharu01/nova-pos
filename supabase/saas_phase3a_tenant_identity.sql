-- ============================================================
-- NOVA POS
-- SaaS Phase 3A — Tenant identity foundation
-- ============================================================
--
-- Goal:
--   Resolve the signed-in user's active NOVA business in the
--   database instead of trusting a browser-provided business id.
--
-- Current product rule:
--   one active business per account.
--
-- If an account is linked to more than one active business,
-- NOVA fails closed until a deliberate business-switching UX is
-- introduced in the commercial SaaS phase.
-- ============================================================

create or replace function
private.current_business_id()

returns uuid

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

  v_business_id uuid;

  v_business_count integer := 0;

begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  with accessible_businesses as (

    select
      business.id

    from public.businesses
      as business

    where
      business.owner_user_id =
        v_user_id


    union


    select
      staff.business_id

    from public.staff_members
      as staff

    where
      staff.user_id =
        v_user_id

      and
      staff.status =
        'active'::public.nova_staff_status

  )

  select
    count(*)::integer,
    min(id)

  into
    v_business_count,
    v_business_id

  from accessible_businesses;


  if
    v_business_count = 0
  then
    return null;
  end if;


  if
    v_business_count > 1
  then
    raise exception
      'This account is linked to multiple active businesses. Business switching is not enabled yet.'
      using errcode = '42501';
  end if;


  return
    v_business_id;

end;

$$;


revoke all
on function
private.current_business_id()
from public,
anon,
authenticated;



create or replace function
public.get_my_current_business()

returns table (

  id uuid,

  name text,

  currency_code varchar(3),

  timezone text

)

language plpgsql

stable

security definer

set search_path = ''

as $$

declare
  v_business_id uuid;

begin

  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null
  then
    return;
  end if;


  return query

  select
    business.id,
    business.name,
    business.currency_code,
    business.timezone

  from public.businesses
    as business

  where
    business.id =
      v_business_id;

end;

$$;


revoke all
on function
public.get_my_current_business()
from public,
anon;


grant execute
on function
public.get_my_current_business()
to authenticated;


comment on function
public.get_my_current_business()
is
  'Returns the single active NOVA business for the authenticated account. Fails closed when multiple active businesses are linked until explicit tenant switching exists.';


notify pgrst,
'reload schema';
