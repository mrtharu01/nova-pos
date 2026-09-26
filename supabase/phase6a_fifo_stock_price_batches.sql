-- ============================================================
-- ARC POS
-- PHASE 6A — FIFO STOCK + PRICE BATCHES
--
-- Same barcode, different deliveries, different prices.
--
-- ARC keeps one product/variant/barcode identity and stores each
-- incoming delivery as its own FIFO batch with:
--   • quantity
--   • unit cost
--   • regular selling price
--
-- Old stock is sold first at its old price. When that batch is
-- exhausted, the same barcode automatically moves to the next
-- batch and its price.
-- ============================================================


drop function if exists public.adjust_inventory_with_cost(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text,
  numeric,
  numeric
);


-- ============================================================
-- 1. FIFO PRICE BATCHES
-- ============================================================

create table if not exists public.inventory_price_batches (
  id uuid primary key default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  location_id uuid not null
    references public.inventory_locations(id)
    on delete cascade,

  variant_id uuid not null
    references public.product_variants(id)
    on delete cascade,

  initial_quantity integer not null
    check (initial_quantity > 0),

  remaining_quantity integer not null
    check (
      remaining_quantity >= 0
      and
      remaining_quantity <= initial_quantity
    ),

  unit_cost numeric(12,2) not null
    check (unit_cost >= 0),

  regular_unit_price numeric(12,2) not null
    check (regular_unit_price >= 0),

  source_movement_id uuid
    references public.inventory_movements(id)
    on delete set null,

  source_reference text unique,

  received_at timestamptz not null default now(),

  created_by_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now()
);


create index if not exists
inventory_price_batches_fifo_idx
on public.inventory_price_batches (
  business_id,
  location_id,
  variant_id,
  received_at,
  created_at,
  id
)
where remaining_quantity > 0;


alter table public.inventory_price_batches
enable row level security;


drop policy if exists
arc_inventory_price_batches_select
on public.inventory_price_batches;


create policy
arc_inventory_price_batches_select
on public.inventory_price_batches
for select
to authenticated
using (
  private.is_business_member(
    business_id
  )
);


revoke all
on public.inventory_price_batches
from
  anon,
  authenticated;


grant select
on public.inventory_price_batches
to authenticated;


-- Existing stock becomes the first FIFO batch.
insert into public.inventory_price_batches (
  business_id,
  location_id,
  variant_id,
  initial_quantity,
  remaining_quantity,
  unit_cost,
  regular_unit_price,
  source_reference,
  received_at
)
select
  level_record.business_id,
  level_record.location_id,
  level_record.variant_id,
  level_record.on_hand,
  level_record.on_hand,
  coalesce(
    variant_record.cost,
    0
  ),
  coalesce(
    variant_record.price,
    0
  ),
  'legacy:'
    ||
    level_record.location_id::text
    ||
    ':'
    ||
    level_record.variant_id::text,
  coalesce(
    level_record.updated_at,
    now()
  )
from public.inventory_levels
  as level_record
join public.product_variants
  as variant_record
  on
    variant_record.id =
      level_record.variant_id
  and
    variant_record.business_id =
      level_record.business_id
where
  level_record.on_hand > 0
on conflict (
  source_reference
)
do nothing;


-- ============================================================
-- 2. SALE ITEM BATCH SNAPSHOT
-- ============================================================

alter table public.sale_items
add column if not exists batch_id uuid;


do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where
      conname =
        'sale_items_batch_id_fk'
      and
      conrelid =
        'public.sale_items'::regclass
  ) then
    alter table public.sale_items
    add constraint sale_items_batch_id_fk
    foreign key (
      batch_id
    )
    references public.inventory_price_batches(id)
    on delete set null;
  end if;
end;
$$;


create index if not exists
sale_items_batch_id_idx
on public.sale_items(
  batch_id
);


-- Preserve a batch's regular price when checkout supplies it.
create or replace function
private.snapshot_sale_item_product_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regular_price numeric(12,2);
begin

  if
    new.regular_unit_price is null
    or new.regular_unit_price <= 0
  then
    select
      variant_record.price
    into
      v_regular_price
    from public.product_variants
      as variant_record
    where
      variant_record.id =
        new.variant_id
      and
      variant_record.business_id =
        new.business_id;

    new.regular_unit_price :=
      coalesce(
        v_regular_price,
        new.unit_price
      );
  end if;


  new.product_discount_total :=
    round(
      greatest(
        new.regular_unit_price -
        new.unit_price,
        0
      )
      *
      new.quantity,
      2
    );


  return new;

end;
$$;


-- ============================================================
-- 3. FIFO CART ALLOCATOR
-- ============================================================

create or replace function
private.arc_fifo_checkout_allocations(
  p_business_id uuid,
  p_location_id uuid,
  p_items jsonb
)
returns table (
  variant_id uuid,
  batch_id uuid,
  quantity integer,
  regular_price numeric,
  unit_price numeric,
  unit_cost numeric,
  batch_order integer
)
language sql
stable
set search_path = ''
as $$

  with requested as (

    select
      item.variant_id,
      item.quantity
    from private.nova_checkout_items(
      p_items
    ) as item

  ),

  ranked as (

    select
      requested.variant_id,
      requested.quantity
        as requested_quantity,

      batch_record.id
        as batch_id,

      batch_record.remaining_quantity,

      batch_record.regular_unit_price,

      batch_record.unit_cost,

      product_record.promotion_enabled,

      product_record.promotion_type,

      product_record.promotion_value,

      product_record.promotion_starts_at,

      product_record.promotion_ends_at,

      coalesce(
        sum(
          batch_record.remaining_quantity
        ) over (
          partition by
            requested.variant_id
          order by
            batch_record.received_at,
            batch_record.created_at,
            batch_record.id
          rows between
            unbounded preceding
            and
            1 preceding
        ),
        0
      )::integer
        as quantity_before,

      row_number() over (
        partition by
          requested.variant_id
        order by
          batch_record.received_at,
          batch_record.created_at,
          batch_record.id
      )::integer
        as batch_order

    from requested

    join public.inventory_price_batches
      as batch_record
      on
        batch_record.business_id =
          p_business_id
        and
        batch_record.location_id =
          p_location_id
        and
        batch_record.variant_id =
          requested.variant_id
        and
        batch_record.remaining_quantity >
          0

    join public.product_variants
      as variant_record
      on
        variant_record.id =
          requested.variant_id
        and
        variant_record.business_id =
          p_business_id
        and
        variant_record.is_active =
          true

    join public.products
      as product_record
      on
        product_record.id =
          variant_record.product_id
        and
        product_record.business_id =
          p_business_id
        and
        product_record.status =
          'active'::public.nova_product_status

  ),

  allocated as (

    select
      ranked.*,

      greatest(
        0,
        least(
          ranked.remaining_quantity,
          ranked.requested_quantity -
          ranked.quantity_before
        )
      )::integer
        as allocated_quantity

    from ranked

  )

  select
    allocated.variant_id,

    allocated.batch_id,

    allocated.allocated_quantity
      as quantity,

    allocated.regular_unit_price
      as regular_price,

    private.nova_effective_product_price(
      allocated.regular_unit_price,
      allocated.promotion_enabled,
      allocated.promotion_type,
      allocated.promotion_value,
      allocated.promotion_starts_at,
      allocated.promotion_ends_at
    )::numeric(12,2)
      as unit_price,

    allocated.unit_cost,

    allocated.batch_order

  from allocated

  where
    allocated.allocated_quantity >
      0

  order by
    allocated.variant_id,
    allocated.batch_order,
    allocated.batch_id;

