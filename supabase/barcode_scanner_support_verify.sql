-- ============================================================
-- NOVA POS
-- Dual QR / barcode scanner support verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if not exists (

    select
      1

    from information_schema.columns

    where
      table_schema =
        'public'

      and
      table_name =
        'catalog_variant_inventory'

      and
      column_name =
        'barcode'

  )
  then

    raise exception
      'catalog_variant_inventory.barcode is missing';

  end if;


  if not exists (

    select
      1

    from pg_catalog.pg_class
      as relation

    join pg_catalog.pg_namespace
      as namespace

      on
        namespace.oid =
          relation.relnamespace

    where
      namespace.nspname =
        'public'

      and
      relation.relname =
        'catalog_variant_inventory'

      and
      relation.reloptions @>
        array[
          'security_invoker=true'
        ]

  )
  then

    raise exception
      'catalog_variant_inventory must remain security_invoker';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA QR + manufacturer barcode scanner catalog verified.'
    as result;
