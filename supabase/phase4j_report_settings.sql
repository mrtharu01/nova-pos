-- ============================================================
-- NOVA POS
-- PHASE 4J — REPORT PRINT SETTINGS
-- ============================================================

create table if not exists
public.report_settings (

  business_id uuid primary key
    references public.businesses(id)
    on delete cascade,

  display_name text,

  address_line_1 text,

  address_line_2 text,

  phone text,

  email text,

  registration_number text,

  report_title text not null
    default 'Sales Report',

  footer_message text not null
    default 'Thank you for using NOVA POS.',

  paper_size text not null
    default 'a4'
    check (
      paper_size in (
        'a4',
        'letter'
      )
    ),

  orientation text not null
    default 'portrait'
    check (
      orientation in (
        'portrait',
        'landscape'
      )
    ),

  show_gross_revenue boolean not null
    default true,

  show_refunds boolean not null
    default true,

  show_cogs boolean not null
    default true,

  show_profit boolean not null
    default true,

  show_sales_trend boolean not null
    default true,

  show_payment_breakdown boolean not null
    default true,

  show_top_products boolean not null
    default true,

  show_transactions boolean not null
    default true,

  show_generated_by_nova boolean not null
    default true,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);


-- ============================================================
-- BACKFILL EXISTING BUSINESSES
-- ============================================================

insert into public.report_settings (
  business_id
)

select
  business_record.id

from public.businesses
  as business_record

on conflict (
  business_id
)

do nothing;


-- ============================================================
-- AUTOMATIC DEFAULT SETTINGS FOR FUTURE BUSINESSES
-- ============================================================

create or replace function
private.create_default_report_settings()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  insert into public.report_settings (
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
nova_create_default_report_settings
on public.businesses;


create trigger
nova_create_default_report_settings

after insert

on public.businesses

for each row

execute function
private.create_default_report_settings();


-- ============================================================
-- RLS
-- ============================================================

alter table
public.report_settings
enable row level security;


revoke all
on public.report_settings
from anon;


grant
  select,
  insert,
  update

on public.report_settings

to authenticated;


drop policy if exists
nova_report_settings_select
on public.report_settings;


create policy
nova_report_settings_select

on public.report_settings

for select

to authenticated

using (
  (
    select private.is_business_member(
      business_id
    )
  )
);


drop policy if exists
nova_report_settings_insert
on public.report_settings;


create policy
nova_report_settings_insert

on public.report_settings

for insert

to authenticated

with check (
  (
    select private.is_business_manager(
      business_id
    )
  )
);


drop policy if exists
nova_report_settings_update
on public.report_settings;


create policy
nova_report_settings_update

on public.report_settings

for update

to authenticated

using (
  (
    select private.is_business_manager(
      business_id
    )
  )
)

with check (
  (
    select private.is_business_manager(
      business_id
    )
  )
);


notify pgrst,
'reload schema';