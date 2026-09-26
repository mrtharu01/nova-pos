-- ============================================================
-- ARC
-- PRE-HANDOFF — CURRENT-MODEL TENANT EXPORT
--
-- Brings the tenant JSON export forward to the current ARC
-- schema without changing the download endpoint contract.
--
-- Adds current inventory history:
--   • FIFO price batches
--   • pack / loose unit-break audit
--   • supplier bonus receipt audit
--   • tenant handoff checklist
--
-- Optional tables are emitted as [] when the feature migration
-- is not installed.
-- ============================================================


create or replace function
public.export_platform_business_snapshot(
  p_target_business_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business jsonb;

  v_auth_users jsonb :=
    '[]'::jsonb;

  v_tables jsonb :=
    '{}'::jsonb;

  v_storage_manifest jsonb :=
    '[]'::jsonb;

  v_subscription jsonb;

  v_table_name text;

  v_table_rows jsonb;

  v_export_tables text[] :=
    array[
      'staff_members',
      'categories',
      'products',
      'product_variants',
      'inventory_locations',
      'inventory_levels',
      'inventory_movements',
      'inventory_price_batches',
      'inventory_unit_breaks',
      'inventory_supplier_bonus_receipts',
      'remote_scanner_sessions',
      'sale_receipt_counters',
      'sales',
      'sale_items',
      'payments',
      'receipt_settings',
      'sale_refund_counters',
      'sale_refunds',
      'sale_refund_items',
      'sale_voids',
      'customers',
      'loyalty_settings',
      'loyalty_transactions',
      'report_settings',
      'expenses',
      'staff_invitations',
      'platform_business_handoff'
    ];
begin

  if not (
    select private.is_platform_admin()
  )
  then
    raise exception
      'Platform administrator access required'
      using errcode =
        '42501';
  end if;


  select
    to_jsonb(
      business
    )
  into
    v_business
  from public.businesses
    as business
  where
    business.id =
      p_target_business_id;


  if
    v_business is null
  then
    raise exception
      'ARC business was not found';
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
          auth_user.id,

          'email',
          auth_user.email,

          'createdAt',
          auth_user.created_at,

          'lastSignInAt',
          auth_user.last_sign_in_at
        )
        order by
          auth_user.email
      ),
      '[]'::jsonb
    )
  into
    v_auth_users
  from auth.users
    as auth_user
  where
    auth_user.id in (

      select
        business.owner_user_id
      from public.businesses
        as business
      where
        business.id =
          p_target_business_id


      union


      select
        staff.user_id
      from public.staff_members
        as staff
      where
        staff.business_id =
          p_target_business_id
    );


  foreach
    v_table_name
  in array
    v_export_tables
  loop

    if to_regclass(
      format(
        'public.%I',
        v_table_name
      )
    ) is null
    then
      v_tables :=
        v_tables ||
        jsonb_build_object(
          v_table_name,
          '[]'::jsonb
        );

      continue;
    end if;


    execute format(
      'select coalesce(jsonb_agg(to_jsonb(t)), ''[]''::jsonb) from public.%I as t where t.business_id = $1',
      v_table_name
    )
    into
      v_table_rows
    using
      p_target_business_id;


    v_tables :=
      v_tables ||
      jsonb_build_object(
        v_table_name,
        coalesce(
          v_table_rows,
          '[]'::jsonb
        )
      );

  end loop;


  if to_regclass(
    'public.business_subscriptions'
  ) is not null
  then
    select
      jsonb_build_object(
        'subscription',
        to_jsonb(
          subscription
        ),

        'plan',
        to_jsonb(
          plan
        )
      )
    into
      v_subscription
    from public.business_subscriptions
      as subscription
    join public.subscription_plans
      as plan
      on
        plan.id =
          subscription.plan_id
    where
      subscription.business_id =
        p_target_business_id;
  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucketId',
          storage_object.bucket_id,

          'name',
          storage_object.name,

          'createdAt',
          storage_object.created_at,

          'updatedAt',
          storage_object.updated_at,

          'metadata',
          storage_object.metadata
        )
        order by
          storage_object.bucket_id,
          storage_object.name
      ),
      '[]'::jsonb
    )
  into
    v_storage_manifest
  from storage.objects
    as storage_object
  where
    storage_object.bucket_id in (
      'product-images',
      'receipt-assets'
    )
    and
    split_part(
      storage_object.name,
      '/',
      1
    ) =
      p_target_business_id::text;


  return
    jsonb_build_object(
      'format',
      'ARC_TENANT_EXPORT_V1',

      'exportedAt',
      now(),

      'businessId',
      p_target_business_id,

      'business',
      v_business,

      'authUsers',
      v_auth_users,

      'tables',
      v_tables,

      'subscription',
      v_subscription,

      'storageManifest',
      v_storage_manifest,

      'restoreNotes',
      jsonb_build_array(
        'Supabase Auth passwords are not exported.',
        'Storage object bytes are not included; storageManifest lists tenant-owned product and receipt assets.',
        'Restore into an isolated environment and validate before any production restore.'
      )
    );

end;
$$;


revoke all
on function
public.export_platform_business_snapshot(uuid)
from
  public,
  anon;


grant execute
on function
public.export_platform_business_snapshot(uuid)
to authenticated;


notify pgrst,
'reload schema';
