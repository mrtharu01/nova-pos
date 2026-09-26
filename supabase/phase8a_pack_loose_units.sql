-- ============================================================
-- ARC POS
-- PHASE 8A — OPTIONAL PACK / LOOSE UNIT INVENTORY
--
-- Normal products are unchanged.
--
-- For products that opt in:
--   parent variant: Pack of 6
--   child variant:  Single
--   relation:       1 Pack -> 6 Singles
--
-- Inventory remains physically truthful:
--   10 packs + 0 loose
-- becomes, after one explicit break:
--    9 packs + 6 loose
--
-- FIFO cost is inherited from the exact parent batch opened.
-- ============================================================


-- ============================================================
-- 1. PRODUCT / VARIANT MODEL
-- ============================================================

alter table public.products
add column if not exists multi_unit_enabled
boolean not null default false;


alter table public.product_variants
add column if not exists unit_parent_variant_id
uuid;


alter table public.product_variants
add column if not exists units_per_parent
integer not null default 1;


do $$
begin

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'product_variants_unit_parent_fk'
  )
  then

    alter table public.product_variants
    add constraint
      product_variants_unit_parent_fk
    foreign key (
      unit_parent_variant_id
    )
    references public.product_variants(id)
    on delete set null;

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname =
      'product_variants_units_per_parent_check'
  )
  then

    alter table public.product_variants
    add constraint
      product_variants_units_per_parent_check
    check (
      unit_parent_variant_id is null
      or
      units_per_parent >= 2
    );

  end if;


  if not exists (
    select 1
    from pg_constraint
    where conname =
      'product_variants_unit_parent_not_self_check'
  )
  then

    alter table public.product_variants
    add constraint
      product_variants_unit_parent_not_self_check
    check (
      unit_parent_variant_id is null
      or
      unit_parent_variant_id <> id
    );

  end if;

end;
$$;


create index if not exists
product_variants_unit_parent_idx
on public.product_variants(
  unit_parent_variant_id
)
where
  unit_parent_variant_id
    is not null;


-- ============================================================
-- 2. PACK BREAK AUDIT EVENT
-- ============================================================

create table if not exists
public.inventory_unit_breaks (
  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  location_id uuid not null
    references public.inventory_locations(id)
    on delete restrict,

  parent_variant_id uuid not null
    references public.product_variants(id)
    on delete restrict,

  child_variant_id uuid not null
    references public.product_variants(id)
    on delete restrict,

  parent_quantity integer not null
    check (
      parent_quantity > 0
    ),

  units_per_parent integer not null
    check (
      units_per_parent >= 2
    ),

  child_quantity integer not null
    check (
      child_quantity > 0
    ),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now()
);


create index if not exists
inventory_unit_breaks_business_created_idx
on public.inventory_unit_breaks(
  business_id,
  created_at desc
);


alter table
public.inventory_unit_breaks
enable row level security;


revoke all
on table public.inventory_unit_breaks
from
  anon,
  authenticated;


grant select
on table public.inventory_unit_breaks
to authenticated;


drop policy if exists
arc_inventory_unit_breaks_select
on public.inventory_unit_breaks;


create policy
arc_inventory_unit_breaks_select
on public.inventory_unit_breaks
for select
to authenticated
using (
  (
    select private.is_business_member(
      business_id
    )
  )
);


-- ============================================================
-- 3. PRODUCT SAVE V4
--
-- Extra JSON fields accepted per variant:
--   unit_parent_sku
--   units_per_parent
--
-- V3 remains in place for backwards compatibility.
-- ============================================================

create or replace function
public.save_product_with_promotion_v4(

  p_product_id uuid,

  p_name text,

  p_description text,

  p_category_id uuid,

  p_image_path text,

  p_status public.nova_product_status,

  p_variants jsonb,

  p_promotion_enabled boolean default false,

  p_promotion_type text default 'percentage',

  p_promotion_value numeric default 0,

  p_promotion_starts_at timestamptz default null,

  p_promotion_ends_at timestamptz default null,

  p_multi_unit_enabled boolean default false

)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare
  v_business_id uuid;

  v_product_id uuid;

  v_variant jsonb;

  v_child_id uuid;

  v_parent_id uuid;

  v_child_sku text;

  v_parent_sku text;

  v_units_per_parent integer;

  v_cycle_exists boolean :=
    false;

