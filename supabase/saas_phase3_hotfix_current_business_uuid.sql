-- ============================================================
-- NOVA POS
-- HOTFIX — current_business_id() UUID aggregate
-- ============================================================
--
-- Fixes:
--   ERROR: function min(uuid) does not exist
--
-- Safe to run immediately on an existing NOVA database.
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

  v_business_ids uuid[];

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
    array_agg(
      id
    )

  into
    v_business_ids

  from accessible_businesses;


  v_business_count :=
    coalesce(
      cardinality(
        v_business_ids
      ),
      0
    );


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


  v_business_id :=
    v_business_ids[1];


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


notify pgrst,
'reload schema';
