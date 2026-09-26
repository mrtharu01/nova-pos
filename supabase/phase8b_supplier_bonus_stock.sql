-- ============================================================
-- ARC POS
-- PHASE 8B — SUPPLIER BONUS / FREE STOCK
--
-- Example:
--   buy 12 @ LKR 1,000 + receive 1 free
--   invoice cost       = LKR 12,000
--   physical received  = 13
--   effective FIFO cost = 12,000 / 13 = LKR 923.08
--
-- Normal stock receiving remains unchanged. This migration adds
-- a dedicated audited wrapper for same-variant supplier bonuses.
-- ============================================================


-- ============================================================
-- 1. SUPPLIER BONUS RECEIPT AUDIT
-- ============================================================

create table if not exists public.inventory_supplier_bonus_receipts (
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

  movement_id uuid not null unique
    references public.inventory_movements(id)
    on delete cascade,

  batch_id uuid not null unique
    references public.inventory_price_batches(id)
    on delete cascade,

  paid_quantity integer not null
    check (paid_quantity > 0),

  bonus_quantity integer not null
    check (bonus_quantity > 0),

  total_received integer not null
    check (
      total_received > 0
      and
      total_received =
        paid_quantity +
        bonus_quantity
    ),

  supplier_unit_cost numeric(12,2) not null
    check (supplier_unit_cost >= 0),

  invoice_cost numeric(14,2) not null
    check (invoice_cost >= 0),

  effective_unit_cost numeric(12,2) not null
    check (effective_unit_cost >= 0),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null default now()
);


create index if not exists
inventory_supplier_bonus_receipts_business_created_idx
on public.inventory_supplier_bonus_receipts (
  business_id,
  created_at desc
);


create index if not exists
inventory_supplier_bonus_receipts_variant_idx
on public.inventory_supplier_bonus_receipts (
  business_id,
  variant_id,
  created_at desc
);


alter table public.inventory_supplier_bonus_receipts
enable row level security;


drop policy if exists
arc_inventory_supplier_bonus_receipts_select
on public.inventory_supplier_bonus_receipts;


create policy
arc_inventory_supplier_bonus_receipts_select
on public.inventory_supplier_bonus_receipts
for select
to authenticated
using (
  private.is_business_member(
    business_id
  )
);


revoke all
on public.inventory_supplier_bonus_receipts
from
  anon,
  authenticated;


grant select
on public.inventory_supplier_bonus_receipts
to authenticated;


-- ============================================================
-- 2. RECEIVE SAME-VARIANT SUPPLIER BONUS
--
-- This wrapper deliberately calls the existing Phase 6A
-- receive_inventory_batch RPC so all existing FIFO, promotion,
-- movement and default-price behavior remains authoritative.
-- ============================================================

create or replace function
public.receive_inventory_supplier_bonus(
  p_variant_id uuid,
  p_location_id uuid,
  p_paid_quantity integer,
  p_bonus_quantity integer,
  p_supplier_unit_cost numeric default null,
  p_selling_price numeric default null,
  p_reason text default 'Supplier bonus stock',
  p_note text default ''
)
returns table (
  new_on_hand integer,
  movement_id uuid,
  batch_id uuid,
  paid_quantity integer,
  bonus_quantity integer,
  total_received integer,
  supplier_unit_cost numeric,
  invoice_cost numeric,
  effective_unit_cost numeric,
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

  v_supplier_unit_cost numeric(12,2);
  v_invoice_cost numeric(14,2);
  v_effective_unit_cost numeric(12,2);
  v_total_received integer;

  v_receive record;
  v_audit_note text;
begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if
    p_paid_quantity is null
    or
    p_paid_quantity <= 0
  then
    raise exception
      'Purchased quantity must be greater than zero';
  end if;


  if
    p_bonus_quantity is null
    or
    p_bonus_quantity <= 0
  then
    raise exception
      'Bonus quantity must be greater than zero';
  end if;


  if
    p_supplier_unit_cost is not null
    and
    p_supplier_unit_cost < 0
  then
    raise exception
      'Supplier unit cost cannot be negative';
  end if;


  select
    variant_record.business_id,
    coalesce(
      p_supplier_unit_cost,
      variant_record.cost,
      0
    )::numeric(12,2)
  into
    v_business_id,
    v_supplier_unit_cost
  from public.product_variants
    as variant_record
  where
    variant_record.id =
      p_variant_id;


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
  )
  then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  v_total_received :=
    p_paid_quantity +
    p_bonus_quantity;


  v_invoice_cost :=
    round(
      p_paid_quantity *
      v_supplier_unit_cost,
      2
    );


  v_effective_unit_cost :=
    round(
      v_invoice_cost /
      v_total_received,
      2
    );


  v_audit_note :=
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
      format(
        'Supplier deal: paid %s + free %s = %s received',
        p_paid_quantity,
        p_bonus_quantity,
        v_total_received
      ),
      'Invoice cost LKR '
        ||
        to_char(
          v_invoice_cost,
          'FM999999999990.00'
        ),
      'Effective FIFO cost LKR '
        ||
        to_char(
          v_effective_unit_cost,
          'FM999999999990.00'
        )
    );


  select
    receive_result.*
  into
    v_receive
  from public.receive_inventory_batch(
    p_variant_id,
    p_location_id,
    v_total_received,
    v_effective_unit_cost,
    p_selling_price,
    coalesce(
      nullif(
        btrim(
          coalesce(
            p_reason,
            ''
          )
        ),
        ''
      ),
      'Supplier bonus stock'
    ),
    v_audit_note
  ) as receive_result;


  if
    v_receive.movement_id is null
    or
    v_receive.batch_id is null
  then
    raise exception
      'ARC did not return the supplier bonus FIFO batch';
  end if;


  insert into public.inventory_supplier_bonus_receipts (
    business_id,
    location_id,
    variant_id,
    movement_id,
    batch_id,
    paid_quantity,
    bonus_quantity,
    total_received,
    supplier_unit_cost,
    invoice_cost,
    effective_unit_cost,
    actor_user_id
  )
  values (
    v_business_id,
    p_location_id,
    p_variant_id,
    v_receive.movement_id,
    v_receive.batch_id,
    p_paid_quantity,
    p_bonus_quantity,
    v_total_received,
    v_supplier_unit_cost,
    v_invoice_cost,
    v_effective_unit_cost,
    v_user_id
  );


  return query
  select
    v_receive.new_on_hand::integer,
    v_receive.movement_id::uuid,
    v_receive.batch_id::uuid,
    p_paid_quantity,
    p_bonus_quantity,
    v_total_received,
    v_supplier_unit_cost::numeric,
    v_invoice_cost::numeric,
    v_effective_unit_cost::numeric,
    v_receive.selling_price::numeric;

end;
$$;


revoke all
on function public.receive_inventory_supplier_bonus(
  uuid,
  uuid,
  integer,
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
on function public.receive_inventory_supplier_bonus(
  uuid,
  uuid,
  integer,
  integer,
  numeric,
  numeric,
  text,
  text
)
to authenticated;


notify pgrst,
'reload schema';
