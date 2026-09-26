-- ============================================================
-- ARC POS
-- PRE-PRODUCTION TEST DATA RESET
--
-- PURPOSE
--   Safely remove test operational data for ONE business before
--   importing the real catalog and beginning production use.
--
-- PRESERVED
--   • businesses / owner account
--   • staff_members / roles
--   • inventory_locations
--   • receipt_settings + receipt logo
--   • report_settings
--   • loyalty_settings
--   • subscription / plan state
--   • platform admin / backup history
--   • profile avatars
--
-- REMOVED FOR THE TARGET BUSINESS
--   • test sales / payments / refunds / voids
--   • test customers + loyalty ledger
--   • test expenses
--   • inventory movements / FIFO batches / levels
--   • pack-break + supplier-bonus audit rows
--   • products / variants / categories
--   • remote scanner sessions
--   • pending staff invitations (optional)
--
-- IMPORTANT
--   This file DEFINES a protected SQL-editor-only helper.
--   It does NOT reset anything automatically.
--
--   Run the commented example at the bottom only after replacing
--   the business UUID + exact business name.
-- ============================================================


create or replace function
private.arc_preproduction_reset_snapshot(
  p_business_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin

  if not exists (
    select 1
    from public.businesses
      as business_record
    where
      business_record.id =
        p_business_id
  )
  then
    raise exception
      'ARC business not found';
  end if;


  select jsonb_build_object(

    'businessId',
      p_business_id,

    'businessName',
      (
        select business_record.name
        from public.businesses
          as business_record
        where business_record.id =
          p_business_id
      ),

    'products',
      (
        select count(*)
        from public.products
          as product_record
        where product_record.business_id =
          p_business_id
      ),

    'variants',
      (
        select count(*)
        from public.product_variants
          as variant_record
        where variant_record.business_id =
          p_business_id
      ),

    'categories',
      (
        select count(*)
        from public.categories
          as category_record
        where category_record.business_id =
          p_business_id
      ),

    'inventoryLevels',
      (
        select count(*)
        from public.inventory_levels
          as level_record
        where level_record.business_id =
          p_business_id
      ),

    'inventoryMovements',
      (
        select count(*)
        from public.inventory_movements
          as movement_record
        where movement_record.business_id =
          p_business_id
      ),

    'fifoBatches',
      (
        select count(*)
        from public.inventory_price_batches
          as batch_record
        where batch_record.business_id =
          p_business_id
      ),

    'sales',
      (
        select count(*)
        from public.sales
          as sale_record
        where sale_record.business_id =
          p_business_id
      ),

    'payments',
      (
        select count(*)
        from public.payments
          as payment_record
        where payment_record.business_id =
          p_business_id
      ),

    'customers',
      (
        select count(*)
        from public.customers
          as customer_record
        where customer_record.business_id =
          p_business_id
      ),

    'loyaltyTransactions',
      (
        select count(*)
        from public.loyalty_transactions
          as loyalty_record
        where loyalty_record.business_id =
          p_business_id
      ),

    'expenses',
      (
        select count(*)
        from public.expenses
          as expense_record
        where expense_record.business_id =
          p_business_id
      ),

    'remoteScannerSessions',
      (
        select count(*)
        from public.remote_scanner_sessions
          as scanner_record
        where scanner_record.business_id =
          p_business_id
      ),

    'activeStaff',
      (
        select count(*)
        from public.staff_members
          as staff_record
        where
          staff_record.business_id =
            p_business_id
          and
          staff_record.status =
            'active'::public.nova_staff_status
      ),

    'inventoryLocations',
      (
        select count(*)
        from public.inventory_locations
          as location_record
        where location_record.business_id =
          p_business_id
      )

  )
  into
    v_result;


  if to_regclass(
    'public.inventory_unit_breaks'
  ) is not null
  then
    v_result :=
      v_result ||
      jsonb_build_object(
        'unitBreaks',
        (
          select count(*)
          from public.inventory_unit_breaks
            as break_record
          where break_record.business_id =
            p_business_id
        )
      );
  end if;


  if to_regclass(
    'public.inventory_supplier_bonus_receipts'
  ) is not null
  then
    v_result :=
      v_result ||
      jsonb_build_object(
        'supplierBonusReceipts',
        (
          select count(*)
          from public.inventory_supplier_bonus_receipts
            as bonus_record
          where bonus_record.business_id =
            p_business_id
        )
      );
  end if;


  if to_regclass(
    'public.staff_invitations'
  ) is not null
  then
    v_result :=
      v_result ||
      jsonb_build_object(
        'staffInvitations',
        (
          select count(*)
          from public.staff_invitations
            as invitation_record
          where invitation_record.business_id =
            p_business_id
        )
      );
  end if;


  return
    v_result;

end;
$$;


revoke all
on function
private.arc_preproduction_reset_snapshot(
  uuid
)
from
  public,
  anon,
  authenticated;



create or replace function
private.arc_preproduction_reset_business(
  p_business_id uuid,
  p_expected_business_name text,
  p_confirmation text,
  p_reset_categories boolean default true,
  p_reset_customers boolean default true,
  p_reset_expenses boolean default true,
  p_clear_staff_invitations boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_name text;

  v_before jsonb;
  v_after jsonb;

  v_deleted_products bigint := 0;
  v_deleted_categories bigint := 0;
  v_deleted_sales bigint := 0;
  v_deleted_customers bigint := 0;
  v_deleted_expenses bigint := 0;
  v_deleted_images bigint := 0;
begin

  if
    p_confirmation is distinct from
      'RESET ARC TEST DATA'
  then
    raise exception
      'Reset confirmation phrase is invalid';
  end if;


  select
    business_record.name
  into
    v_business_name
  from public.businesses
    as business_record
  where
    business_record.id =
      p_business_id;


  if
    v_business_name is null
  then
    raise exception
      'ARC business not found';
  end if;


  if
    btrim(
      coalesce(
        p_expected_business_name,
        ''
      )
    ) is distinct from
      v_business_name
  then
    raise exception
      'Business name confirmation failed. Expected exact name: %',
      v_business_name;
  end if;


  v_before :=
    private.arc_preproduction_reset_snapshot(
      p_business_id
    );


  -- ----------------------------------------------------------
  -- Session / invitation cleanup
  -- ----------------------------------------------------------

  delete from public.remote_scanner_sessions
  where business_id =
    p_business_id;


  if
    p_clear_staff_invitations
    and
    to_regclass(
      'public.staff_invitations'
    ) is not null
  then
    execute
      'delete from public.staff_invitations where business_id = $1'
    using
      p_business_id;
  end if;


  -- ----------------------------------------------------------
  -- Loyalty depends on sales / refunds / customers.
  -- Remove ledger first.
  -- ----------------------------------------------------------

  delete from public.loyalty_transactions
  where business_id =
    p_business_id;


  -- ----------------------------------------------------------
  -- Refund / void audit depends on sales + sale items.
  -- ----------------------------------------------------------

  delete from public.sale_refund_items
  where business_id =
    p_business_id;


  delete from public.sale_refunds
  where business_id =
    p_business_id;


  delete from public.sale_voids
  where business_id =
    p_business_id;


  -- ----------------------------------------------------------
  -- Payments / sale items cascade from sales, but explicit
  -- business-scoped deletion makes the reset intention clear.
  -- ----------------------------------------------------------

  delete from public.payments
  where business_id =
    p_business_id;


  delete from public.sale_items
  where business_id =
    p_business_id;


  delete from public.sales
  where business_id =
    p_business_id;


  get diagnostics
    v_deleted_sales =
      row_count;


  -- Reset document counters only after transaction history is
  -- gone, so production numbering starts cleanly at 1.

  update public.sale_receipt_counters
  set
    next_sequence =
      1,
    updated_at =
      now()
  where business_id =
    p_business_id;


  update public.sale_refund_counters
  set
    next_sequence =
      1,
    updated_at =
      now()
  where business_id =
    p_business_id;


  -- ----------------------------------------------------------
  -- Customer / expense test data
  -- ----------------------------------------------------------

  if
    p_reset_customers
  then
    delete from public.customers
    where business_id =
      p_business_id;

    get diagnostics
      v_deleted_customers =
        row_count;
  end if;


  if
    p_reset_expenses
  then
    delete from public.expenses
    where business_id =
      p_business_id;

    get diagnostics
      v_deleted_expenses =
        row_count;
  end if;


  -- ----------------------------------------------------------
  -- Inventory audit tables first because they intentionally
  -- RESTRICT deletion of variants / locations.
  -- ----------------------------------------------------------

  if to_regclass(
    'public.inventory_supplier_bonus_receipts'
  ) is not null
  then
    execute
      'delete from public.inventory_supplier_bonus_receipts where business_id = $1'
    using
      p_business_id;
  end if;


  if to_regclass(
    'public.inventory_unit_breaks'
  ) is not null
  then
    execute
      'delete from public.inventory_unit_breaks where business_id = $1'
    using
      p_business_id;
  end if;


  delete from public.inventory_price_batches
  where business_id =
    p_business_id;


  delete from public.inventory_movements
  where business_id =
    p_business_id;


  delete from public.inventory_levels
  where business_id =
    p_business_id;


  -- ----------------------------------------------------------
  -- Product image STORAGE BYTES are intentionally NOT deleted
  -- through SQL. Directly deleting storage.objects metadata can
  -- orphan physical objects. Remove the target business folder
  -- through Supabase Storage after running this reset.
  -- ----------------------------------------------------------

  if to_regclass(
    'storage.objects'
  ) is not null
  then
    select
      count(*)
    into
      v_deleted_images
    from storage.objects
      as storage_object
    where
      storage_object.bucket_id =
        'product-images'
      and
      storage_object.name like
        p_business_id::text
        ||
        '/%';
  end if;


  -- ----------------------------------------------------------
  -- Catalog
  -- ----------------------------------------------------------

  delete from public.product_variants
  where business_id =
    p_business_id;


  delete from public.products
  where business_id =
    p_business_id;


  get diagnostics
    v_deleted_products =
      row_count;


  if
    p_reset_categories
  then
    delete from public.categories
    where business_id =
      p_business_id;

    get diagnostics
      v_deleted_categories =
        row_count;
  end if;


  -- ----------------------------------------------------------
  -- Handoff acceptance becomes invalid after a data reset.
  -- Keep the record, but force a fresh final acceptance pass.
  -- ----------------------------------------------------------

  if to_regclass(
    'public.platform_business_handoff'
  ) is not null
  then
    execute $sql$
      update public.platform_business_handoff
      set
        business_details_verified = false,
        staff_access_verified = false,
        scanner_verified = false,
        receipt_print_verified = false,
        backup_files_verified = false,
        training_completed = false,
        approved_at = null,
        approved_by_user_id = null,
        notes = '',
        updated_at = now(),
        updated_by_user_id = null
      where business_id = $1
    $sql$
    using
      p_business_id;
  end if;


  v_after :=
    private.arc_preproduction_reset_snapshot(
      p_business_id
    );


  return jsonb_build_object(
    'status',
      'RESET COMPLETE',

    'businessId',
      p_business_id,

    'businessName',
      v_business_name,

    'before',
      v_before,

    'after',
      v_after,

    'deleted',
      jsonb_build_object(
        'sales',
          v_deleted_sales,

        'customers',
          v_deleted_customers,

        'expenses',
          v_deleted_expenses,

        'products',
          v_deleted_products,

        'categories',
          v_deleted_categories
      ),

    'productImageObjectsToRemoveViaStorage',
      v_deleted_images,

    'preserved',
      jsonb_build_array(
        'business',
        'owner/auth',
        'staff members',
        'inventory locations',
        'receipt settings/logo',
        'report settings',
        'loyalty settings',
        'subscription/plan',
        'backup history',
        'profile avatars'
      )
  );

end;
$$;


revoke all
on function
private.arc_preproduction_reset_business(
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean
)
from
  public,
  anon,
  authenticated;


-- ============================================================
-- USAGE
-- ============================================================
--
-- 1. Find the exact target business:
--
-- select id, name
-- from public.businesses
-- order by created_at;
--
-- 2. Preview counts before touching anything:
--
-- select private.arc_preproduction_reset_snapshot(
--   'BUSINESS_UUID_HERE'::uuid
-- );
--
-- 3. Run the reset ONLY after checking the UUID + exact name:
--
-- select private.arc_preproduction_reset_business(
--   'BUSINESS_UUID_HERE'::uuid,
--   'EXACT BUSINESS NAME HERE',
--   'RESET ARC TEST DATA',
--   true,  -- reset categories
--   true,  -- reset customers
--   true,  -- reset expenses
--   true   -- clear staff invitations
-- );
--
-- 4. Delete the matching BUSINESS_UUID folder from
--    Supabase Storage -> product-images using the Storage UI.
--
-- ============================================================
