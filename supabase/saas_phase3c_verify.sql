-- ============================================================
-- NOVA POS
-- SaaS Phase 3C — Scanner + storage foundation verification
-- ============================================================

do $$

declare

  v_invalid_product_paths bigint;

  v_invalid_receipt_paths bigint;

begin

  -- Product paths already managed by NOVA must be tenant scoped.

  select
    count(*)

  into
    v_invalid_product_paths

  from public.products

  where
    image_path is not null

    and
    btrim(
      image_path
    ) <> ''

    and
    split_part(
      image_path,
      '/',
      1
    ) <>
      business_id::text;


  if
    v_invalid_product_paths > 0
  then

    raise exception
      'Found % product image paths outside their tenant folder',
      v_invalid_product_paths;

  end if;


  -- Receipt logo paths must follow the same rule.

  select
    count(*)

  into
    v_invalid_receipt_paths

  from public.receipt_settings

  where
    logo_path is not null

    and
    btrim(
      logo_path
    ) <> ''

    and
    split_part(
      logo_path,
      '/',
      1
    ) <>
      business_id::text;


  if
    v_invalid_receipt_paths > 0
  then

    raise exception
      'Found % receipt logo paths outside their tenant folder',
      v_invalid_receipt_paths;

  end if;


  -- New scanner RPCs must not be callable anonymously.

  if
    has_function_privilege(
      'anon',
      'public.create_remote_scanner_session()',
      'EXECUTE'
    )

    or

    has_function_privilege(
      'anon',
      'public.close_remote_scanner_session(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous users must not create or close scanner sessions';

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
      'Authenticated users must be able to use scanner session RPCs';

  end if;


  -- Anonymous scanner pairing remains intentionally available
  -- only through the high-entropy pair-token resolver.

  if not
    has_function_privilege(
      'anon',
      'public.resolve_remote_scanner_session(text)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous scanner pairing resolver is unexpectedly unavailable';

  end if;


  raise notice
    'NOVA SaaS Phase 3C scanner/storage foundation verified.';

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
