-- ============================================================
-- NOVA POS
-- SaaS Phase 3G — Final tenant / security audit
-- ============================================================
--
-- READ-ONLY.
--
-- Run after all Phase 3 migrations, including:
--   saas_phase3f_private_profile_avatars.sql
--
-- Any exception means Phase 3 is NOT complete yet.
-- ============================================================


do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 1. Every tenant-owned table must have NOT NULL business_id.
  -- ----------------------------------------------------------

  with required(table_name) as (

    values
      ('staff_members'),
      ('categories'),
      ('products'),
      ('product_variants'),
      ('inventory_locations'),
      ('inventory_levels'),
      ('inventory_movements'),
      ('remote_scanner_sessions'),
      ('sale_receipt_counters'),
      ('sales'),
      ('sale_items'),
      ('payments'),
      ('receipt_settings'),
      ('sale_refund_counters'),
      ('sale_refunds'),
      ('sale_refund_items'),
      ('sale_voids'),
      ('customers'),
      ('loyalty_settings'),
      ('loyalty_transactions'),
      ('report_settings'),
      ('expenses'),
      ('staff_invitations')

  ),

  invalid as (

    select
      required.table_name

    from required

    left join information_schema.columns
      as column_record

      on
        column_record.table_schema =
          'public'

        and
        column_record.table_name =
          required.table_name

        and
        column_record.column_name =
          'business_id'

    where
      column_record.column_name
        is null

      or
      column_record.is_nullable <>
        'NO'

  )

  select
    string_agg(
      invalid.table_name,
      ', '
      order by invalid.table_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Tenant ownership audit failed: %',
      v_invalid;

  end if;

end;

$$;



do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 2. Tenant tables must have RLS enabled.
  -- ----------------------------------------------------------

  with required(table_name) as (

    values
      ('businesses'),
      ('staff_members'),
      ('categories'),
      ('products'),
      ('product_variants'),
      ('inventory_locations'),
      ('inventory_levels'),
      ('inventory_movements'),
      ('remote_scanner_sessions'),
      ('sale_receipt_counters'),
      ('sales'),
      ('sale_items'),
      ('payments'),
      ('receipt_settings'),
      ('sale_refund_counters'),
      ('sale_refunds'),
      ('sale_refund_items'),
      ('sale_voids'),
      ('customers'),
      ('loyalty_settings'),
      ('loyalty_transactions'),
      ('report_settings'),
      ('expenses'),
      ('staff_invitations')

  ),

  invalid as (

    select
      required.table_name

    from required

    left join pg_catalog.pg_class
      as relation

      on
        relation.relname =
          required.table_name

    left join pg_catalog.pg_namespace
      as namespace

      on
        namespace.oid =
          relation.relnamespace

        and
        namespace.nspname =
          'public'

    where
      relation.oid
        is null

      or
      namespace.oid
        is null

      or
      relation.relrowsecurity
        is not true

  )

  select
    string_agg(
      invalid.table_name,
      ', '
      order by invalid.table_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Tenant RLS audit failed: %',
      v_invalid;

  end if;

end;

$$;



do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 3. Anonymous users must have no direct public-table access.
  -- ----------------------------------------------------------

  select
    string_agg(
      table_record.tablename,
      ', '
      order by table_record.tablename
    )

  into
    v_invalid

  from pg_catalog.pg_tables
    as table_record

  where
    table_record.schemaname =
      'public'

    and
    (
      has_table_privilege(
        'anon',
        format(
          'public.%I',
          table_record.tablename
        ),
        'SELECT'
      )

      or

      has_table_privilege(
        'anon',
        format(
          'public.%I',
          table_record.tablename
        ),
        'INSERT'
      )

      or

      has_table_privilege(
        'anon',
        format(
          'public.%I',
          table_record.tablename
        ),
        'UPDATE'
      )

      or

      has_table_privilege(
        'anon',
        format(
          'public.%I',
          table_record.tablename
        ),
        'DELETE'
      )
    );


  if
    v_invalid is not null
  then

    raise exception
      'Anonymous direct table access still exists on: %',
      v_invalid;

  end if;

end;

$$;



do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 4. Transaction / security ledgers must be RPC-only writes.
  -- ----------------------------------------------------------

  with protected(table_name) as (

    values
      ('sales'),
      ('sale_items'),
      ('payments'),
      ('sale_receipt_counters'),
      ('sale_refund_counters'),
      ('sale_refunds'),
      ('sale_refund_items'),
      ('sale_voids'),
      ('loyalty_transactions'),
      ('remote_scanner_sessions')

  ),

  invalid as (

    select
      protected.table_name

    from protected

    where
      has_table_privilege(
        'authenticated',
        format(
          'public.%I',
          protected.table_name
        ),
        'INSERT'
      )

      or

      has_table_privilege(
        'authenticated',
        format(
          'public.%I',
          protected.table_name
        ),
        'UPDATE'
      )

      or

      has_table_privilege(
        'authenticated',
        format(
          'public.%I',
          protected.table_name
        ),
        'DELETE'
      )

  )

  select
    string_agg(
      invalid.table_name,
      ', '
      order by invalid.table_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Sensitive direct write privileges remain on: %',
      v_invalid;

  end if;


  if
    has_table_privilege(
      'authenticated',
      'public.remote_scanner_sessions',
      'SELECT'
    )
  then

    raise exception
      'remote_scanner_sessions is still directly readable by authenticated clients';

  end if;

end;

$$;



do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 5. SECURITY DEFINER functions must pin search_path.
  -- ----------------------------------------------------------

  select
    string_agg(
      namespace.nspname
      ||
      '.'
      ||
      procedure_record.proname,
      ', '
      order by
        namespace.nspname,
        procedure_record.proname
    )

  into
    v_invalid

  from pg_catalog.pg_proc
    as procedure_record

  join pg_catalog.pg_namespace
    as namespace

    on
      namespace.oid =
        procedure_record.pronamespace

  where
    namespace.nspname in (
      'public',
      'private'
    )

    and
    procedure_record.prosecdef is true

    and not exists (

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

    );


  if
    v_invalid is not null
  then

    raise exception
      'SECURITY DEFINER functions missing fixed search_path: %',
      v_invalid;

  end if;

end;

$$;



do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 6. Any SECURITY DEFINER RPC accepting p_business_id must
  --    validate tenant access inside the database.
  -- ----------------------------------------------------------

  select
    string_agg(
      procedure_record.proname,
      ', '
      order by procedure_record.proname
    )

  into
    v_invalid

  from pg_catalog.pg_proc
    as procedure_record

  join pg_catalog.pg_namespace
    as namespace

    on
      namespace.oid =
        procedure_record.pronamespace

  where
    namespace.nspname =
      'public'

    and
    procedure_record.prosecdef is true

    and
    pg_catalog.pg_get_function_arguments(
      procedure_record.oid
    ) ilike
      '%p_business_id%'

    and
    procedure_record.prosrc not ilike
      '%private.is_business_member%'

    and
    procedure_record.prosrc not ilike
      '%private.is_business_manager%'

    and
    procedure_record.prosrc not ilike
      '%private.current_business_id%';


  if
    v_invalid is not null
  then

    raise exception
      'SECURITY DEFINER business RPCs without tenant validation: %',
      v_invalid;

  end if;

end;

$$;



do $$

declare

  v_invalid text;

begin

  -- ----------------------------------------------------------
  -- 7. Client-facing tenant views must execute as invoker.
  -- ----------------------------------------------------------

  with required(view_name) as (

    values
      ('catalog_variant_inventory'),
      ('inventory_movement_details'),
      ('sales_list')

  ),

  invalid as (

    select
      required.view_name

    from required

    left join pg_catalog.pg_class
      as relation

      on
        relation.relname =
          required.view_name

    left join pg_catalog.pg_namespace
      as namespace

      on
        namespace.oid =
          relation.relnamespace

        and
        namespace.nspname =
          'public'

    where
      relation.oid is null

      or
      namespace.oid is null

      or not (
        coalesce(
          relation.reloptions,
          array[]::text[]
        )
        @>
        array[
          'security_invoker=true'
        ]::text[]
      )

  )

  select
    string_agg(
      invalid.view_name,
      ', '
      order by invalid.view_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Tenant views missing security_invoker=true: %',
      v_invalid;

  end if;

end;

$$;



do $$

declare

  v_public_buckets text;

  v_policy_count integer;

  v_profile_policy_count integer;

begin

  -- ----------------------------------------------------------
  -- 8. All NOVA-owned asset buckets must be private.
  -- ----------------------------------------------------------

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
      'receipt-assets',
      'profile-avatars'
    )

    and
    bucket.public is true;


  if
    v_public_buckets is not null
  then

    raise exception
      'Public NOVA asset buckets remain: %',
      v_public_buckets;

  end if;


  -- Product + receipt policies.

  select
    count(*)::integer

  into
    v_policy_count

  from pg_catalog.pg_policies
    as policy_record

  where
    policy_record.schemaname =
      'storage'

    and
    policy_record.tablename =
      'objects'

    and
    policy_record.policyname in (
      'nova_product_images_insert',
      'nova_product_images_select',
      'nova_product_images_delete',
      'nova_receipt_assets_insert',
      'nova_receipt_assets_select',
      'nova_receipt_assets_delete'
    )

    and
    (
      coalesce(
        policy_record.qual,
        ''
      )
      ||
      ' '
      ||
      coalesce(
        policy_record.with_check,
        ''
      )
    ) like
      '%is_business_%';


  if
    v_policy_count <> 6
  then

    raise exception
      'Expected six tenant-scoped product/receipt Storage policies; found %',
      v_policy_count;

  end if;


  -- Profile avatar policies.

  select
    count(*)::integer

  into
    v_profile_policy_count

  from pg_catalog.pg_policies
    as policy_record

  where
    policy_record.schemaname =
      'storage'

    and
    policy_record.tablename =
      'objects'

    and
    policy_record.policyname in (
      'nova_profile_avatar_insert',
      'nova_profile_avatar_select',
      'nova_profile_avatar_update',
      'nova_profile_avatar_delete'
    )

    and
    (
      coalesce(
        policy_record.qual,
        ''
      )
      ||
      ' '
      ||
      coalesce(
        policy_record.with_check,
        ''
      )
    ) like
      '%auth.uid()%';


  if
    v_profile_policy_count <> 4
  then

    raise exception
      'Expected four user-scoped profile avatar policies; found %',
      v_profile_policy_count;

  end if;

end;

$$;



do $$

begin

  -- ----------------------------------------------------------
  -- 9. Managed business assets must not retain public URLs.
  -- ----------------------------------------------------------

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
      'Managed product images still retain public URLs';

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
      'Managed receipt logos still retain public URLs';

  end if;

end;

$$;



do $$

begin

  -- ----------------------------------------------------------
  -- 10. Tenant resolver / guardrails must remain active.
  -- ----------------------------------------------------------

  if
    has_function_privilege(
      'anon',
      'public.get_my_current_business()',
      'EXECUTE'
    )
  then

    raise exception
      'anon can execute get_my_current_business()';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.get_my_current_business()',
      'EXECUTE'
    )
  then

    raise exception
      'authenticated cannot execute get_my_current_business()';

  end if;


  if
    has_function_privilege(
      'anon',
      'private.is_business_member(uuid)',
      'EXECUTE'
    )

    or

    has_function_privilege(
      'anon',
      'private.is_business_manager(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute private tenant helpers';

  end if;


  if not exists (

    select
      1

    from pg_catalog.pg_trigger
      as trigger_record

    where
      trigger_record.tgname =
        'nova_single_active_business_membership'

      and
      trigger_record.tgenabled <>
        'D'

  )
  then

    raise exception
      'Single-active-business staff guardrail is missing or disabled';

  end if;


  if not exists (

    select
      1

    from pg_catalog.pg_trigger
      as trigger_record

    where
      trigger_record.tgname =
        'nova_single_owner_workspace'

      and
      trigger_record.tgenabled <>
        'D'

  )
  then

    raise exception
      'Single-owner-workspace guardrail is missing or disabled';

  end if;

end;

$$;



do $$
begin

  raise notice
    'NOVA SaaS Phase 3 final tenant/security audit PASSED.';

end;
$$;


select
  'PASS'
    as status,

  'NOVA SaaS Phase 3 final tenant/security audit passed.'
    as result;
