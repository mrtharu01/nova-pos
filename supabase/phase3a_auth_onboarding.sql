-- NOVA POS — Phase 3A Auth + owner onboarding patch
-- Run AFTER phase2_catalog_inventory.sql.
-- Safe to run before the first business has been created.

-- NOVA currently models one owner workspace per auth user. Staff membership can
-- still be added separately later.
create unique index if not exists businesses_owner_user_id_unique_idx
  on public.businesses (owner_user_id);

-- Replace the Phase 2 one-argument bootstrap with the Phase 3A onboarding RPC.
drop function if exists public.bootstrap_business(text);

create or replace function public.bootstrap_business(
  p_name text,
  p_currency_code text,
  p_timezone text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_business_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Business name is required';
  end if;

  if upper(trim(coalesce(p_currency_code, ''))) !~ '^[A-Z]{3}$' then
    raise exception 'Currency code must contain exactly three letters';
  end if;

  if length(trim(coalesce(p_timezone, ''))) = 0 then
    raise exception 'Timezone is required';
  end if;

  if exists (
    select 1 from public.businesses b where b.owner_user_id = v_user_id
  ) then
    raise exception 'This account already owns a NOVA business';
  end if;

  insert into public.businesses (
    name,
    currency_code,
    timezone,
    owner_user_id
  )
  values (
    trim(p_name),
    upper(trim(p_currency_code)),
    trim(p_timezone),
    v_user_id
  )
  returning id into v_business_id;

  -- Keep an explicit manager membership row for staff UI/auditing while the
  -- businesses.owner_user_id field remains the source of owner authority.
  insert into public.staff_members (business_id, user_id, role, status)
  values (
    v_business_id,
    v_user_id,
    'manager'::public.nova_staff_role,
    'active'::public.nova_staff_status
  );

  insert into public.inventory_locations (
    business_id,
    name,
    code,
    is_default,
    is_active
  )
  values (v_business_id, 'Main', 'MAIN', true, true);

  return v_business_id;
end;
$$;

revoke all on function public.bootstrap_business(text, text, text) from public, anon;
grant execute on function public.bootstrap_business(text, text, text) to authenticated;

comment on function public.bootstrap_business(text, text, text) is
  'Creates the signed-in user''s first NOVA business, explicit manager staff membership, and default Main inventory location atomically.';
