-- ============================================================
-- NOVA POS
-- PHASE 4A — SALES DATABASE FOUNDATION
--
-- Run after:
-- Phase 2
-- Phase 3A
-- Phase 3B
-- Phase 3C / 3D can exist independently.
--
-- This phase creates:
--
-- sales
-- sale_items
-- payments
-- sale_receipt_counters
-- sales_list view
--
-- Phase 4B will add the atomic complete_sale() RPC.
-- ============================================================


-- ============================================================
-- PRIVATE SCHEMA
-- ============================================================

create schema if not exists private;


-- ============================================================
-- ENUMS
-- ============================================================

do $phase4a_enums$

begin

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n
      on n.oid = t.typnamespace
    where
      n.nspname = 'public'
      and t.typname = 'nova_sale_status'
  ) then

    execute
      'create type public.nova_sale_status as enum (
        ''completed'',
        ''partially_refunded'',
        ''refunded'',
        ''voided''
      )';

  end if;


  if not exists (
    select 1
    from pg_type t
    join pg_namespace n
      on n.oid = t.typnamespace
    where
      n.nspname = 'public'
      and t.typname = 'nova_payment_method'
  ) then

    execute
      'create type public.nova_payment_method as enum (
        ''cash'',
        ''card'',
        ''bank_transfer'',
        ''other''
      )';

  end if;


  if not exists (
    select 1
    from pg_type t
    join pg_namespace n
      on n.oid = t.typnamespace
    where
      n.nspname = 'public'
      and t.typname = 'nova_payment_status'
  ) then

    execute
      'create type public.nova_payment_status as enum (
        ''completed'',
        ''partially_refunded'',
        ''refunded'',
        ''voided''
      )';

  end if;

end;

$phase4a_enums$;


-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
--
-- Separate function so Phase 4A does not depend on any
-- earlier trigger helper.
-- ============================================================

create or replace function private.nova_touch_updated_at()

returns trigger

language plpgsql

set search_path = ''

as $$

begin

  new.updated_at = now();

  return new;

end;

$$;


-- ============================================================
-- RECEIPT COUNTERS
--
-- Each business has its own receipt sequence.
--
-- Example:
--
-- RCT-000001
-- RCT-000002
-- RCT-000003
-- ============================================================

create table if not exists public.sale_receipt_counters (

  business_id uuid primary key
    references public.businesses(id)
    on delete cascade,

  prefix text not null
    default 'RCT',

  next_sequence bigint not null
    default 1,

  updated_at timestamptz not null
    default now(),

  constraint
    sale_receipt_counters_prefix_check

    check (
      prefix ~ '^[A-Z0-9-]{1,12}$'
    ),

  constraint
    sale_receipt_counters_sequence_check

    check (
      next_sequence > 0
    )

);


-- Create counters for businesses that already exist.

insert into public.sale_receipt_counters (
  business_id
)

select
  id

from public.businesses

on conflict (
  business_id
)

do nothing;


-- ============================================================
-- SALES
-- ============================================================

create table if not exists public.sales (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  location_id uuid not null
    references public.inventory_locations(id)
    on delete restrict,

  receipt_sequence bigint not null,

  receipt_number text not null,

  currency_code varchar(3) not null
    default 'LKR',

  status public.nova_sale_status not null
    default 'completed',

  cashier_user_id uuid
    references auth.users(id)
    on delete set null,


  -- ==========================================================
  -- CUSTOMER SNAPSHOT
  -- ==========================================================

  customer_name text,

  customer_email text,

  customer_phone text,


  -- ==========================================================
  -- MONEY
  -- ==========================================================

  subtotal numeric(12,2) not null,

  discount_total numeric(12,2) not null
    default 0,

  tax_total numeric(12,2) not null
    default 0,

  total numeric(12,2) not null,

  item_quantity_total integer not null,

  note text not null
    default '',


  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),


  constraint
    sales_receipt_sequence_check

    check (
      receipt_sequence > 0
    ),

  constraint
    sales_receipt_number_check

    check (
      length(
        trim(
          receipt_number
        )
      ) > 0
    ),

  constraint
    sales_currency_code_check

    check (
      currency_code ~ '^[A-Z]{3}$'
    ),

  constraint
    sales_subtotal_check

    check (
      subtotal >= 0
    ),

  constraint
    sales_discount_check

    check (
      discount_total >= 0
    ),

  constraint
    sales_tax_check

    check (
      tax_total >= 0
    ),

  constraint
    sales_total_check

    check (
      total >= 0
    ),

  constraint
    sales_item_quantity_check

    check (
      item_quantity_total > 0
    ),

  constraint
    sales_business_receipt_sequence_unique

    unique (
      business_id,
      receipt_sequence
    ),

  constraint
    sales_business_receipt_number_unique

    unique (
      business_id,
      receipt_number
    ),

  constraint
    sales_id_business_unique

    unique (
      id,
      business_id
    )

);


