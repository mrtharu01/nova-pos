-- ============================================================
-- NOVA POS
-- PHASE 4K — EXPENSE-AWARE PRINTED REPORT SETTINGS
-- ============================================================

alter table public.report_settings
add column if not exists
show_operating_expenses boolean not null
default true;


alter table public.report_settings
add column if not exists
show_net_operating_profit boolean not null
default true;


notify pgrst,
'reload schema';