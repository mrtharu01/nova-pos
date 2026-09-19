-- ============================================================
-- NOVA POS — PHASE 1E DASHBOARD LIVE UPDATES
-- ============================================================
-- Enables Supabase Realtime Postgres Changes for the tables
-- that drive dashboard metrics, recent sales and low stock.
-- ============================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'sales',
    'sale_items',
    'payments',
    'sale_refunds',
    'sale_refund_items',
    'sale_voids',
    'inventory_levels',
    'products',
    'product_variants'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    end if;
  end loop;
end;
$$;


-- ============================================================
-- VERIFICATION
-- ============================================================

select
  schemaname,
  tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in (
    'sales',
    'sale_items',
    'payments',
    'sale_refunds',
    'sale_refund_items',
    'sale_voids',
    'inventory_levels',
    'products',
    'product_variants'
  )
order by tablename;