-- ============================================================
-- SALE ITEMS
--
-- IMPORTANT:
--
-- We store a snapshot of:
--
-- product name
-- variant
-- SKU
-- selling price
-- cost
--
-- because the product may change later.
-- ============================================================

create table if not exists public.sale_items (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  sale_id uuid not null,

  product_id uuid
    references public.products(id)
    on delete set null,

  variant_id uuid
    references public.product_variants(id)
    on delete set null,


  product_name text not null,

  variant_name text not null
    default 'Standard',

  sku text not null,


  quantity integer not null,

  unit_price numeric(12,2) not null,

  unit_cost numeric(12,2) not null
    default 0,

  line_subtotal numeric(12,2) not null,

  discount_total numeric(12,2) not null
    default 0,

  tax_total numeric(12,2) not null
    default 0,

  line_total numeric(12,2) not null,


  created_at timestamptz not null
    default now(),


  constraint
    sale_items_sale_business_fk

    foreign key (
      sale_id,
      business_id
    )

    references public.sales (
      id,
      business_id
    )

    on delete cascade,


  constraint
    sale_items_product_name_check

    check (
      length(
        trim(
          product_name
        )
      ) > 0
    ),


  constraint
    sale_items_sku_check

    check (
      length(
        trim(
          sku
        )
      ) > 0
    ),


  constraint
    sale_items_quantity_check

    check (
      quantity > 0
    ),


  constraint
    sale_items_unit_price_check

    check (
      unit_price >= 0
    ),


  constraint
    sale_items_unit_cost_check

    check (
      unit_cost >= 0
    ),


  constraint
    sale_items_line_subtotal_check

    check (
      line_subtotal >= 0
    ),


  constraint
    sale_items_discount_check

    check (
      discount_total >= 0
    ),


  constraint
    sale_items_tax_check

    check (
      tax_total >= 0
    ),


  constraint
    sale_items_line_total_check

    check (
      line_total >= 0
    )

);


-- ============================================================
-- PAYMENTS
--
-- Separate payment table allows future split payments.
--
-- Example:
--
-- Cash        LKR 2000
-- Card        LKR 3000
--
-- Sale Total  LKR 5000
-- ============================================================

create table if not exists public.payments (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  sale_id uuid not null,

  method public.nova_payment_method not null,

  status public.nova_payment_status not null
    default 'completed',

  amount numeric(12,2) not null,

  reference_number text,

  cash_received numeric(12,2),

  change_due numeric(12,2),

  received_by_user_id uuid
    references auth.users(id)
    on delete set null,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),


  constraint
    payments_sale_business_fk

    foreign key (
      sale_id,
      business_id
    )

    references public.sales (
      id,
      business_id
    )

    on delete cascade,


  constraint
    payments_amount_check

    check (
      amount > 0
    ),


  constraint
    payments_cash_received_check

    check (
      cash_received is null
      or cash_received >= 0
    ),


  constraint
    payments_change_due_check

    check (
      change_due is null
      or change_due >= 0
    )

);


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
sales_business_created_at_idx

on public.sales (
  business_id,
  created_at desc
);


create index if not exists
sales_location_idx

on public.sales (
  location_id
);


create index if not exists
sales_cashier_idx

on public.sales (
  cashier_user_id
);


create index if not exists
sales_receipt_number_idx

on public.sales (
  receipt_number
);


create index if not exists
sale_items_sale_idx

on public.sale_items (
  sale_id
);


create index if not exists
sale_items_variant_idx

on public.sale_items (
  variant_id
);


create index if not exists
sale_items_product_idx

on public.sale_items (
  product_id
);


create index if not exists
payments_sale_idx

on public.payments (
  sale_id
);


create index if not exists
payments_business_created_at_idx

on public.payments (
  business_id,
  created_at desc
);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

drop trigger if exists
nova_sales_touch_updated_at
on public.sales;


create trigger
nova_sales_touch_updated_at

before update
on public.sales

for each row

execute function
private.nova_touch_updated_at();


drop trigger if exists
nova_receipt_counter_touch_updated_at
on public.sale_receipt_counters;


create trigger
nova_receipt_counter_touch_updated_at

before update
on public.sale_receipt_counters

for each row

execute function
private.nova_touch_updated_at();