begin

  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null
    or not (
      select private.is_business_manager(
        v_business_id
      )
    )
  then

    raise exception
      'Manager access required'
      using errcode =
        '42501';

  end if;


  v_product_id :=
    public.save_product_with_promotion_v3(

      p_product_id,

      p_name,

      p_description,

      p_category_id,

      p_image_path,

      p_status,

      p_variants,

      p_promotion_enabled,

      p_promotion_type,

      p_promotion_value,

      p_promotion_starts_at,

      p_promotion_ends_at

    );


  update public.products
  set
    multi_unit_enabled =
      p_multi_unit_enabled,
    updated_at =
      now()
  where
    id =
      v_product_id
    and
    business_id =
      v_business_id;


  if
    not p_multi_unit_enabled
  then

    update public.product_variants
    set
      unit_parent_variant_id =
        null,
      units_per_parent =
        1,
      updated_at =
        now()
    where
      product_id =
        v_product_id
      and
      business_id =
        v_business_id;


    return
      v_product_id;

  end if;


  -- First clear old links so edited relationships are rebuilt
  -- entirely from the submitted variant payload.

  update public.product_variants
  set
    unit_parent_variant_id =
      null,
    units_per_parent =
      1,
    updated_at =
      now()
  where
    product_id =
      v_product_id
    and
    business_id =
      v_business_id;


  for
    v_variant
  in
    select value
    from jsonb_array_elements(
      p_variants
    )

  loop

    v_child_sku :=
      upper(
        btrim(
          coalesce(
            v_variant
              ->>
              'sku',
            ''
          )
        )
      );


    v_parent_sku :=
      nullif(
        upper(
          btrim(
            coalesce(
              v_variant
                ->>
                'unit_parent_sku',
              ''
            )
          )
        ),
        ''
      );


    if
      v_parent_sku is null
    then
      continue;
    end if;


    v_units_per_parent :=
      coalesce(
        nullif(
          v_variant
            ->>
            'units_per_parent',
          ''
        )::integer,
        0
      );


    if
      v_units_per_parent <
        2
    then

      raise exception
        'A breakable unit must produce at least 2 child units';

    end if;


    select
      child_variant.id
    into
      v_child_id
    from public.product_variants
      as child_variant
    where
      child_variant.business_id =
        v_business_id
      and
      child_variant.product_id =
        v_product_id
      and
      upper(
        child_variant.sku
      ) =
        v_child_sku;


    if
      v_child_id is null
    then

      raise exception
        'Child unit variant could not be resolved';

    end if;


    select
      parent_variant.id
    into
      v_parent_id
    from public.product_variants
      as parent_variant
    where
      parent_variant.business_id =
        v_business_id
      and
      parent_variant.product_id =
        v_product_id
      and
      upper(
        parent_variant.sku
      ) =
        v_parent_sku;


    if
      v_parent_id is null
    then

      raise exception
        'Parent unit variant could not be resolved';

    end if;


    if
      v_parent_id =
      v_child_id
    then

      raise exception
        'A unit cannot be its own parent';

    end if;


    update public.product_variants
    set
      unit_parent_variant_id =
        v_parent_id,
      units_per_parent =
        v_units_per_parent,
      updated_at =
        now()
    where
      id =
        v_child_id
      and
      business_id =
        v_business_id;

  end loop;


  -- Reject circular chains such as Pack -> Single -> Pack.

  with recursive
  unit_chain as (

    select
      variant_record.id
        as start_id,

      variant_record.id
        as current_id,

      variant_record.unit_parent_variant_id
        as next_id,

      array[
        variant_record.id
      ]::uuid[]
        as path,

      false
        as is_cycle

    from public.product_variants
      as variant_record

    where
      variant_record.business_id =
        v_business_id
      and
      variant_record.product_id =
        v_product_id
      and
      variant_record.unit_parent_variant_id
        is not null


    union all


    select
      chain.start_id,

      parent_variant.id,

      parent_variant.unit_parent_variant_id,

      chain.path ||
        parent_variant.id,

      parent_variant.id =
        any(
          chain.path
        )

    from unit_chain
      as chain

    join public.product_variants
      as parent_variant
      on
        parent_variant.id =
          chain.next_id
      and
        parent_variant.business_id =
          v_business_id
      and
        parent_variant.product_id =
          v_product_id

    where
      chain.next_id
        is not null
      and
      not chain.is_cycle

  )

  select
    exists (
      select 1
      from unit_chain
      where
        is_cycle
    )
  into
    v_cycle_exists;


  if
    v_cycle_exists
  then

    raise exception
      'Unit conversion links cannot form a circular chain';

  end if;


  return
    v_product_id;