$$;


revoke all
on function private.arc_fifo_checkout_allocations(
  uuid,
  uuid,
  jsonb
)
from
  public,
  anon,
  authenticated;


-- ============================================================
-- 4. RECEIVE A NEW STOCK / PRICE BATCH
-- ============================================================

create or replace function
public.receive_inventory_batch(
  p_variant_id uuid,
  p_location_id uuid,
  p_quantity integer,
  p_unit_cost numeric default null,
  p_selling_price numeric default null,
  p_reason text default 'New stock delivery',
  p_note text default ''
)
returns table (
  new_on_hand integer,
  movement_id uuid,
  batch_id uuid,
  unit_cost numeric,
  selling_price numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid :=
    (
      select auth.uid()
    );

  v_business_id uuid;
  v_product_id uuid;
  v_location_business_id uuid;

  v_before integer;
  v_after integer;

  v_cost numeric(12,2);
  v_price numeric(12,2);

  v_promotion_enabled boolean := false;
  v_promotion_type text;
  v_promotion_value numeric(12,2) := 0;

  v_movement_id uuid;
  v_batch_id uuid;
begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if
    p_quantity is null
    or p_quantity <= 0
  then
    raise exception
      'Stock In quantity must be greater than zero';
  end if;


  if
    p_unit_cost is not null
    and p_unit_cost < 0
  then
    raise exception
      'Incoming unit cost cannot be negative';
  end if;


  if
    p_selling_price is not null
    and p_selling_price < 0
  then
    raise exception
      'Selling price cannot be negative';
  end if;


  select
    variant_record.business_id,
    variant_record.product_id,
    coalesce(
      p_unit_cost,
      variant_record.cost,
      0
    ),
    coalesce(
      p_selling_price,
      variant_record.price,
      0
    )
  into
    v_business_id,
    v_product_id,
    v_cost,
    v_price
  from public.product_variants
    as variant_record
  where
    variant_record.id =
      p_variant_id
  for update;


  if
    v_business_id is null
  then
    raise exception
      'Variant not found';
  end if;


  if not (
    select private.is_business_manager(
      v_business_id
    )
  ) then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  select
    location_record.business_id
  into
    v_location_business_id
  from public.inventory_locations
    as location_record
  where
    location_record.id =
      p_location_id;


  if
    v_location_business_id
    is distinct from
    v_business_id
  then
    raise exception
      'Inventory location does not belong to this business';
  end if;


  select
    product_record.promotion_enabled,
    product_record.promotion_type::text,
    coalesce(
      product_record.promotion_value,
      0
    )
  into
    v_promotion_enabled,
    v_promotion_type,
    v_promotion_value
  from public.products
    as product_record
  where
    product_record.id =
      v_product_id
    and
    product_record.business_id =
      v_business_id;


  if
    v_promotion_enabled
    and
    v_promotion_type =
      'fixed'
    and
    v_promotion_value >=
      v_price
  then
    raise exception
      'Batch selling price must be greater than the active fixed promotion amount';
  end if;


  insert into public.inventory_levels (
    business_id,
    location_id,
    variant_id,
    on_hand,
    low_stock_threshold
  )
  values (
    v_business_id,
    p_location_id,
    p_variant_id,
    0,
    5
  )
  on conflict (
    location_id,
    variant_id
  )
  do nothing;


  select
    level_record.on_hand
  into
    v_before
  from public.inventory_levels
    as level_record
  where
    level_record.business_id =
      v_business_id
    and
    level_record.location_id =
      p_location_id
    and
    level_record.variant_id =
      p_variant_id
  for update;


  v_after :=
    v_before +
    p_quantity;


  update public.inventory_levels
  set
    on_hand =
      v_after
  where
    business_id =
      v_business_id
    and
    location_id =
      p_location_id
    and
    variant_id =
      p_variant_id;


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
    'stock_in'::public.nova_inventory_movement_type,
    p_quantity,
    v_before,
    v_after,
    coalesce(
      nullif(
        btrim(
          p_reason
        ),
        ''
      ),
      'New stock delivery'
    ),
    concat_ws(
      ' · ',
      nullif(
        btrim(
          coalesce(
            p_note,
            ''
          )
        ),
        ''
      ),
      'Batch cost LKR '
      ||
      to_char(
        v_cost,
        'FM999999999990.00'
      ),
      'Batch selling price LKR '
      ||
      to_char(
        v_price,
        'FM999999999990.00'
      )
    ),
    v_user_id
  )
  returning
    id
  into
    v_movement_id;


  insert into public.inventory_price_batches (
    business_id,
    location_id,
    variant_id,
    initial_quantity,
    remaining_quantity,
    unit_cost,
    regular_unit_price,
    source_movement_id,
    received_at,
    created_by_user_id
  )
  values (
    v_business_id,
    p_location_id,
    p_variant_id,
    p_quantity,
    p_quantity,
    v_cost,
    v_price,
    v_movement_id,
    now(),
    v_user_id
  )
  returning
    id
  into
    v_batch_id;


  -- Latest delivery values become the defaults for future stock.
  -- Existing batches keep their own historical values.
  update public.product_variants
  set
    cost =
      v_cost,
    price =
      v_price
  where
    id =
      p_variant_id
    and
    business_id =
      v_business_id;


  return query
  select
    v_after,
    v_movement_id,
    v_batch_id,
    v_cost,
    v_price;

end;
$$;


revoke all
on function public.receive_inventory_batch(
  uuid,
  uuid,
  integer,
  numeric,
  numeric,
  text,
  text
)
from
  public,
  anon;


grant execute
on function public.receive_inventory_batch(
  uuid,
  uuid,
  integer,
  numeric,
  numeric,
  text,
  text
)
to authenticated;


-- ============================================================
-- 5. KEEP ORDINARY INVENTORY ADJUSTMENTS IN SYNC WITH BATCHES
-- ============================================================

