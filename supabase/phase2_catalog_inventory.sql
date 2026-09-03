-- NOVA POS — Phase 2 catalog + inventory foundation
-- Run this in a DEDICATED NOVA Supabase project, not in another application's database.
-- Designed for Supabase Postgres 17 and the current RLS guidance.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;

do $$ begin
  create type public.nova_product_status as enum ('active', 'draft', 'archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nova_staff_role as enum ('manager', 'cashier');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nova_staff_status as enum ('active', 'disabled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.nova_inventory_movement_type as enum (
    'stock_in',
    'stock_out',
    'adjustment',
    'damage',
    'loss',
    'return',
    'sale',
    'refund'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  currency_code varchar(3) not null default 'LKR',
  timezone text not null default 'Asia/Colombo',
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.nova_staff_role not null default 'cashier',
  status public.nova_staff_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  slug text not null check (length(trim(slug)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, slug)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  image_url text,
  status public.nova_product_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (category_id, business_id)
    references public.categories(id, business_id)
    on delete restrict
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null,
  name text not null default 'Standard' check (length(trim(name)) > 0),
  sku text not null check (length(trim(sku)) > 0),
  qr_token uuid not null default gen_random_uuid(),
  price numeric(12,2) not null default 0 check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, sku),
  unique (qr_token),
  foreign key (product_id, business_id)
    references public.products(id, business_id)
    on delete cascade
);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  code text not null check (length(trim(code)) > 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, code)
);

create unique index if not exists inventory_locations_one_default_idx
  on public.inventory_locations (business_id)
  where is_default;

create table if not exists public.inventory_levels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null,
  variant_id uuid not null,
  on_hand integer not null default 0 check (on_hand >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now(),
  unique (location_id, variant_id),
  foreign key (location_id, business_id)
    references public.inventory_locations(id, business_id)
    on delete cascade,
  foreign key (variant_id, business_id)
    references public.product_variants(id, business_id)
    on delete cascade
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  location_id uuid not null,
  variant_id uuid not null,
  movement_type public.nova_inventory_movement_type not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_before integer not null check (quantity_before >= 0),
  quantity_after integer not null check (quantity_after >= 0),
  reason text not null default '',
  note text not null default '',
  reference_type text,
  reference_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (location_id, business_id)
    references public.inventory_locations(id, business_id)
    on delete restrict,
  foreign key (variant_id, business_id)
    references public.product_variants(id, business_id)
    on delete restrict
);

create index if not exists staff_members_user_id_idx on public.staff_members(user_id);
create index if not exists staff_members_business_id_idx on public.staff_members(business_id);
create index if not exists categories_business_id_idx on public.categories(business_id);
create index if not exists products_business_id_idx on public.products(business_id);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists product_variants_business_id_idx on public.product_variants(business_id);
create index if not exists product_variants_product_id_idx on public.product_variants(product_id);
create index if not exists product_variants_sku_idx on public.product_variants(sku);
create unique index if not exists product_variants_business_sku_ci_idx
  on public.product_variants (business_id, lower(sku));
create unique index if not exists categories_business_slug_ci_idx
  on public.categories (business_id, lower(slug));
create index if not exists product_variants_qr_token_idx on public.product_variants(qr_token);
create index if not exists inventory_locations_business_id_idx on public.inventory_locations(business_id);
create index if not exists inventory_levels_business_id_idx on public.inventory_levels(business_id);
create index if not exists inventory_levels_variant_id_idx on public.inventory_levels(variant_id);
create index if not exists inventory_levels_location_id_idx on public.inventory_levels(location_id);
create index if not exists inventory_movements_business_id_idx on public.inventory_movements(business_id);
create index if not exists inventory_movements_variant_id_idx on public.inventory_movements(variant_id);
create index if not exists inventory_movements_created_at_idx on public.inventory_movements(created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses
for each row execute function public.set_updated_at();

drop trigger if exists staff_members_set_updated_at on public.staff_members;
create trigger staff_members_set_updated_at before update on public.staff_members
for each row execute function public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants
for each row execute function public.set_updated_at();

drop trigger if exists inventory_locations_set_updated_at on public.inventory_locations;
create trigger inventory_locations_set_updated_at before update on public.inventory_locations
for each row execute function public.set_updated_at();

drop trigger if exists inventory_levels_set_updated_at on public.inventory_levels;
create trigger inventory_levels_set_updated_at before update on public.inventory_levels
for each row execute function public.set_updated_at();

create or replace function private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.businesses b
        where b.id = target_business_id
          and b.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.staff_members sm
        where sm.business_id = target_business_id
          and sm.user_id = (select auth.uid())
          and sm.status = 'active'::public.nova_staff_status
      )
    );
