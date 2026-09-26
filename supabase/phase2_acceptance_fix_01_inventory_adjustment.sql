-- NOVA POS — Phase 2 acceptance fix 01
-- Fixes manual inventory Stock In / Stock Out adjustments.
--
-- Root cause:
-- adjust_inventory() is SECURITY INVOKER and authenticated users only have
-- UPDATE permission on inventory_levels.on_hand and low_stock_threshold.
-- The old function also explicitly updated updated_at, which is not granted.
-- The existing inventory_levels_set_updated_at trigger already maintains
-- updated_at, so the explicit column assignment is unnecessary.

create or replace function public.adjust_inventory(
  p_variant_id uuid,
  p_location_id uuid,
  p_delta integer,
  p_movement_type public.nova_inventory_movement_type,
  p_reason text default '',
  p_note text default ''
)
returns table (new_on_hand integer, movement_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_location_business_id uuid;
  v_before integer;
  v_after integer;
  v_movement_id uuid;
begin
  if p_delta = 0 then
    raise exception 'Inventory adjustment cannot be zero';
  end if;

  select pv.business_id
    into v_business_id
  from public.product_variants pv
  where pv.id = p_variant_id;

  if v_business_id is null then
    raise exception 'Variant not found';
  end if;

  select il.business_id
    into v_location_business_id
  from public.inventory_locations il
  where il.id = p_location_id;

  if v_location_business_id is distinct from v_business_id then
    raise exception 'Inventory location does not belong to this business';
  end if;

  if not (select private.is_business_manager(v_business_id)) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  insert into public.inventory_levels (
    business_id,
    location_id,
    variant_id,
    on_hand,
    low_stock_threshold
  )
  values (v_business_id, p_location_id, p_variant_id, 0, 5)
  on conflict (location_id, variant_id) do nothing;

  select level.on_hand
    into v_before
  from public.inventory_levels level
  where level.location_id = p_location_id
    and level.variant_id = p_variant_id
  for update;

  v_after := v_before + p_delta;

  if v_after < 0 then
    raise exception 'Insufficient stock: current %, change %', v_before, p_delta;
  end if;

  update public.inventory_levels
  set on_hand = v_after
  where location_id = p_location_id
    and variant_id = p_variant_id;

  insert into public.inventory_movements (
    business_id,
    location_id,
    variant_id,
    movement_type,
    quantity_delta,
    quantity_before,
    quantity_after,
    reason,
    note,
    actor_user_id
  )
  values (
    v_business_id,
    p_location_id,
    p_variant_id,
    p_movement_type,
    p_delta,
    v_before,
    v_after,
    coalesce(p_reason, ''),
    coalesce(p_note, ''),
    (select auth.uid())
  )
  returning id into v_movement_id;

  return query select v_after, v_movement_id;
end;
$$;

revoke all on function public.adjust_inventory(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text
) from public, anon;

grant execute on function public.adjust_inventory(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text
) to authenticated;

notify pgrst, 'reload schema';
