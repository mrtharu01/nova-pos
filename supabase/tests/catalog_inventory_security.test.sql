begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.businesses'::regclass),
  'RLS is enabled on businesses'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.products'::regclass),
  'RLS is enabled on products'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.product_variants'::regclass),
  'RLS is enabled on product_variants'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_levels'::regclass),
  'RLS is enabled on inventory_levels'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.inventory_movements'::regclass),
  'RLS is enabled on inventory_movements'
);

select policies_are(
  'public',
  'products',
  array[
    'products_select_member',
    'products_insert_manager',
    'products_update_manager',
    'products_delete_manager'
  ],
  'products has only the intended RLS policies'
);

select policies_are(
  'public',
  'product_variants',
  array[
    'variants_select_member',
    'variants_insert_manager',
    'variants_update_manager',
    'variants_delete_manager'
  ],
  'product_variants has only the intended RLS policies'
);

select policies_are(
  'public',
  'inventory_levels',
  array[
    'levels_select_member',
    'levels_insert_manager',
    'levels_update_manager',
    'levels_delete_manager'
  ],
  'inventory_levels has only the intended RLS policies'
);

select policies_are(
  'public',
  'inventory_movements',
  array[
    'movements_select_member',
    'movements_insert_manager'
  ],
  'inventory_movements is append-only through app grants/policies'
);

select ok(
  not has_table_privilege('anon', 'public.products', 'SELECT'),
  'anon cannot read products'
);
select ok(
  not has_table_privilege('anon', 'public.inventory_levels', 'SELECT'),
  'anon cannot read inventory'
);
select ok(
  has_table_privilege('authenticated', 'public.products', 'SELECT'),
  'authenticated role has SELECT grant before RLS filtering'
);
select ok(
  not has_column_privilege('authenticated', 'public.product_variants', 'qr_token', 'UPDATE'),
  'authenticated users cannot mutate permanent QR tokens'
);
select ok(
  not has_table_privilege('authenticated', 'public.inventory_movements', 'UPDATE'),
  'inventory movement history cannot be updated by the app role'
);

select * from finish();
rollback;