create or replace function public.adjust_inventory(
  p_variant_id uuid,
  p_location_id uuid,
  p_delta integer,
  p_movement_type public.nova_inventory_movement_type,
  p_reason text default '',
  p_note text default ''
)
returns table (
  new_on_hand integer,
  movement_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_location_business_id uuid;

  v_before integer;
  v_after integer;

  v_default_cost numeric(12,2);
  v_default_price numeric(12,2);

  v_movement_id uuid;

  v_to_consume integer;
  v_take integer;
  v_batch record;
begin

  if
    p_delta = 0
  then
    raise exception
      'Inventory adjustment cannot be zero';
  end if;


  select
    variant_record.business_id,
    coalesce(
      variant_record.cost,
      0
    ),
    coalesce(
      variant_record.price,
      0
    )
  into
    v_business_id,
    v_default_cost,
    v_default_price
  from public.product_variants
    as variant_record
  where
    variant_record.id =
      p_variant_id
  for update;


  if
    v_business_id is null
  then
    raise exception
      'Variant not found';
  end if;


  if not (
    select private.is_business_manager(
      v_business_id
    )
  ) then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  select
    location_record.business_id
  into
    v_location_business_id
  from public.inventory_locations
    as location_record
  where
    location_record.id =
      p_location_id;


  if
    v_location_business_id
    is distinct from
    v_business_id
  then
    raise exception
      'Inventory location does not belong to this business';
  end if;


  insert into public.inventory_levels (
    business_id,
    location_id,
    variant_id,
    on_hand,
    low_stock_threshold
  )
  values (
    v_business_id,
    p_location_id,
    p_variant_id,
    0,
    5
  )
  on conflict (
    location_id,
    variant_id
  )
  do nothing;


  select
    level_record.on_hand
  into
    v_before
  from public.inventory_levels
    as level_record
  where
    level_record.business_id =
      v_business_id
    and
    level_record.location_id =
      p_location_id
    and
    level_record.variant_id =
      p_variant_id
  for update;


  v_after :=
    v_before +
    p_delta;


  if
    v_after < 0
  then
    raise exception
      'Insufficient stock: current %, change %',
      v_before,
      p_delta;
  end if;


  if
    p_delta < 0
  then

    v_to_consume :=
      -p_delta;


    for v_batch in

      select
        batch_record.id,
        batch_record.remaining_quantity
      from public.inventory_price_batches
        as batch_record
      where
        batch_record.business_id =
          v_business_id
        and
        batch_record.location_id =
          p_location_id
        and
        batch_record.variant_id =
          p_variant_id
        and
        batch_record.remaining_quantity >
          0
      order by
        batch_record.received_at,
        batch_record.created_at,
        batch_record.id
      for update

    loop

      exit when
        v_to_consume <= 0;


      v_take :=
        least(
          v_to_consume,
          v_batch.remaining_quantity
        );


      update public.inventory_price_batches
      set
        remaining_quantity =
          remaining_quantity -
          v_take
      where
        id =
          v_batch.id;


      v_to_consume :=
        v_to_consume -
        v_take;

    end loop;


    if
      v_to_consume >
      0
    then
      raise exception
        'FIFO price batches are out of sync with inventory';
    end if;

  end if;


  update public.inventory_levels
  set
    on_hand =
      v_after
  where
    business_id =
      v_business_id
    and
    location_id =
      p_location_id
    and
    variant_id =
      p_variant_id;


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
    coalesce(
      p_reason,
      ''
    ),
    coalesce(
      p_note,
      ''
    ),
    (
      select auth.uid()
    )
  )
  returning
    id
  into
    v_movement_id;


  if
    p_delta > 0
  then

    insert into public.inventory_price_batches (
      business_id,
      location_id,
      variant_id,
      initial_quantity,
      remaining_quantity,
      unit_cost,
      regular_unit_price,
      source_movement_id,
      received_at,
      created_by_user_id
    )
    values (
      v_business_id,
      p_location_id,
      p_variant_id,
      p_delta,
      p_delta,
      v_default_cost,
      v_default_price,
      v_movement_id,
      now(),
      (
        select auth.uid()
      )
    );

  end if;


  return query
  select
    v_after,
    v_movement_id;

end;
$$;


revoke all
on function public.adjust_inventory(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text
)
from
  public,
  anon;


grant execute
on function public.adjust_inventory(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text
)
to authenticated;


-- ============================================================
-- 6. REFUNDS + VOIDS RESTORE THE ORIGINAL BATCH
-- ============================================================

create or replace function
private.arc_restore_fifo_batch_from_refund()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
begin

  if not new.restocked then
    return new;
  end if;


  select
    sale_item.batch_id
  into
    v_batch_id
  from public.sale_items
    as sale_item
  where
    sale_item.id =
      new.sale_item_id
    and
    sale_item.business_id =
      new.business_id;


  if
    v_batch_id is not null
  then

    update public.inventory_price_batches
      as batch_record
    set
      remaining_quantity =
        least(
          batch_record.initial_quantity,
          batch_record.remaining_quantity +
          new.quantity
        )
    where
      batch_record.id =
        v_batch_id
      and
      batch_record.business_id =
        new.business_id;

  end if;


  return new;

end;
$$;


drop trigger if exists
sale_refund_items_restore_fifo_batch
on public.sale_refund_items;


create trigger
sale_refund_items_restore_fifo_batch
after insert
on public.sale_refund_items
for each row
execute function
private.arc_restore_fifo_batch_from_refund();


create or replace function
private.arc_restore_fifo_batches_from_void()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  update public.inventory_price_batches
    as batch_record
  set
    remaining_quantity =
      least(
        batch_record.initial_quantity,
        batch_record.remaining_quantity +
        sold.quantity
      )
  from (
    select
      sale_item.batch_id,
      sum(
        sale_item.quantity
      )::integer
        as quantity
    from public.sale_items
      as sale_item
    where
      sale_item.sale_id =
        new.sale_id
      and
      sale_item.business_id =
        new.business_id
      and
      sale_item.batch_id is not null
    group by
      sale_item.batch_id
  ) as sold
  where
    batch_record.id =
      sold.batch_id
    and
    batch_record.business_id =
      new.business_id;


  return new;

end;
$$;


drop trigger if exists
sale_voids_restore_fifo_batches
on public.sale_voids;


create trigger
sale_voids_restore_fifo_batches
after insert
on public.sale_voids
for each row
execute function
private.arc_restore_fifo_batches_from_void();


-- ============================================================
-- 7. TENANT CATALOG EXPOSES THE CURRENT FIFO PRICE + BATCHES
-- ============================================================

create or replace view
public.catalog_variant_inventory

with (
  security_invoker = true
)

as

