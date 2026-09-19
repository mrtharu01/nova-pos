-- ============================================================
-- NOVA POS — PHASE 5B PRODUCT PROMOTIONS
-- ============================================================
-- Manual temporary promotions configured from Products.
-- Checkout remains authoritative because the database stores the
-- current effective price while preserving the normal price.
-- ============================================================

alter table public.products
  add column if not exists promotion_enabled boolean not null default false,
  add column if not exists promotion_type text not null default 'percentage',
  add column if not exists promotion_value numeric(12,2) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'products_promotion_type_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_promotion_type_check
      check (promotion_type in ('percentage', 'fixed'));
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'products_promotion_value_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_promotion_value_check
      check (promotion_value >= 0);
  end if;
end;
$$;

alter table public.product_variants
  add column if not exists regular_price numeric(12,2);

update public.product_variants
set regular_price = price
where regular_price is null;

alter table public.product_variants
  alter column regular_price set default 0,
  alter column regular_price set not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'product_variants_regular_price_check'
      and conrelid = 'public.product_variants'::regclass
  ) then
    alter table public.product_variants
      add constraint product_variants_regular_price_check
      check (regular_price >= 0);
  end if;
end;
$$;

alter table public.sale_items
  add column if not exists regular_unit_price numeric(12,2);

update public.sale_items
set regular_unit_price = unit_price
where regular_unit_price is null;

alter table public.sale_items
  alter column regular_unit_price set default 0,
  alter column regular_unit_price set not null;

alter table public.sale_items
  add column if not exists product_discount_total numeric(12,2) not null default 0;

alter table public.sales
  add column if not exists product_discount_total numeric(12,2) not null default 0;

create or replace function private.nova_promotional_price(
  p_regular_price numeric,
  p_promotion_type text,
  p_promotion_value numeric
)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select round(
    greatest(
      0,
      case
        when p_promotion_type = 'percentage'
          then coalesce(p_regular_price, 0)
            * (100 - coalesce(p_promotion_value, 0)) / 100
        when p_promotion_type = 'fixed'
          then coalesce(p_regular_price, 0) - coalesce(p_promotion_value, 0)
        else coalesce(p_regular_price, 0)
      end
    ),
    2
  );
