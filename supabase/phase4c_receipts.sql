-- ============================================================
-- NOVA POS
-- PHASE 4C — THERMAL RECEIPTS
-- ============================================================


-- ============================================================
-- RECEIPT SETTINGS
-- ============================================================

create table if not exists public.receipt_settings (

  business_id uuid primary key
    references public.businesses(id)
    on delete cascade,

  paper_width text not null
    default '80mm',

  auto_print boolean not null
    default false,

  display_name text,

  address_line_1 text,

  address_line_2 text,

  phone text,

  email text,

  tax_registration_number text,

  footer_message text not null
    default 'Thank you for shopping with us!',

  show_sku boolean not null
    default true,

  show_cashier boolean not null
    default true,

  show_customer boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint
    receipt_settings_paper_width_check

    check (
      paper_width in (
        '58mm',
        '80mm'
      )
    )

);


-- ============================================================
-- CREATE SETTINGS FOR EXISTING BUSINESSES
-- ============================================================

insert into public.receipt_settings (
  business_id
)

select
  business.id

from public.businesses
  as business

on conflict (
  business_id
)

do nothing;


-- ============================================================
-- UPDATED_AT
-- ============================================================

drop trigger if exists
nova_receipt_settings_updated_at
on public.receipt_settings;


create trigger
nova_receipt_settings_updated_at

before update
on public.receipt_settings

for each row

execute function
private.nova_touch_updated_at();


-- ============================================================
-- AUTOMATIC SETTINGS FOR FUTURE BUSINESSES
-- ============================================================

create or replace function
private.nova_create_receipt_settings()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  insert into public.receipt_settings (
    business_id
  )

  values (
    new.id
  )

  on conflict (
    business_id
  )

  do nothing;


  return new;

end;

$$;


drop trigger if exists
nova_business_create_receipt_settings
on public.businesses;


create trigger
nova_business_create_receipt_settings

after insert
on public.businesses

for each row

execute function
private.nova_create_receipt_settings();


-- ============================================================
-- RLS
-- ============================================================

alter table
public.receipt_settings

enable row level security;


revoke all
on public.receipt_settings

from
  anon,
  authenticated;


grant
  select,
  update

on public.receipt_settings

to authenticated;


-- ============================================================
-- SELECT POLICY
-- ============================================================

drop policy if exists
nova_receipt_settings_select
on public.receipt_settings;


create policy
nova_receipt_settings_select

on public.receipt_settings

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
-- UPDATE POLICY
-- ============================================================

drop policy if exists
nova_receipt_settings_update
on public.receipt_settings;


create policy
nova_receipt_settings_update

on public.receipt_settings

for update

to authenticated

using (

  (
    select private.is_business_member(
      business_id
    )
  )

)

with check (

  (
    select private.is_business_member(
      business_id
    )
  )

);


comment on table
public.receipt_settings

is
'NOVA thermal receipt configuration for each business.';    