select

  p.business_id,

  p.id
    as product_id,

  p.name
    as product_name,

  p.description,

  p.image_url,

  p.status
    as product_status,

  c.id
    as category_id,

  c.name
    as category_name,

  pv.id
    as variant_id,

  pv.name
    as variant_name,

  pv.sku,

  pv.qr_token,

  private.nova_effective_product_price(
    coalesce(
      fifo.regular_unit_price,
      pv.price
    ),
    p.promotion_enabled,
    p.promotion_type,
    p.promotion_value,
    p.promotion_starts_at,
    p.promotion_ends_at
  )::numeric(12,2)
    as price,

  coalesce(
    fifo.unit_cost,
    pv.cost
  )::numeric(12,2)
    as cost,

  pv.is_active,

  loc.id
    as location_id,

  coalesce(
    level.on_hand,
    0
  )
    as stock,

  coalesce(
    level.low_stock_threshold,
    5
  )
    as low_stock_threshold,

  coalesce(
    fifo.regular_unit_price,
    pv.price
  )::numeric(12,2)
    as regular_price,

  p.promotion_enabled,

  (
    p.promotion_enabled
    and
    (
      p.promotion_starts_at is null
      or
      p.promotion_starts_at <=
        now()
    )
    and
    (
      p.promotion_ends_at is null
      or
      p.promotion_ends_at >
        now()
    )
  )
    as promotion_active,

  p.promotion_type,

  p.promotion_value,

  p.promotion_starts_at,

  p.promotion_ends_at,

  p.image_path,

  pv.barcode,

  coalesce(
    fifo_list.price_batches,
    '[]'::jsonb
  )
    as price_batches,

  pv.price
    as default_price,

  pv.cost
    as default_cost

from public.products
  as p

join public.product_variants
  as pv
  on
    pv.product_id =
      p.id
    and
    pv.business_id =
      p.business_id

left join public.categories
  as c
  on
    c.id =
      p.category_id

left join public.inventory_locations
  as loc
  on
    loc.business_id =
      p.business_id
    and
    loc.is_default =
      true

left join public.inventory_levels
  as level
  on
    level.business_id =
      p.business_id
    and
    level.location_id =
      loc.id
    and
    level.variant_id =
      pv.id

left join lateral (

  select
    batch_record.unit_cost,
    batch_record.regular_unit_price
  from public.inventory_price_batches
    as batch_record
  where
    batch_record.business_id =
      p.business_id
    and
    batch_record.location_id =
      loc.id
    and
    batch_record.variant_id =
      pv.id
    and
    batch_record.remaining_quantity >
      0
  order by
    batch_record.received_at,
    batch_record.created_at,
    batch_record.id
  limit 1

) as fifo
on true

left join lateral (

  select
    jsonb_agg(
      jsonb_build_object(
        'id',
        batch_record.id,
        'quantity',
        batch_record.remaining_quantity,
        'cost',
        batch_record.unit_cost,
        'regularPrice',
        batch_record.regular_unit_price,
        'price',
        private.nova_effective_product_price(
          batch_record.regular_unit_price,
          p.promotion_enabled,
          p.promotion_type,
          p.promotion_value,
          p.promotion_starts_at,
          p.promotion_ends_at
        )
      )
      order by
        batch_record.received_at,
        batch_record.created_at,
        batch_record.id
    )
      as price_batches
  from public.inventory_price_batches
    as batch_record
  where
    batch_record.business_id =
      p.business_id
    and
    batch_record.location_id =
      loc.id
    and
    batch_record.variant_id =
      pv.id
    and
    batch_record.remaining_quantity >
      0

) as fifo_list
on true;


revoke all
on public.catalog_variant_inventory
from
  anon,
  authenticated;


grant select
on public.catalog_variant_inventory
to authenticated;


-- ============================================================
-- 8. FIFO-AWARE AUTHORITATIVE CHECKOUT
-- ============================================================

create or replace function
public.complete_sale(

  p_business_id uuid,

  p_checkout_key uuid,

  p_items jsonb,

  p_payment_method
    public.nova_payment_method,

  p_cash_received numeric
    default null,

  p_reference_number text
    default null,

  p_discount_total numeric
    default 0,

  p_customer_name text
    default null,

  p_customer_email text
    default null,

  p_customer_phone text
    default null,

  p_note text
    default '',

  p_customer_id uuid
    default null,

  p_loyalty_points_to_redeem integer
    default 0

)

returns table (

  sale_id uuid,

  receipt_number text,

  receipt_sequence bigint,

  currency_code text,

  subtotal numeric,

  discount_total numeric,

  tax_total numeric,

  total numeric,

  item_quantity_total integer,

  payment_method text,

  cash_received numeric,

  change_due numeric,

  created_at timestamptz,

  was_existing boolean

)

language plpgsql

security definer

set search_path = ''

as $$

declare

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  v_user_id uuid :=
    (
      select auth.uid()
    );


  -- ==========================================================
  -- BUSINESS / INVENTORY
  -- ==========================================================

  v_location_id uuid;

  v_currency_code text;


  -- ==========================================================
  -- CART
  -- ==========================================================

  v_requested_count integer :=
    0;

  v_processed_count integer :=
    0;

  v_inserted_count integer :=
    0;

  v_item_quantity_total integer :=
    0;


  -- ==========================================================
  -- MONEY
  -- ==========================================================

  v_subtotal numeric(12,2) :=
    0;


  v_manual_discount_total numeric(12,2) :=
    round(
      coalesce(
        p_discount_total,
        0
      ),
      2
    );


  v_customer_discount_total numeric(12,2) :=
    0;


  v_loyalty_discount_total numeric(12,2) :=
    0;


  v_discount_total numeric(12,2) :=
    0;


  v_pre_loyalty_total numeric(12,2) :=
    0;


  v_tax_total numeric(12,2) :=
    0;


  v_total numeric(12,2);


  v_cash_received numeric(12,2);

  v_change_due numeric(12,2) :=
    0;


  -- ==========================================================
  -- SALE
  -- ==========================================================

  v_sale_id uuid;

  v_receipt_number text;

  v_receipt_sequence bigint;

  v_created_at timestamptz;

  v_cashier_label text;

  v_existing_payment_method text;

  -- ==========================================================
-- EXISTING SALE / IDEMPOTENCY RESULT
--
-- These MUST remain separate from the calculation variables.
-- A SELECT INTO returning no row sets its targets to NULL.
-- ==========================================================

v_existing_sale_id uuid;

v_existing_receipt_number text;

v_existing_receipt_sequence bigint;

v_existing_currency_code text;

v_existing_subtotal numeric(12,2);

v_existing_discount_total numeric(12,2);

v_existing_tax_total numeric(12,2);

v_existing_total numeric(12,2);

v_existing_item_quantity_total integer;

v_existing_cash_received numeric(12,2);

v_existing_change_due numeric(12,2);