$$;

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
  v_effective_price numeric(12,2);
  v_cost numeric(12,2);
  v_promotion_enabled boolean := false;
  v_promotion_type text := 'percentage';
  v_promotion_value numeric(12,2) := 0;
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

  select
    p.promotion_enabled,
    p.promotion_type,
    p.promotion_value
  into
    v_promotion_enabled,
    v_promotion_type,
    v_promotion_value
  from public.products p
  where p.id = v_product_id
    and p.business_id = v_business_id;

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

    v_effective_price :=
      case
        when v_promotion_enabled
          then private.nova_promotional_price(
            v_price,
            v_promotion_type,
            v_promotion_value
          )
        else v_price
      end;

    if v_is_active and v_effective_price <= 0 then
      raise exception 'Promotion cannot reduce an active variant price to zero';
    end if;

    v_existing_variant_id := nullif(v_variant->>'id', '')::uuid;

    if v_existing_variant_id is null then
      insert into public.product_variants (
        business_id, product_id, name, sku, price, regular_price, cost, is_active
      )
      values (
        v_business_id, v_product_id, v_variant_name, v_sku, v_effective_price, v_price, v_cost, v_is_active
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
          price = v_effective_price,
          regular_price = v_price,
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

create or replace function public.set_product_promotion(
  p_product_id uuid,
  p_enabled boolean,
  p_type text,
  p_value numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_type text := lower(btrim(coalesce(p_type, 'percentage')));
  v_value numeric(12,2) := round(greatest(coalesce(p_value, 0), 0), 2);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select p.business_id
  into v_business_id
  from public.products p
  where p.id = p_product_id
  for update;

  if v_business_id is null then
    raise exception 'Product not found';
  end if;

  if not (select private.is_business_manager(v_business_id)) then
    raise exception 'Manager access required' using errcode = '42501';
  end if;

  if v_type not in ('percentage', 'fixed') then
    raise exception 'Promotion type must be percentage or fixed';
  end if;

  if coalesce(p_enabled, false) then
    if v_value <= 0 then
      raise exception 'Promotion value must be greater than zero';
    end if;

    if v_type = 'percentage' and v_value >= 100 then
      raise exception 'Percentage promotion must be less than 100%%';
    end if;

    if v_type = 'fixed' and exists (
      select 1
      from public.product_variants pv
      where pv.product_id = p_product_id
        and pv.business_id = v_business_id
        and pv.is_active = true
        and v_value >= pv.regular_price
    ) then
      raise exception 'Fixed promotion must be lower than every active variant price';
    end if;
  end if;

  update public.products
  set
    promotion_enabled = coalesce(p_enabled, false),
    promotion_type = v_type,
    promotion_value = v_value,
    updated_at = now()
  where id = p_product_id
    and business_id = v_business_id;

  update public.product_variants
  set
    price = case
      when coalesce(p_enabled, false)
        then private.nova_promotional_price(regular_price, v_type, v_value)
      else regular_price
    end,
    updated_at = now()
  where product_id = p_product_id
    and business_id = v_business_id;
end;
$$;

revoke all on function public.set_product_promotion(uuid, boolean, text, numeric)
from public, anon;
grant execute on function public.set_product_promotion(uuid, boolean, text, numeric)
to authenticated;

create or replace function private.snapshot_sale_item_product_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regular_price numeric(12,2);
begin
  select pv.regular_price
  into v_regular_price
  from public.product_variants pv
  where pv.id = new.variant_id
    and pv.business_id = new.business_id;

  new.regular_unit_price := coalesce(v_regular_price, new.unit_price);
  new.product_discount_total := round(
    greatest(new.regular_unit_price - new.unit_price, 0) * new.quantity,
    2
  );

  return new;
end;
$$;

drop trigger if exists sale_items_snapshot_product_promotion
on public.sale_items;

create trigger sale_items_snapshot_product_promotion
before insert on public.sale_items
for each row execute function private.snapshot_sale_item_product_promotion();

create or replace function private.refresh_sale_product_discount_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_business_id uuid;
begin
  if tg_op = 'DELETE' then
    v_sale_id := old.sale_id;
    v_business_id := old.business_id;
  else
    v_sale_id := new.sale_id;
    v_business_id := new.business_id;
  end if;

  update public.sales s
  set product_discount_total = (
    select coalesce(sum(si.product_discount_total), 0)
    from public.sale_items si
    where si.sale_id = v_sale_id
      and si.business_id = v_business_id
  )
  where s.id = v_sale_id
    and s.business_id = v_business_id;

  return null;
end;
$$;

drop trigger if exists sale_items_refresh_product_discount_total
on public.sale_items;

create trigger sale_items_refresh_product_discount_total
after insert or update of product_discount_total or delete
on public.sale_items
for each row execute function private.refresh_sale_product_discount_total();

create or replace view public.catalog_variant_inventory
with (security_invoker = true)
as
select
  p.business_id,
  p.id as product_id,
  p.name as product_name,
  p.description,
  p.image_url,
  p.status as product_status,
  c.id as category_id,
  c.name as category_name,
  pv.id as variant_id,
  pv.name as variant_name,
  pv.sku,
  pv.qr_token,
  pv.price,
  pv.cost,
  pv.is_active,
  loc.id as location_id,
  coalesce(level.on_hand, 0) as stock,
  coalesce(level.low_stock_threshold, 5) as low_stock_threshold,
  pv.regular_price,
  p.promotion_enabled,
  p.promotion_type,
  p.promotion_value
from public.products p
join public.product_variants pv
  on pv.product_id = p.id
 and pv.business_id = p.business_id
left join public.categories c
  on c.id = p.category_id
left join public.inventory_locations loc
  on loc.business_id = p.business_id
 and loc.is_default = true
left join public.inventory_levels level
  on level.business_id = p.business_id
 and level.location_id = loc.id
 and level.variant_id = pv.id;

revoke all on public.catalog_variant_inventory from anon, authenticated;
grant select on public.catalog_variant_inventory to authenticated;

notify pgrst, 'reload schema';
