-- ============================================================
-- ARC POS
-- PHASE 6A — WEIGHTED-AVERAGE STOCK COST
--
-- Purpose:
--   • Accept a supplier/unit cost when stock is received.
--   • Preserve one permanent product barcode / variant identity.
--   • Recalculate variant cost using weighted-average costing.
--   • Optionally update the live selling price on the same receipt.
--   • Keep the existing adjust_inventory() RPC untouched for
--     ordinary stock adjustments.
--
-- Run this migration in Supabase before testing cost-aware Stock In.
-- ============================================================


create or replace function public.adjust_inventory_with_cost(
  p_variant_id uuid,
  p_location_id uuid,
  p_delta integer,
  p_movement_type public.nova_inventory_movement_type,
  p_reason text default '',
  p_note text default '',
  p_incoming_unit_cost numeric default null,
  p_new_selling_price numeric default null
)
returns table (
  new_on_hand integer,
  movement_id uuid,
  average_cost numeric,
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
  v_location_business_id uuid;

  v_before integer;
  v_after integer;

  v_total_stock_before integer := 0;

  v_cost_before numeric(12,2) := 0;
  v_cost_after numeric(12,2) := 0;
  v_price_after numeric(12,2) := 0;

  v_movement_id uuid;
begin

  if v_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if p_delta = 0 then
    raise exception
      'Inventory adjustment cannot be zero';
  end if;


  if
    p_incoming_unit_cost is not null
    and p_incoming_unit_cost < 0
  then
    raise exception
      'Incoming unit cost cannot be negative';
  end if;


  if
    p_new_selling_price is not null
    and p_new_selling_price < 0
  then
    raise exception
      'Selling price cannot be negative';
  end if;


  if
    (
      p_incoming_unit_cost is not null
      or p_new_selling_price is not null
    )
    and
    (
      p_delta <= 0
      or p_movement_type <>
        'stock_in'::public.nova_inventory_movement_type
    )
  then
    raise exception
      'Cost or selling price can only be supplied for Stock In';
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
    v_cost_before,
    v_price_after
  from public.product_variants
    as variant_record
  where
    variant_record.id =
      p_variant_id
  for update;


  if v_business_id is null then
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


  -- Serialize receipts for the same business + variant so
  -- simultaneous deliveries cannot calculate from stale cost.
  perform
    pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'arc-inventory-cost:'
        ||
        v_business_id::text
        ||
        ':'
        ||
        p_variant_id::text,
        0
      )
    );


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


  if v_after < 0 then
    raise exception
      'Insufficient stock: current %, change %',
      v_before,
      p_delta;
  end if;


  select
    coalesce(
      sum(
        level_record.on_hand
      ),
      0
    )::integer
  into
    v_total_stock_before
  from public.inventory_levels
    as level_record
  where
    level_record.business_id =
      v_business_id
    and
    level_record.variant_id =
      p_variant_id;


  v_cost_after :=
    v_cost_before;


  if
    p_incoming_unit_cost is not null
    and p_delta > 0
  then

    if
      v_total_stock_before +
      p_delta >
      0
    then
      v_cost_after :=
        round(
          (
            (
              v_total_stock_before::numeric
              *
              v_cost_before
            )
            +
            (
              p_delta::numeric
              *
              p_incoming_unit_cost
            )
          )
          /
          (
            v_total_stock_before +
            p_delta
          )::numeric,
          2
        );
    else
      v_cost_after :=
        round(
          p_incoming_unit_cost,
          2
        );
    end if;

  end if;


  if
    p_new_selling_price is not null
  then
    v_price_after :=
      round(
        p_new_selling_price,
        2
      );
  end if;


  update public.product_variants
  set
    cost =
      v_cost_after,
    price =
      v_price_after
  where
    id =
      p_variant_id
    and
    business_id =
      v_business_id;


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
    case
      when
        p_incoming_unit_cost is not null
      then
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
          'Incoming cost LKR '
          ||
          to_char(
            p_incoming_unit_cost,
            'FM999999999990.00'
          ),
          'Average cost LKR '
          ||
          to_char(
            v_cost_after,
            'FM999999999990.00'
          )
        )
      else
        coalesce(
          p_note,
          ''
        )
    end,
    v_user_id
  )
  returning
    id
  into
    v_movement_id;


  return query
  select
    v_after,
    v_movement_id,
    v_cost_after,
    v_price_after;

end;
$$;


revoke all
on function public.adjust_inventory_with_cost(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text,
  numeric,
  numeric
)
from
  public,
  anon;


grant execute
on function public.adjust_inventory_with_cost(
  uuid,
  uuid,
  integer,
  public.nova_inventory_movement_type,
  text,
  text,
  numeric,
  numeric
)
to authenticated;


notify pgrst,
'reload schema';