v_existing_created_at timestamptz;


  -- ==========================================================
  -- CUSTOMER
  -- ==========================================================

  v_customer_id uuid :=
    p_customer_id;


  v_customer_name text;

  v_customer_email text;

  v_customer_phone text;


  v_customer_discount_percent numeric(5,2) :=
    0;


  v_customer_phone_verified_at timestamptz;


  -- ==========================================================
  -- LOYALTY SETTINGS
  -- ==========================================================

  v_loyalty_enabled boolean :=
    false;


  v_spend_amount_per_earn numeric(12,2) :=
    100;


  v_points_earned_rule integer :=
    1;


  v_redeem_points integer :=
    100;


  v_redeem_value numeric(12,2) :=
    100;


  v_minimum_redeem_points integer :=
    100;


  v_maximum_discount_percent numeric(5,2) :=
    50;


  v_allow_cashier_redeem boolean :=
    true;


  v_require_verified_phone boolean :=
    false;


  v_loyalty_balance integer :=
    0;


  v_points_to_redeem integer :=
    greatest(
      coalesce(
        p_loyalty_points_to_redeem,
        0
      ),
      0
    );


  v_points_earned integer :=
    0;


  v_max_loyalty_discount numeric(12,2) :=
    0;


  -- ==========================================================
  -- OTHER
  -- ==========================================================

  v_note text;

  v_reference_number text;

  v_item record;

  v_before integer;

  v_after integer;

  v_line_subtotal numeric(12,2);

  v_line_discount numeric(12,2);

  v_allocated_discount numeric(12,2) :=
    0;


  v_allocated_quantity integer :=
    0;


begin


  -- ==========================================================
  -- AUTHENTICATION
  -- ==========================================================

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if
    p_business_id is null
  then

    raise exception
      'Business is required';

  end if;


  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'You do not have access to this business'

      using errcode =
        '42501';

  end if;


  if
    p_checkout_key is null
  then

    raise exception
      'Checkout key is required';

  end if;


  if
    p_payment_method is null
  then

    raise exception
      'Payment method is required';

  end if;


  -- ==========================================================
  -- IDEMPOTENCY LOCK
  -- ==========================================================

  perform
    pg_catalog.pg_advisory_xact_lock(

      pg_catalog.hashtextextended(

        p_business_id::text
        ||
        ':'
        ||
        p_checkout_key::text,

        0

      )

    );


  -- ==========================================================
  -- ALREADY COMPLETED
  -- ==========================================================

  -- ==========================================================
-- ALREADY COMPLETED?
--
-- IMPORTANT:
--
-- Do NOT use v_subtotal / v_total / etc. as SELECT INTO
-- targets here.
--
-- A SELECT INTO that finds no row sets its target variables
-- to NULL. Those variables are needed later to calculate a
-- brand-new transaction.
-- ==========================================================

select

  sale_record.id,

  sale_record.receipt_number,

  sale_record.receipt_sequence,

  sale_record.currency_code,

  sale_record.subtotal,

  sale_record.discount_total,

  sale_record.tax_total,

  sale_record.total,

  sale_record.item_quantity_total,

  payment_record.method::text,

  payment_record.cash_received,

  payment_record.change_due,

  sale_record.created_at

into

  v_existing_sale_id,

  v_existing_receipt_number,

  v_existing_receipt_sequence,

  v_existing_currency_code,

  v_existing_subtotal,

  v_existing_discount_total,

  v_existing_tax_total,

  v_existing_total,

  v_existing_item_quantity_total,

  v_existing_payment_method,

  v_existing_cash_received,

  v_existing_change_due,

  v_existing_created_at

from public.sales
  as sale_record


left join lateral (

  select
    payment.*

  from public.payments
    as payment

  where
    payment.sale_id =
      sale_record.id

    and
    payment.business_id =
      sale_record.business_id

  order by
    payment.created_at asc

  limit 1

) as payment_record

  on true


where
  sale_record.business_id =
    p_business_id

  and
  sale_record.checkout_key =
    p_checkout_key

limit 1;


if
  v_existing_sale_id is not null
then

  return query

  select

    v_existing_sale_id,

    v_existing_receipt_number,

    v_existing_receipt_sequence,

    v_existing_currency_code,

    v_existing_subtotal,

    v_existing_discount_total,

    v_existing_tax_total,

    v_existing_total,

    v_existing_item_quantity_total,

    coalesce(
      v_existing_payment_method,
      p_payment_method::text
    ),

    v_existing_cash_received,

    v_existing_change_due,

    v_existing_created_at,

    true;


  return;