end;

$$;


revoke all
on function
public.save_product_with_promotion_v4(
  uuid,
  text,
  text,
  uuid,
  text,
  public.nova_product_status,
  jsonb,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz,
  boolean
)
from
  public,
  anon;


grant execute
on function
public.save_product_with_promotion_v4(
  uuid,
  text,
  text,
  uuid,
  text,
  public.nova_product_status,
  jsonb,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz,
  boolean
)
to authenticated;


-- ============================================================
-- 4. BREAK PARENT STOCK INTO CHILD STOCK
--
-- Any active business member can do this because cashiers need
-- to open a pack while serving a customer.
-- ============================================================

create or replace function
public.break_inventory_unit(
  p_child_variant_id uuid,
  p_location_id uuid,
  p_parent_quantity integer
    default 1
)
returns table (
  break_id uuid,
  parent_variant_id uuid,
  parent_variant_name text,
  parent_quantity integer,
  child_variant_id uuid,
  child_variant_name text,
  child_quantity integer,
  units_per_parent integer
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

  v_parent_variant_id uuid;

  v_parent_name text;

  v_child_name text;

  v_units_per_parent integer;

  v_parent_before integer :=
    0;

  v_child_before integer :=
    0;

  v_child_quantity integer :=
    0;

  v_remaining_parent integer :=
    0;

  v_take integer :=
    0;

  v_break_id uuid :=
    gen_random_uuid();

  v_parent_movement_id uuid :=
    gen_random_uuid();

  v_child_movement_id uuid :=
    gen_random_uuid();

  v_child_regular_price numeric(12,2) :=
    0;

  v_batch record;

begin

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'
      using errcode =
        '42501';

  end if;


  if
    p_parent_quantity is null
    or
    p_parent_quantity <=
      0
  then

    raise exception
      'Pack quantity must be greater than zero';

  end if;


  select
    child_variant.business_id,

    child_variant.product_id,

    child_variant.unit_parent_variant_id,

    child_variant.units_per_parent,

    child_variant.name,

    child_variant.price,

    parent_variant.name

  into
    v_business_id,

    v_product_id,

    v_parent_variant_id,

    v_units_per_parent,

    v_child_name,

    v_child_regular_price,

    v_parent_name

  from public.product_variants
    as child_variant

  join public.products
    as product_record
    on
      product_record.id =
        child_variant.product_id
      and
      product_record.business_id =
        child_variant.business_id
      and
      product_record.multi_unit_enabled =
        true

  join public.product_variants
    as parent_variant
    on
      parent_variant.id =
        child_variant.unit_parent_variant_id
      and
      parent_variant.business_id =
        child_variant.business_id
      and
      parent_variant.product_id =
        child_variant.product_id

  where
    child_variant.id =
      p_child_variant_id
    and
    child_variant.is_active =
      true
    and
    parent_variant.is_active =
      true;


  if
    v_business_id is null
    or
    v_parent_variant_id is null
  then

    raise exception
      'This unit is not configured for pack breaking';

  end if;


  if not (
    select private.is_business_member(
      v_business_id
    )
  )
  then

    raise exception
      'Active business access required'
      using errcode =
        '42501';

  end if;


  if not exists (
    select 1
    from public.inventory_locations
      as location_record
    where
      location_record.id =
        p_location_id
      and
      location_record.business_id =
        v_business_id
      and
      location_record.is_active =
        true
  )
  then

    raise exception
      'Inventory location not found';

  end if;


  v_child_quantity :=
    p_parent_quantity *
    v_units_per_parent;


  -- Make sure both inventory rows exist before taking locks.

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
    v_parent_variant_id,
    0,
    5
  )
  on conflict (
    location_id,
    variant_id
  )
  do nothing;


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
    p_child_variant_id,
    0,
    5
  )
  on conflict (
    location_id,
    variant_id
  )
  do nothing;


  -- Lock in deterministic variant-id order to avoid deadlocks.

  perform
    level_record.id
  from public.inventory_levels
    as level_record
  where
    level_record.business_id =
      v_business_id
    and
    level_record.location_id =
      p_location_id
    and
    level_record.variant_id in (
      v_parent_variant_id,
      p_child_variant_id
    )
  order by
    level_record.variant_id
  for update;


  select
    level_record.on_hand
  into
    v_parent_before
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
      v_parent_variant_id;


  select
    level_record.on_hand
  into
    v_child_before
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
      p_child_variant_id;


  if
    v_parent_before <
    p_parent_quantity
  then

    raise exception
      'Not enough sealed parent stock. Requested %, available %',
      p_parent_quantity,
      v_parent_before;

  end if;


  insert into public.inventory_unit_breaks (
    id,
    business_id,
    location_id,
    parent_variant_id,
    child_variant_id,
    parent_quantity,
    units_per_parent,
    child_quantity,
    actor_user_id
  )
  values (
    v_break_id,
    v_business_id,
    p_location_id,
    v_parent_variant_id,
    p_child_variant_id,
    p_parent_quantity,
    v_units_per_parent,
    v_child_quantity,
    v_user_id
  );


  insert into public.inventory_movements (
    id,
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
    v_parent_movement_id,
    v_business_id,
    p_location_id,
    v_parent_variant_id,
    'stock_out'::public.nova_inventory_movement_type,
    -p_parent_quantity,
    v_parent_before,
    v_parent_before -
      p_parent_quantity,
    'Pack break',
    format(
      'Opened %s × %s to create %s × %s',
      p_parent_quantity,
      v_parent_name,
      v_child_quantity,
      v_child_name
    ),
    'unit_break',
    v_break_id,
    v_user_id
  );


  insert into public.inventory_movements (
    id,
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
    v_child_movement_id,
    v_business_id,
    p_location_id,
    p_child_variant_id,
    'stock_in'::public.nova_inventory_movement_type,
    v_child_quantity,
    v_child_before,
    v_child_before +
      v_child_quantity,
    'Pack break',
    format(
      'Created from %s × %s',
      p_parent_quantity,
      v_parent_name
    ),
    'unit_break',
    v_break_id,
    v_user_id
  );


  v_remaining_parent :=
    p_parent_quantity;


  for
    v_batch
  in

    select
      batch_record.id,
      batch_record.remaining_quantity,
      batch_record.unit_cost

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
        v_parent_variant_id
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
      v_remaining_parent <=
        0;


    v_take :=
      least(
        v_remaining_parent,
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


    insert into public.inventory_price_batches (
      business_id,
      location_id,
      variant_id,
      initial_quantity,
      remaining_quantity,
      unit_cost,
      regular_unit_price,
      source_movement_id,
      source_reference,
      received_at,
      created_by_user_id
    )
    values (
      v_business_id,
      p_location_id,
      p_child_variant_id,
      v_take *
        v_units_per_parent,
      v_take *
        v_units_per_parent,
      round(
        v_batch.unit_cost /
        v_units_per_parent,
        2
      ),
      v_child_regular_price,
      v_child_movement_id,
      'unit-break:'
        ||
        v_break_id::text
        ||
        ':'
        ||
        v_batch.id::text,
      clock_timestamp(),
      v_user_id
    );


    v_remaining_parent :=
      v_remaining_parent -
      v_take;

  end loop;


  if
    v_remaining_parent <>
      0
  then

    raise exception
      'FIFO parent batches are out of sync with sealed stock';

  end if;


  update public.inventory_levels
  set
    on_hand =
      v_parent_before -
      p_parent_quantity
  where
    business_id =
      v_business_id
    and
    location_id =
      p_location_id
    and
    variant_id =
      v_parent_variant_id;


  update public.inventory_levels
  set
    on_hand =
      v_child_before +
      v_child_quantity
  where
    business_id =
      v_business_id
    and
    location_id =
      p_location_id
    and
    variant_id =
      p_child_variant_id;


  return query

  select
    v_break_id,
    v_parent_variant_id,
    v_parent_name,
    p_parent_quantity,
    p_child_variant_id,
    v_child_name,
    v_child_quantity,
    v_units_per_parent;

end;

$$;


revoke all
on function
public.break_inventory_unit(
  uuid,
  uuid,
  integer
)
from
  public,
  anon;


grant execute
on function
public.break_inventory_unit(
  uuid,
  uuid,
  integer
)
to authenticated;


-- ============================================================
-- 5. CATALOG VIEW
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
    as default_cost,

  p.multi_unit_enabled,

  pv.unit_parent_variant_id,

  pv.units_per_parent

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


notify pgrst,
'reload schema';
