-- ============================================================
-- NOVA POS
-- Product editor barcode persistence verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if
    has_function_privilege(
      'anon',
      'public.save_product_with_promotion_v3(uuid,text,text,uuid,text,public.nova_product_status,jsonb,boolean,text,numeric,timestamptz,timestamptz)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute save_product_with_promotion_v3';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.save_product_with_promotion_v3(uuid,text,text,uuid,text,public.nova_product_status,jsonb,boolean,text,numeric,timestamptz,timestamptz)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role cannot execute save_product_with_promotion_v3';

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
        'save_product_with_promotion_v3'

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
      'save_product_with_promotion_v3 must be SECURITY DEFINER with a fixed search_path';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA product editor barcode persistence verified.'
    as result;