$$;

create or replace function private.is_business_manager(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (
      exists (
        select 1
        from public.businesses b
        where b.id = target_business_id
          and b.owner_user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.staff_members sm
        where sm.business_id = target_business_id
          and sm.user_id = (select auth.uid())
          and sm.status = 'active'::public.nova_staff_status
          and sm.role = 'manager'::public.nova_staff_role
      )
    );
$$;

revoke all on function private.is_business_member(uuid) from public;
revoke all on function private.is_business_manager(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.is_business_manager(uuid) to authenticated;

alter table public.businesses enable row level security;
alter table public.staff_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_locations enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.businesses from anon, authenticated;
revoke all on table public.staff_members from anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.product_variants from anon, authenticated;
revoke all on table public.inventory_locations from anon, authenticated;
revoke all on table public.inventory_levels from anon, authenticated;
revoke all on table public.inventory_movements from anon, authenticated;

grant select, insert, delete on table public.businesses to authenticated;
grant update (name, currency_code, timezone) on table public.businesses to authenticated;

grant select, insert, delete on table public.staff_members to authenticated;
grant update (role, status) on table public.staff_members to authenticated;

grant select, insert, delete on table public.categories to authenticated;
grant update (name, slug, sort_order, is_active) on table public.categories to authenticated;

grant select, insert, delete on table public.products to authenticated;
grant update (category_id, name, description, image_url, status) on table public.products to authenticated;

grant select, insert, delete on table public.product_variants to authenticated;
-- qr_token is intentionally omitted from UPDATE grants: printed QR identities are permanent.
grant update (name, sku, price, cost, is_active) on table public.product_variants to authenticated;

grant select, insert, delete on table public.inventory_locations to authenticated;
grant update (name, code, is_default, is_active) on table public.inventory_locations to authenticated;

grant select, insert, delete on table public.inventory_levels to authenticated;
grant update (on_hand, low_stock_threshold) on table public.inventory_levels to authenticated;

grant select, insert on table public.inventory_movements to authenticated;

-- Businesses
 drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses for select to authenticated
using ((select private.is_business_member(id)));

drop policy if exists businesses_insert_owner on public.businesses;
create policy businesses_insert_owner on public.businesses for insert to authenticated
with check ((select auth.uid()) = owner_user_id);

drop policy if exists businesses_update_manager on public.businesses;
create policy businesses_update_manager on public.businesses for update to authenticated
using ((select private.is_business_manager(id)))
with check ((select private.is_business_manager(id)));

drop policy if exists businesses_delete_owner on public.businesses;
create policy businesses_delete_owner on public.businesses for delete to authenticated
using ((select auth.uid()) = owner_user_id);

-- Staff
 drop policy if exists staff_select_member on public.staff_members;
create policy staff_select_member on public.staff_members for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists staff_insert_manager on public.staff_members;
create policy staff_insert_manager on public.staff_members for insert to authenticated
with check ((select private.is_business_manager(business_id)));

drop policy if exists staff_update_manager on public.staff_members;
create policy staff_update_manager on public.staff_members for update to authenticated
using ((select private.is_business_manager(business_id)))
with check ((select private.is_business_manager(business_id)));

drop policy if exists staff_delete_manager on public.staff_members;
create policy staff_delete_manager on public.staff_members for delete to authenticated
using ((select private.is_business_manager(business_id)));

-- Categories
 drop policy if exists categories_select_member on public.categories;
create policy categories_select_member on public.categories for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists categories_insert_manager on public.categories;
create policy categories_insert_manager on public.categories for insert to authenticated
with check ((select private.is_business_manager(business_id)));

drop policy if exists categories_update_manager on public.categories;
create policy categories_update_manager on public.categories for update to authenticated
using ((select private.is_business_manager(business_id)))
with check ((select private.is_business_manager(business_id)));

drop policy if exists categories_delete_manager on public.categories;
create policy categories_delete_manager on public.categories for delete to authenticated
using ((select private.is_business_manager(business_id)));

-- Products
 drop policy if exists products_select_member on public.products;
create policy products_select_member on public.products for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists products_insert_manager on public.products;
create policy products_insert_manager on public.products for insert to authenticated
with check ((select private.is_business_manager(business_id)));

drop policy if exists products_update_manager on public.products;
create policy products_update_manager on public.products for update to authenticated
using ((select private.is_business_manager(business_id)))
with check ((select private.is_business_manager(business_id)));

drop policy if exists products_delete_manager on public.products;
create policy products_delete_manager on public.products for delete to authenticated
using ((select private.is_business_manager(business_id)));

-- Product variants
 drop policy if exists variants_select_member on public.product_variants;
create policy variants_select_member on public.product_variants for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists variants_insert_manager on public.product_variants;
create policy variants_insert_manager on public.product_variants for insert to authenticated
with check ((select private.is_business_manager(business_id)));

drop policy if exists variants_update_manager on public.product_variants;
create policy variants_update_manager on public.product_variants for update to authenticated
using ((select private.is_business_manager(business_id)))
with check ((select private.is_business_manager(business_id)));

drop policy if exists variants_delete_manager on public.product_variants;
create policy variants_delete_manager on public.product_variants for delete to authenticated
using ((select private.is_business_manager(business_id)));

-- Locations
 drop policy if exists locations_select_member on public.inventory_locations;
create policy locations_select_member on public.inventory_locations for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists locations_insert_manager on public.inventory_locations;
create policy locations_insert_manager on public.inventory_locations for insert to authenticated
with check ((select private.is_business_manager(business_id)));

drop policy if exists locations_update_manager on public.inventory_locations;
create policy locations_update_manager on public.inventory_locations for update to authenticated
using ((select private.is_business_manager(business_id)))
with check ((select private.is_business_manager(business_id)));

drop policy if exists locations_delete_manager on public.inventory_locations;
create policy locations_delete_manager on public.inventory_locations for delete to authenticated
using ((select private.is_business_manager(business_id)));

-- Inventory levels
 drop policy if exists levels_select_member on public.inventory_levels;
create policy levels_select_member on public.inventory_levels for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists levels_insert_manager on public.inventory_levels;
create policy levels_insert_manager on public.inventory_levels for insert to authenticated
with check ((select private.is_business_manager(business_id)));

drop policy if exists levels_update_manager on public.inventory_levels;
create policy levels_update_manager on public.inventory_levels for update to authenticated
using ((select private.is_business_manager(business_id)))
with check ((select private.is_business_manager(business_id)));

drop policy if exists levels_delete_manager on public.inventory_levels;
create policy levels_delete_manager on public.inventory_levels for delete to authenticated
using ((select private.is_business_manager(business_id)));

-- Movement history is append-only from the app.
 drop policy if exists movements_select_member on public.inventory_movements;
create policy movements_select_member on public.inventory_movements for select to authenticated
using ((select private.is_business_member(business_id)));

drop policy if exists movements_insert_manager on public.inventory_movements;
create policy movements_insert_manager on public.inventory_movements for insert to authenticated
with check ((select private.is_business_manager(business_id)));

create or replace function public.bootstrap_business(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into public.businesses (name, owner_user_id)
  values (trim(p_name), (select auth.uid()))
  returning id into v_business_id;

  insert into public.inventory_locations (business_id, name, code, is_default)
  values (v_business_id, 'Main', 'MAIN', true);

  return v_business_id;
end;
$$;

revoke all on function public.bootstrap_business(text) from public, anon;
grant execute on function public.bootstrap_business(text) to authenticated;

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
  set on_hand = v_after,
      updated_at = now()
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

revoke all on function public.adjust_inventory(uuid, uuid, integer, public.nova_inventory_movement_type, text, text) from public, anon;
grant execute on function public.adjust_inventory(uuid, uuid, integer, public.nova_inventory_movement_type, text, text) to authenticated;

-- A compact read model for POS/product/inventory screens.
-- security_invoker makes the view obey the underlying table RLS policies.
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
  coalesce(level.low_stock_threshold, 5) as low_stock_threshold
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

comment on column public.product_variants.qr_token is
  'Permanent immutable identifier encoded as NOVA:V1:<uuid>. Never encode mutable price/stock in QR labels.';