-- ============================================================
-- RECEIPT NUMBER GENERATOR
--
-- Internal only.
--
-- DO NOT call manually because every successful call reserves
-- the next receipt number.
--
-- Phase 4B complete_sale() will call this.
-- ============================================================

create or replace function
private.next_receipt_identity(
  p_business_id uuid
)

returns table (
  receipt_sequence bigint,
  receipt_number text
)

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_sequence bigint;

  v_prefix text;

begin

  if not exists (

    select 1

    from public.businesses b

    where
      b.id =
      p_business_id

  ) then

    raise exception
      'Business not found';

  end if;


  insert into public.sale_receipt_counters (
    business_id
  )

  values (
    p_business_id
  )

  on conflict (
    business_id
  )

  do nothing;


  update public.sale_receipt_counters

  set
    next_sequence =
      next_sequence + 1,

    updated_at =
      now()

  where
    business_id =
      p_business_id

  returning

    prefix,

    next_sequence - 1

  into

    v_prefix,

    v_sequence;


  if v_sequence is null then

    raise exception
      'Unable to reserve receipt number';

  end if;


  receipt_sequence :=
    v_sequence;


  receipt_number :=
    v_prefix
    ||
    '-'
    ||
    lpad(
      v_sequence::text,
      6,
      '0'
    );


  return next;

end;

$$;


revoke all
on function
private.next_receipt_identity(uuid)
from public;


revoke all
on function
private.next_receipt_identity(uuid)
from anon;


revoke all
on function
private.next_receipt_identity(uuid)
from authenticated;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.sales
enable row level security;


alter table public.sale_items
enable row level security;


alter table public.payments
enable row level security;


alter table public.sale_receipt_counters
enable row level security;


-- ============================================================
-- REMOVE DEFAULT ACCESS
-- ============================================================

revoke all
on public.sales
from anon,
authenticated;


revoke all
on public.sale_items
from anon,
authenticated;


revoke all
on public.payments
from anon,
authenticated;


revoke all
on public.sale_receipt_counters
from anon,
authenticated;


-- ============================================================
-- READ ACCESS ONLY
--
-- Checkout writes will happen through complete_sale()
-- during Phase 4B.
-- ============================================================

grant select
on public.sales
to authenticated;


grant select
on public.sale_items
to authenticated;


grant select
on public.payments
to authenticated;


-- ============================================================
-- SALES SELECT POLICY
-- ============================================================

drop policy if exists
nova_sales_select
on public.sales;


create policy
nova_sales_select

on public.sales

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
-- SALE ITEMS SELECT POLICY
-- ============================================================

drop policy if exists
nova_sale_items_select
on public.sale_items;


create policy
nova_sale_items_select

on public.sale_items

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
-- PAYMENTS SELECT POLICY
-- ============================================================

drop policy if exists
nova_payments_select
on public.payments;


create policy
nova_payments_select

on public.payments

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
-- SALES LIST VIEW
--
-- Used by /sales.
--
-- security_invoker means the view still respects underlying
-- RLS policies.
-- ============================================================

drop view if exists
public.sales_list;


create view
public.sales_list

with (
  security_invoker = true
)

as

select

  s.id,

  s.business_id,

  s.receipt_number,

  s.receipt_sequence,

  s.created_at,

  s.customer_name,

  s.customer_email,

  s.customer_phone,

  s.currency_code,

  s.subtotal,

  s.discount_total,

  s.tax_total,

  s.total,

  s.item_quantity_total,

  s.status,

  s.cashier_user_id,


  coalesce(
    items.line_count,
    0
  )::integer
    as line_count,


  coalesce(
    payments_summary.payment_methods,
    ''
  )
    as payment_methods


from public.sales s


left join (

  select

    si.sale_id,

    count(*)::integer
      as line_count

  from public.sale_items si

  group by
    si.sale_id

) items

on
  items.sale_id =
    s.id


left join (

  select

    p.sale_id,

    string_agg(
      distinct p.method::text,
      ', '
    )
      as payment_methods

  from public.payments p

  group by
    p.sale_id

) payments_summary

on
  payments_summary.sale_id =
    s.id;


revoke all
on public.sales_list
from anon,
authenticated;


grant select
on public.sales_list
to authenticated;


-- ============================================================
-- COMMENTS
-- ============================================================

comment on table public.sales
is
'NOVA POS permanent sale transaction headers.';


comment on table public.sale_items
is
'NOVA POS historical line item snapshots.';


comment on table public.payments
is
'NOVA POS payment records attached to sales.';


comment on table public.sale_receipt_counters
is
'Internal per-business receipt number counter.';


comment on view public.sales_list
is
'RLS-respecting transaction list used by the NOVA Sales screen.';