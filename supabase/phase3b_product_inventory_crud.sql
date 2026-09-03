-- NOVA POS — Phase 3B Product + Variant + Inventory CRUD
-- Run AFTER phase2_catalog_inventory.sql and phase3a_auth_onboarding.sql.
-- Adds atomic catalog save RPCs plus a secure inventory-history read model.

create or replace function public.create_category(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_base_slug text;
  v_slug text;
  v_category_id uuid;
  v_suffix integer := 1;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Category name must be between 2 and 80 characters';
  end if;

  select b.id
    into v_business_id
  from public.businesses b
  where b.owner_user_id = v_user_id
     or exists (
       select 1
       from public.staff_members sm
       where sm.business_id = b.id
         and sm.user_id = v_user_id
         and sm.status = 'active'::public.nova_staff_status
         and sm.role = 'manager'::public.nova_staff_role
     )
  order by (b.owner_user_id = v_user_id) desc
  limit 1;

  if v_business_id is null then
    raise exception 'Manager business not found' using errcode = '42501';
  end if;

  if not (select private.is_business_manager(v_business_id)) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  v_base_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_base_slug = '' then
    v_base_slug := 'category';
  end if;
  v_slug := v_base_slug;

  while exists (
    select 1 from public.categories c
    where c.business_id = v_business_id and lower(c.slug) = lower(v_slug)
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  insert into public.categories (business_id, name, slug)
  values (v_business_id, v_name, v_slug)
  returning id into v_category_id;

  return v_category_id;
end;
$$;

revoke all on function public.create_category(text) from public, anon;
grant execute on function public.create_category(text) to authenticated;

comment on function public.create_category(text) is
  'Creates a category for the signed-in manager business and generates a unique slug.';

create or replace function public.save_product(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_image_url text,
  p_status public.nova_product_status,
  p_variants jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_business_id uuid;
  v_product_id uuid;
  v_location_id uuid;
  v_variant jsonb;
  v_variant_id uuid;
  v_existing_variant_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_variant_name text;
  v_sku text;
  v_price numeric(12,2);
  v_cost numeric(12,2);
  v_initial_stock integer;
  v_threshold integer;
  v_is_active boolean;
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if length(v_name) < 2 or length(v_name) > 160 then
    raise exception 'Product name must be between 2 and 160 characters';
  end if;

  if p_variants is null or jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) = 0 then
    raise exception 'At least one product variant is required';
  end if;

  select b.id
    into v_business_id
  from public.businesses b
  where b.owner_user_id = v_user_id
     or exists (
       select 1
       from public.staff_members sm
       where sm.business_id = b.id
         and sm.user_id = v_user_id
         and sm.status = 'active'::public.nova_staff_status
         and sm.role = 'manager'::public.nova_staff_role
     )
  order by (b.owner_user_id = v_user_id) desc
  limit 1;

  if v_business_id is null or not (select private.is_business_manager(v_business_id)) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  select il.id
    into v_location_id
  from public.inventory_locations il
  where il.business_id = v_business_id
    and il.is_default = true
    and il.is_active = true
  limit 1;

  if v_location_id is null then
    raise exception 'Default inventory location is missing';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.categories c
    where c.id = p_category_id and c.business_id = v_business_id
  ) then
    raise exception 'Category does not belong to this business';
  end if;

  if p_product_id is null then
    insert into public.products (
      business_id, category_id, name, description, image_url, status
    )
    values (
      v_business_id,
      p_category_id,
      v_name,
      coalesce(p_description, ''),
      nullif(trim(coalesce(p_image_url, '')), ''),
      coalesce(p_status, 'active'::public.nova_product_status)
    )
    returning id into v_product_id;
  else
    select p.id into v_product_id
    from public.products p
    where p.id = p_product_id and p.business_id = v_business_id;

    if v_product_id is null then
      raise exception 'Product not found';
    end if;

    update public.products
    set category_id = p_category_id,
        name = v_name,
        description = coalesce(p_description, ''),
        image_url = nullif(trim(coalesce(p_image_url, '')), ''),
        status = coalesce(p_status, 'active'::public.nova_product_status)
    where id = v_product_id and business_id = v_business_id;
  end if;

  -- Detect duplicate SKU values inside the submitted payload before touching variants.
  select count(*) into v_count
  from (
    select lower(trim(item->>'sku')) as sku
    from jsonb_array_elements(p_variants) item
    group by lower(trim(item->>'sku'))
    having count(*) > 1
  ) duplicates;

  if v_count > 0 then
    raise exception 'Variant SKUs must be unique';
  end if;

  for v_variant in select value from jsonb_array_elements(p_variants)
  loop
    v_variant_name := trim(coalesce(v_variant->>'name', 'Standard'));
    v_sku := upper(trim(coalesce(v_variant->>'sku', '')));
    v_price := coalesce((v_variant->>'price')::numeric, 0);
    v_cost := coalesce((v_variant->>'cost')::numeric, 0);
    v_initial_stock := coalesce((v_variant->>'initial_stock')::integer, 0);
    v_threshold := coalesce((v_variant->>'low_stock_threshold')::integer, 5);
    v_is_active := coalesce((v_variant->>'is_active')::boolean, true);

    if length(v_variant_name) = 0 then
      raise exception 'Variant name is required';
    end if;
    if length(v_sku) = 0 then
      raise exception 'Every variant needs a SKU';
    end if;
    if v_price < 0 or v_cost < 0 then
      raise exception 'Price and cost cannot be negative';
    end if;
    if v_initial_stock < 0 or v_threshold < 0 then
      raise exception 'Stock values cannot be negative';
    end if;

    v_existing_variant_id := nullif(v_variant->>'id', '')::uuid;

    if v_existing_variant_id is null then
      insert into public.product_variants (
        business_id, product_id, name, sku, price, cost, is_active
      )
      values (
        v_business_id, v_product_id, v_variant_name, v_sku, v_price, v_cost, v_is_active
      )
      returning id into v_variant_id;

      insert into public.inventory_levels (
        business_id, location_id, variant_id, on_hand, low_stock_threshold
      )
      values (
        v_business_id, v_location_id, v_variant_id, v_initial_stock, v_threshold
      );

      if v_initial_stock > 0 then
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
          v_location_id,
          v_variant_id,
          'stock_in'::public.nova_inventory_movement_type,
          v_initial_stock,
          0,
          v_initial_stock,
          'Initial stock',
          'Created with product',
          v_user_id
        );
      end if;
    else
      if not exists (
        select 1
        from public.product_variants pv
        where pv.id = v_existing_variant_id
          and pv.product_id = v_product_id
          and pv.business_id = v_business_id
      ) then
        raise exception 'Variant does not belong to this product';
      end if;

      update public.product_variants
      set name = v_variant_name,
          sku = v_sku,
          price = v_price,
          cost = v_cost,
          is_active = v_is_active
      where id = v_existing_variant_id
        and product_id = v_product_id
        and business_id = v_business_id;

      update public.inventory_levels
      set low_stock_threshold = v_threshold
      where location_id = v_location_id
        and variant_id = v_existing_variant_id
        and business_id = v_business_id;
    end if;
  end loop;

  return v_product_id;
