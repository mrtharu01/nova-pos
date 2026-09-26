-- ============================================================
-- NOVA POS
-- Bulk catalog import verification
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
        'product_variants'

      and
      column_name =
        'barcode'

  )
  then

    raise exception
      'product_variants.barcode is missing';

  end if;


  if not exists (

    select
      1

    from pg_indexes

    where
      schemaname =
        'public'

      and
      indexname =
        'product_variants_business_barcode_unique_idx'

  )
  then

    raise exception
      'Barcode uniqueness index is missing';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.bulk_import_products(jsonb)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute bulk_import_products';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.bulk_import_products(jsonb)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role cannot execute bulk_import_products';

  end if;


  if not exists (

    select
      1

    from pg_proc
      as procedure_record

    join pg_namespace
      as namespace

      on
        namespace.oid =
          procedure_record.pronamespace

    where
      namespace.nspname =
        'public'

      and
      procedure_record.proname =
        'bulk_import_products'

      and
      procedure_record.prosecdef is true

      and exists (

        select
          1

        from unnest(
          coalesce(
            procedure_record.proconfig,
            array[]::text[]
          )
        )
          as config_entry

        where
          config_entry like
            'search_path=%'

      )

  )
  then

    raise exception
      'bulk_import_products must be SECURITY DEFINER with a fixed search_path';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA bulk CSV / Excel catalog import verified.'
    as result;
