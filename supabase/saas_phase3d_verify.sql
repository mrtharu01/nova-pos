-- ============================================================
-- NOVA POS
-- SaaS Phase 3D — Private storage + scanner verification
-- ============================================================

do $$

declare
  v_public_buckets text;

begin

  select
    string_agg(
      bucket.id,
      ', '
      order by bucket.id
    )

  into
    v_public_buckets

  from storage.buckets
    as bucket

  where
    bucket.id in (
      'product-images',
      'receipt-assets'
    )

    and
    bucket.public is true;


  if
    v_public_buckets is not null
  then

    raise exception
      'Tenant asset buckets are still public: %',
      v_public_buckets;

  end if;


  if
    has_table_privilege(
      'anon',
      'public.remote_scanner_sessions',
      'SELECT'
    )

    or
    has_table_privilege(
      'anon',
      'public.remote_scanner_sessions',
      'INSERT'
    )

    or
    has_table_privilege(
      'anon',
      'public.remote_scanner_sessions',
      'UPDATE'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.remote_scanner_sessions',
      'SELECT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.remote_scanner_sessions',
      'INSERT'
    )

    or
    has_table_privilege(
      'authenticated',
      'public.remote_scanner_sessions',
      'UPDATE'
    )
  then

    raise exception
      'Direct scanner-session table privileges are still exposed';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.create_remote_scanner_session()',
      'EXECUTE'
    )

    or not

    has_function_privilege(
      'authenticated',
      'public.close_remote_scanner_session(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated scanner lifecycle RPC access is missing';

  end if;


  if not
    has_function_privilege(
      'anon',
      'public.resolve_remote_scanner_session(text)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous scanner pairing resolver is unavailable';

  end if;


  if exists (

    select
      1

    from public.products

    where
      image_path is not null

      and
      btrim(
        image_path
      ) <> ''

      and
      image_url is not null

  )
  then

    raise exception
      'Managed product images still contain public URLs';

  end if;


  if exists (

    select
      1

    from public.receipt_settings

    where
      logo_path is not null

      and
      btrim(
        logo_path
      ) <> ''

      and
      logo_url is not null

  )
  then

    raise exception
      'Managed receipt logos still contain public URLs';

  end if;


  raise notice
    'NOVA SaaS Phase 3D private storage/scanner lockdown verified.';

end;

$$;


select
  id,
  public,
  file_size_limit

from storage.buckets

where
  id in (
    'product-images',
    'receipt-assets'
  )

order by
  id;