end;
$$;

revoke all on function public.save_product(uuid, text, text, uuid, text, public.nova_product_status, jsonb) from public, anon;
grant execute on function public.save_product(uuid, text, text, uuid, text, public.nova_product_status, jsonb) to authenticated;

comment on function public.save_product(uuid, text, text, uuid, text, public.nova_product_status, jsonb) is
  'Atomically creates/updates a product and variants. New variants receive a permanent QR token, inventory level and initial stock movement.';

create or replace view public.inventory_movement_details
with (security_invoker = true)
as
select
  m.id,
  m.business_id,
  m.location_id,
  loc.name as location_name,
  m.variant_id,
  pv.product_id,
  p.name as product_name,
  pv.name as variant_name,
  pv.sku,
  m.movement_type,
  m.quantity_delta,
  m.quantity_before,
  m.quantity_after,
  m.reason,
  m.note,
  m.actor_user_id,
  m.created_at
from public.inventory_movements m
join public.inventory_locations loc
  on loc.id = m.location_id and loc.business_id = m.business_id
join public.product_variants pv
  on pv.id = m.variant_id and pv.business_id = m.business_id
join public.products p
  on p.id = pv.product_id and p.business_id = m.business_id;

revoke all on public.inventory_movement_details from anon, authenticated;
grant select on public.inventory_movement_details to authenticated;

comment on view public.inventory_movement_details is
  'RLS-respecting inventory movement history enriched with product, variant, SKU and location names.';