end if;


  -- ==========================================================
  -- CART VALIDATION
  -- ==========================================================

  if
    p_items is null

    or

    jsonb_typeof(
      p_items
    ) <> 'array'
  then

    raise exception
      'Checkout items must be a JSON array';

  end if;


  if
    jsonb_array_length(
      p_items
    ) = 0
  then

    raise exception
      'Cart is empty';

  end if;


  if
    jsonb_array_length(
      p_items
    ) > 200
  then

    raise exception
      'Too many cart lines';

  end if;


  if
    v_manual_discount_total < 0
  then

    raise exception
      'Discount cannot be negative';

  end if;


  -- ==========================================================
  -- CASHIER
  -- ==========================================================

  select

    coalesce(
      user_record.email,
      'Cashier'
    )

  into
    v_cashier_label

  from auth.users
    as user_record

  where
    user_record.id =
      v_user_id;


  v_cashier_label :=
    coalesce(
      v_cashier_label,
      'Cashier'
    );


  -- ==========================================================
  -- RAW CUSTOMER SNAPSHOT
  -- ==========================================================

  v_customer_name :=
    nullif(
      btrim(
        coalesce(
          p_customer_name,
          ''
        )
      ),
      ''
    );


  v_customer_email :=
    nullif(
      lower(
        btrim(
          coalesce(
            p_customer_email,
            ''
          )
        )
      ),
      ''
    );


  v_customer_phone :=
    nullif(
      btrim(
        coalesce(
          p_customer_phone,
          ''
        )
      ),
      ''
    );


  v_note :=
    btrim(
      coalesce(
        p_note,
        ''
      )
    );


  v_reference_number :=
    nullif(
      btrim(
        coalesce(
          p_reference_number,
          ''
        )
      ),
      ''
    );


  if
    v_customer_name is not null

    and
    length(
      v_customer_name
    ) > 160
  then

    raise exception
      'Customer name is too long';

  end if;


  if
    v_customer_email is not null
  then

    if
      length(
        v_customer_email
      ) > 320

      or

      position(
        '@'
        in
        v_customer_email
      ) = 0
    then

      raise exception
        'Customer email is invalid';

    end if;

  end if;


  if
    v_customer_phone is not null

    and
    length(
      v_customer_phone
    ) > 50
  then

    raise exception
      'Customer phone is too long';

  end if;


  if
    length(
      v_note
    ) > 1000
  then

    raise exception
      'Sale note is too long';

  end if;


  -- ==========================================================
  -- RESOLVE REGISTERED CUSTOMER
  --
  -- Explicit customer ID wins.
  --
  -- If no ID is supplied, NOVA also attempts to match the
  -- entered phone number to an active customer.
  -- ==========================================================

  if
    v_customer_id is null

    and

    v_customer_phone is not null
  then

    select
      customer_record.id

    into
      v_customer_id

    from public.customers
      as customer_record

    where
      customer_record.business_id =
        p_business_id

      and
      customer_record.phone_normalized =
        private.normalize_customer_phone(
          v_customer_phone
        )

      and
      customer_record.is_active =
        true

    limit 1;

  end if;


  if
    v_customer_id is not null
  then

    select

      customer_record.name,

      customer_record.email,

      customer_record.phone,

      customer_record.default_discount_percent,

      customer_record.phone_verified_at

    into

      v_customer_name,

      v_customer_email,

      v_customer_phone,

      v_customer_discount_percent,

      v_customer_phone_verified_at

    from public.customers
      as customer_record

    where
      customer_record.id =
        v_customer_id

      and
      customer_record.business_id =
        p_business_id

      and
      customer_record.is_active =
        true;


    if not found then

      raise exception
        'Selected customer could not be found';

    end if;


    -- ========================================================
    -- CUSTOMER LOYALTY LOCK
    --
    -- Prevents two tills from spending the same points at the
    -- same moment.
    -- ========================================================

    perform
      pg_catalog.pg_advisory_xact_lock(

        pg_catalog.hashtextextended(

          'loyalty:'
          ||
          p_business_id::text
          ||
          ':'
          ||
          v_customer_id::text,

          0

        )

      );


    insert into public.loyalty_settings (
      business_id
    )

    values (
      p_business_id
    )

    on conflict (
      business_id
    )

    do nothing;


    select

      setting_record.enabled,

      setting_record.spend_amount_per_earn,

      setting_record.points_earned,

      setting_record.redeem_points,

      setting_record.redeem_value,

      setting_record.minimum_redeem_points,

      setting_record.maximum_discount_percent,

      setting_record.allow_cashier_redeem,

      setting_record.require_verified_phone_for_redemption

    into

      v_loyalty_enabled,

      v_spend_amount_per_earn,

      v_points_earned_rule,

      v_redeem_points,

      v_redeem_value,

      v_minimum_redeem_points,

      v_maximum_discount_percent,

      v_allow_cashier_redeem,

      v_require_verified_phone

    from public.loyalty_settings
      as setting_record

    where
      setting_record.business_id =
        p_business_id;

  end if;


  -- ==========================================================
  -- BUSINESS
  -- ==========================================================

  select
    business_record.currency_code

  into
    v_currency_code

  from public.businesses
    as business_record

  where
    business_record.id =
      p_business_id;


  if
    v_currency_code is null
  then

    raise exception
      'Business not found';

  end if;


  -- ==========================================================
  -- DEFAULT INVENTORY LOCATION
  -- ==========================================================

  select
    location_record.id

  into
    v_location_id

  from public.inventory_locations
    as location_record

  where
    location_record.business_id =
      p_business_id

    and
    location_record.is_default =
      true

    and
    location_record.is_active =
      true

  limit 1;


  if
    v_location_id is null
  then

    raise exception
      'No active default inventory location is configured';

  end if;


  -- ==========================================================
  -- UNIQUE CART VARIANTS
  -- ==========================================================

  select
    count(*)::integer

  into
    v_requested_count

  from private.nova_checkout_items(
    p_items
  );


  if
    v_requested_count = 0
  then

    raise exception
      'Cart is empty';

  end if;


  -- ==========================================================
  -- ENSURE INVENTORY ROWS
  -- ==========================================================

  insert into public.inventory_levels (

    business_id,

    location_id,

    variant_id,

    on_hand,

    low_stock_threshold

  )

  select

    p_business_id,

    v_location_id,

    requested.variant_id,

    0,

    5

  from private.nova_checkout_items(
    p_items
  ) as requested


  join public.product_variants
    as variant_record

    on
      variant_record.id =
        requested.variant_id

    and
      variant_record.business_id =
        p_business_id


  on conflict (
    location_id,
    variant_id
  )

  do nothing;


  -- ==========================================================
  -- LOCK + VALIDATE STOCK + CALCULATE SUBTOTAL
  -- ==========================================================

  for v_item in

    select

      requested.variant_id,

      requested.quantity,

      variant_record.product_id,

      product_record.name
        as product_name,

      variant_record.name
        as variant_name,

      variant_record.sku,

      private.nova_effective_product_price(
        variant_record.price,
        product_record.promotion_enabled,
        product_record.promotion_type,
        product_record.promotion_value,
        product_record.promotion_starts_at,
        product_record.promotion_ends_at
      ) as price,

      variant_record.cost,

      inventory_record.on_hand


    from private.nova_checkout_items(
      p_items
    ) as requested


    join public.product_variants
      as variant_record

      on
        variant_record.id =
          requested.variant_id

      and
        variant_record.business_id =
          p_business_id

      and
        variant_record.is_active =
          true


    join public.products
      as product_record

      on
        product_record.id =
          variant_record.product_id

      and
        product_record.business_id =
          variant_record.business_id

      and
        product_record.status =
          'active'::public.nova_product_status


    join public.inventory_levels
      as inventory_record

      on
        inventory_record.business_id =
          p_business_id

      and
        inventory_record.location_id =
          v_location_id

      and
        inventory_record.variant_id =
          variant_record.id


    order by
      requested.variant_id


    for update of inventory_record


  loop

    v_processed_count :=
      v_processed_count +
      1;


    if
      v_item.quantity is null

      or
      v_item.quantity <= 0
    then

      raise exception
        'Item quantity must be greater than zero';

    end if;


    if
      v_item.quantity > 9999
    then

      raise exception
        'Item quantity is too large';

    end if;


    if
      v_item.on_hand <
      v_item.quantity
    then

      raise exception

        'Insufficient stock for % (%): requested %, available %',

        v_item.product_name,

        v_item.sku,

        v_item.quantity,

        v_item.on_hand;

    end if;
    v_item_quantity_total :=
      v_item_quantity_total +
      v_item.quantity;

  end loop;


  if
    v_processed_count <>
    v_requested_count
  then

    raise exception
      'One or more cart items are unavailable, inactive, or belong to another business';

  end if;

  select
    count(*)::integer,
    coalesce(
      sum(
        allocation.quantity
      ),
      0
    )::integer,
    coalesce(
      sum(
        allocation.unit_price *
        allocation.quantity
      ),
      0
    )::numeric(12,2)
  into
    v_requested_count,
    v_allocated_quantity,
    v_subtotal
  from private.arc_fifo_checkout_allocations(
    p_business_id,
    v_location_id,
    p_items
  ) as allocation;


  if
    v_allocated_quantity <>
    v_item_quantity_total
  then
    raise exception
      'FIFO price batches are out of sync with inventory. Refresh inventory and try again.';
  end if;


  v_subtotal :=
    round(
      v_subtotal,
      2
    );

  if
    v_subtotal <= 0
  then

    raise exception
      'Sale subtotal must be greater than zero';

  end if;


  if
    v_manual_discount_total >
    v_subtotal
  then

    raise exception
      'Discount cannot exceed the subtotal';

  end if;


  -- ==========================================================
  -- CUSTOMER PERMANENT DISCOUNT
  --
  -- It applies AFTER the ordinary/cart discount.
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_customer_discount_percent > 0
  then

    v_customer_discount_total :=
      round(

        (
          v_subtotal -
          v_manual_discount_total
        )

        *

        v_customer_discount_percent

        /

        100,

        2

      );

  end if;


  v_pre_loyalty_total :=
    round(

      v_subtotal
      -
      v_manual_discount_total
      -
      v_customer_discount_total,

      2

    );


  -- ==========================================================
  -- LOYALTY REDEMPTION
  -- ==========================================================

  if
    v_points_to_redeem > 0
  then

    if
      v_customer_id is null
    then

      raise exception
        'A registered customer is required to redeem loyalty points';

    end if;


    if not
      v_loyalty_enabled
    then

      raise exception
        'The loyalty program is currently disabled';

    end if;


    if
      not v_allow_cashier_redeem

      and

      not (
        select private.is_business_manager(
          p_business_id
        )
      )
    then

      raise exception
        'Manager access is required to redeem loyalty points'

        using errcode =
          '42501';

    end if;


    if
      v_require_verified_phone

      and

      v_customer_phone_verified_at is null
    then

      raise exception
        'This customer must verify their phone number before redeeming loyalty points';

    end if;


    select

      coalesce(
        sum(
          transaction_record.points_delta
        ),
        0
      )::integer

    into
      v_loyalty_balance

    from public.loyalty_transactions
      as transaction_record

    where
      transaction_record.business_id =
        p_business_id

      and
      transaction_record.customer_id =
        v_customer_id;


    if
      v_points_to_redeem >
      v_loyalty_balance
    then

      raise exception
        'Customer does not have enough loyalty points';

    end if;


    if
      v_points_to_redeem <
      v_minimum_redeem_points
    then

      raise exception
        'Minimum loyalty redemption is % points',
        v_minimum_redeem_points;

    end if;


    if
      mod(
        v_points_to_redeem,
        v_redeem_points
      ) <> 0
    then

      raise exception
        'Loyalty points must be redeemed in blocks of %',
        v_redeem_points;

    end if;


    v_loyalty_discount_total :=
      round(

        (
          v_points_to_redeem::numeric

          /

          v_redeem_points::numeric
        )

        *

        v_redeem_value,

        2

      );


    v_max_loyalty_discount :=
      round(

        v_pre_loyalty_total

        *

        v_maximum_discount_percent

        /

        100,

        2

      );


    if
      v_loyalty_discount_total >
      v_max_loyalty_discount
    then

      raise exception

        'Loyalty redemption exceeds the maximum allowed discount of %%%',

        v_maximum_discount_percent;

    end if;


    if
      v_loyalty_discount_total >
      v_pre_loyalty_total
    then

      raise exception
        'Loyalty redemption exceeds the sale total';

    end if;

  end if;


  -- ==========================================================
  -- COMBINED DISCOUNT
  -- ==========================================================

  v_discount_total :=
    round(

      v_manual_discount_total

      +

      v_customer_discount_total

      +

      v_loyalty_discount_total,

      2

    );


  -- ==========================================================
  -- AUTHORITATIVE TOTAL
  -- ==========================================================

  v_total :=
    round(

      v_subtotal

      -

      v_discount_total

      +

      v_tax_total,

      2

    );


  /*
   * Keep a small payable amount for the current payment
   * architecture.
   *
   * Later, if we add fully loyalty-paid sales, NOVA can support
   * zero-payment transactions explicitly.
   */

  if
    v_total <= 0
  then

    raise exception
      'Discounts cannot reduce the payable sale total to zero';

  end if;


  -- ==========================================================
  -- CALCULATE POINTS TO EARN
  --
  -- Earn from the actual amount paid AFTER all discounts.
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_loyalty_enabled

    and
    v_spend_amount_per_earn > 0
  then

    v_points_earned :=

      floor(
        v_total /
        v_spend_amount_per_earn
      )::integer

      *

      v_points_earned_rule;

  end if;


  -- ==========================================================
  -- PAYMENT VALIDATION
  -- ==========================================================

  if
    p_payment_method =
      'cash'::public.nova_payment_method
  then

    v_cash_received :=
      round(
        coalesce(
          p_cash_received,
          0
        ),
        2
      );


    if
      v_cash_received <
      v_total
    then

      raise exception

        'Cash received is less than the live sale total of % %',

        v_currency_code,

        v_total;

    end if;


    v_change_due :=
      round(

        v_cash_received -
        v_total,

        2

      );

  else

    v_cash_received :=
      null;


    v_change_due :=
      null;

  end if;


  -- ==========================================================
  -- RECEIPT
  -- ==========================================================

  select

    identity.receipt_sequence,

    identity.receipt_number

  into

    v_receipt_sequence,

    v_receipt_number

  from private.next_receipt_identity(
    p_business_id
  ) as identity;


  -- ==========================================================
  -- CREATE SALE
  -- ==========================================================

  insert into public.sales
  as inserted_sale (

    business_id,

    location_id,

    checkout_key,

    receipt_sequence,

    receipt_number,

    currency_code,

    status,

    cashier_user_id,

    cashier_label,

    customer_id,

    customer_name,

    customer_email,

    customer_phone,

    subtotal,

    manual_discount_total,

    customer_discount_total,

    loyalty_discount_total,

    discount_total,

    tax_total,

    total,

    item_quantity_total,

    loyalty_points_redeemed,

    loyalty_points_earned,

    note

  )

  values (

    p_business_id,

    v_location_id,

    p_checkout_key,

    v_receipt_sequence,

    v_receipt_number,

    v_currency_code,

    'completed'::public.nova_sale_status,

    v_user_id,

    v_cashier_label,

    v_customer_id,

    v_customer_name,

    v_customer_email,

    v_customer_phone,

    v_subtotal,

    v_manual_discount_total,

    v_customer_discount_total,

    v_loyalty_discount_total,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    v_points_to_redeem,

    v_points_earned,

    v_note

  )

  returning

  inserted_sale.id,

  inserted_sale.created_at

