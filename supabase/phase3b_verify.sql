-- NOVA POS — Phase 3B verification helpers
select
  to_regprocedure('public.create_category(text)') is not null as create_category_exists,
  to_regprocedure('public.save_product(uuid,text,text,uuid,text,public.nova_product_status,jsonb)') is not null as save_product_exists,
  to_regclass('public.inventory_movement_details') is not null as inventory_history_view_exists;

select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in ('products','product_variants','inventory_levels','inventory_movements')
order by table_name, privilege_type;