into

  v_sale_id,

  v_created_at;


  -- ==========================================================
  -- SALE ITEMS + INVENTORY
  -- ==========================================================

  for v_item in

    select
      allocation.variant_id,
      allocation.batch_id,
      allocation.quantity,
      allocation.regular_price,
      allocation.unit_price
        as price,
      allocation.unit_cost
        as cost,
      allocation.batch_order,
      variant_record.product_id,
      product_record.name
        as product_name,
      variant_record.name
        as variant_name,
      variant_record.sku

    from private.arc_fifo_checkout_allocations(
      p_business_id,
      v_location_id,
      p_items
    ) as allocation

    join public.product_variants
      as variant_record
      on
        variant_record.id =
          allocation.variant_id
      and
        variant_record.business_id =
          p_business_id

    join public.products
      as product_record
      on
        product_record.id =
          variant_record.product_id
      and
        product_record.business_id =
          variant_record.business_id

    order by
      allocation.variant_id,
      allocation.batch_order,
      allocation.batch_id


  loop

    v_inserted_count :=
      v_inserted_count +
      1;


    v_line_subtotal :=
      round(

        v_item.price *
        v_item.quantity,

        2

      );


    -- ========================================================
    -- ALLOCATE ALL DISCOUNTS ACROSS ITEM LINES
    --
    -- This keeps partial refund maths correct.
    -- ========================================================

    if
      v_discount_total > 0
    then

      if
        v_inserted_count =
        v_requested_count
      then

        v_line_discount :=
          round(

            v_discount_total -
            v_allocated_discount,

            2

          );

      else

        v_line_discount :=
          round(

            v_discount_total

            *

            v_line_subtotal

            /

            v_subtotal,

            2

          );

      end if;

    else

      v_line_discount :=
        0;

    end if;


    v_allocated_discount :=
      v_allocated_discount +
      v_line_discount;


    insert into public.sale_items (

      business_id,

      sale_id,

      product_id,

      variant_id,

      product_name,

      variant_name,

      sku,

      quantity,

      unit_price,

      unit_cost,


      batch_id,

      regular_unit_price,

      line_subtotal,

      discount_total,

      tax_total,

      line_total

    )

    values (

      p_business_id,

      v_sale_id,

      v_item.product_id,

      v_item.variant_id,

      v_item.product_name,

      v_item.variant_name,

      v_item.sku,

      v_item.quantity,

      v_item.price,

      v_item.cost,


      v_item.batch_id,

      v_item.regular_price,

      v_line_subtotal,

      v_line_discount,

      0,

      round(

        v_line_subtotal -
        v_line_discount,

        2

      )

    );

    select
      inventory_record.on_hand
    into
      v_before
    from public.inventory_levels
      as inventory_record
    where
      inventory_record.business_id =
        p_business_id
      and
      inventory_record.location_id =
        v_location_id
      and
      inventory_record.variant_id =
        v_item.variant_id
    for update;


    v_after :=
      v_before -
      v_item.quantity;


    update public.inventory_levels

    set

      on_hand =
        v_after,

      updated_at =
        now()

    where
      business_id =
        p_business_id

      and
      location_id =
        v_location_id

      and
      variant_id =
        v_item.variant_id;


    update public.inventory_price_batches
      as batch_record
    set
      remaining_quantity =
        batch_record.remaining_quantity -
        v_item.quantity
    where
      batch_record.id =
        v_item.batch_id
      and
      batch_record.business_id =
        p_business_id
      and
      batch_record.location_id =
        v_location_id
      and
      batch_record.variant_id =
        v_item.variant_id
      and
      batch_record.remaining_quantity >=
        v_item.quantity;


    if not found then
      raise exception
        'FIFO price batch changed during checkout. Please retry the sale.';
    end if;


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

      reference_type,

      reference_id,

      actor_user_id

    )

    values (

      p_business_id,

      v_location_id,

      v_item.variant_id,

      'sale'::public.nova_inventory_movement_type,

      -v_item.quantity,

      v_before,

      v_after,

      'Sale',

      v_receipt_number,

      'sale',

      v_sale_id,

      v_user_id

    );

  end loop;


  -- ==========================================================
  -- PAYMENT
  -- ==========================================================

  insert into public.payments (

    business_id,

    sale_id,

    method,

    status,

    amount,

    reference_number,

    cash_received,

    change_due,

    received_by_user_id

  )

  values (

    p_business_id,

    v_sale_id,

    p_payment_method,

    'completed'::public.nova_payment_status,

    v_total,

    v_reference_number,

    v_cash_received,

    v_change_due,

    v_user_id

  );


  -- ==========================================================
  -- LOYALTY REDEMPTION LEDGER
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_points_to_redeem > 0
  then

    insert into public.loyalty_transactions (

      business_id,

      customer_id,

      transaction_type,

      points_delta,

      monetary_value,

      sale_id,

      description,

      actor_user_id

    )

    values (

      p_business_id,

      v_customer_id,

      'redeem'::public.nova_loyalty_transaction_type,

      -v_points_to_redeem,

      v_loyalty_discount_total,

      v_sale_id,

      'Redeemed on ' ||
      v_receipt_number,

      v_user_id

    );

  end if;


  -- ==========================================================
  -- LOYALTY EARNING LEDGER
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_points_earned > 0
  then

    insert into public.loyalty_transactions (

      business_id,

      customer_id,

      transaction_type,

      points_delta,

      monetary_value,

      sale_id,

      description,

      actor_user_id

    )

    values (

      p_business_id,

      v_customer_id,

      'earn'::public.nova_loyalty_transaction_type,

      v_points_earned,

      v_total,

      v_sale_id,

      'Earned from ' ||
      v_receipt_number,

      v_user_id

    );

  end if;


  -- ==========================================================
  -- RESULT
  -- ==========================================================

  return query

  select

    v_sale_id,

    v_receipt_number,

    v_receipt_sequence,

    v_currency_code,

    v_subtotal,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    p_payment_method::text,

    v_cash_received,

    v_change_due,

    v_created_at,

    false;


end;

$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function
public.complete_sale(

  uuid,

  uuid,

  jsonb,

  public.nova_payment_method,

  numeric,

  text,

  numeric,

  text,

  text,

  text,

  text,

  uuid,

  integer

)

from
  public,
  anon;


grant execute
on function
public.complete_sale(

  uuid,

  uuid,

  jsonb,

  public.nova_payment_method,

  numeric,

  text,

  numeric,

  text,

  text,

  text,

  text,

  uuid,

  integer

)

to authenticated;


comment on function
public.complete_sale(

  uuid,

  uuid,

  jsonb,

  public.nova_payment_method,

  numeric,

  text,

  numeric,

  text,

  text,

  text,

  text,

  uuid,

  integer

)

is
'NOVA atomic checkout with registered customers, permanent customer discounts, loyalty redemption and loyalty earning.';







notify pgrst,
'reload schema';
