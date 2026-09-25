-- ============================================================
-- NOVA POS
-- SaaS Phase 4E — Production readiness / handoff gate
-- ============================================================
--
-- Creates a per-business production-readiness record and
-- combines manual acceptance checks with database-verifiable
-- readiness gates.
--
-- This does NOT hand a tenant over automatically. A Platform
-- Owner/Admin must explicitly approve handoff after all gates
-- pass.
-- ============================================================


-- ============================================================
-- 1. HANDOFF CHECKLIST
-- ============================================================

create table if not exists
public.platform_business_handoff (

  business_id uuid
    primary key
    references public.businesses(id)
    on delete cascade,

  business_details_verified boolean
    not null
    default false,

  staff_access_verified boolean
    not null
    default false,

  scanner_verified boolean
    not null
    default false,

  receipt_print_verified boolean
    not null
    default false,

  backup_files_verified boolean
    not null
    default false,

  training_completed boolean
    not null
    default false,

  notes text
    not null
    default '',

  approved_at timestamptz,

  approved_by_user_id uuid
    references auth.users(id)
    on delete set null,

  updated_at timestamptz
    not null
    default now(),

  updated_by_user_id uuid
    references auth.users(id)
    on delete set null,

  constraint
    platform_business_handoff_approval_shape
    check (
      (
        approved_at is null
        and
        approved_by_user_id is null
      )

      or

      (
        approved_at is not null
        and
        approved_by_user_id is not null
      )
    )

);


alter table
public.platform_business_handoff
enable row level security;


revoke all
on public.platform_business_handoff
from
  public,
  anon,
  authenticated;


drop trigger if exists
platform_business_handoff_set_updated_at

on public.platform_business_handoff;


create trigger
platform_business_handoff_set_updated_at

before update

on public.platform_business_handoff

for each row

execute function
public.set_updated_at();



-- ============================================================
-- 2. READINESS SNAPSHOT
-- ============================================================

create or replace function
public.get_platform_business_production_readiness(
  p_business_id uuid
)

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_business public.businesses%rowtype;

  v_owner_email text;

  v_owner_confirmed boolean :=
    false;

  v_product_count bigint :=
    0;

  v_variant_count bigint :=
    0;

  v_location_count bigint :=
    0;

  v_inventory_level_count bigint :=
    0;

  v_active_staff_count bigint :=
    0;

  v_receipt_ready boolean :=
    false;

  v_sale_count bigint :=
    0;

  v_latest_sale_at timestamptz;

  v_subscription jsonb;

  v_subscription_ready boolean :=
    false;

  v_lifetime_complimentary boolean :=
    false;

  v_tenant_export_ready boolean :=
    false;

  v_database_backup_ready boolean :=
    false;

  v_storage_backup_ready boolean :=
    false;

  v_restore_test_ready boolean :=
    false;

  v_checklist public.platform_business_handoff%rowtype;

  v_manual_ready boolean :=
    false;

  v_automatic_ready boolean :=
    false;

  v_ready_to_handoff boolean :=
    false;

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
    business.*

  into
    v_business

  from public.businesses
    as business

  where
    business.id =
      p_business_id;


  if not found
  then

    raise exception
      'NOVA business was not found';

  end if;


  select
    auth_user.email::text,
    auth_user.email_confirmed_at
      is not null

  into
    v_owner_email,
    v_owner_confirmed

  from auth.users
    as auth_user

  where
    auth_user.id =
      v_business.owner_user_id;


  select
    count(*)

  into
    v_product_count

  from public.products
    as product

  where
    product.business_id =
      p_business_id

    and
    product.status =
      'active'::public.nova_product_status;


  select
    count(*)

  into
    v_variant_count

  from public.product_variants
    as variant

  where
    variant.business_id =
      p_business_id

    and
    variant.is_active is true;


  select
    count(*)

  into
    v_location_count

  from public.inventory_locations
    as location

  where
    location.business_id =
      p_business_id

    and
    location.is_active is true;


  select
    count(*)

  into
    v_inventory_level_count

  from public.inventory_levels
    as inventory

  where
    inventory.business_id =
      p_business_id;


  select
    count(*)

  into
    v_active_staff_count

  from public.staff_members
    as staff

  where
    staff.business_id =
      p_business_id

    and
    staff.status =
      'active'::public.nova_staff_status;


  select
    (
      receipt.business_id is not null

      and

      btrim(
        coalesce(
          receipt.display_name,
          ''
        )
      ) <> ''
    )

  into
    v_receipt_ready

  from public.receipt_settings
    as receipt

  where
    receipt.business_id =
      p_business_id;


  v_receipt_ready :=
    coalesce(
      v_receipt_ready,
      false
    );


  select
    count(*),
    max(
      sale.created_at
    )

  into
    v_sale_count,
    v_latest_sale_at

  from public.sales
    as sale

  where
    sale.business_id =
      p_business_id

    and
    sale.status <>
      'voided'::public.nova_sale_status;


  select
    jsonb_build_object(
      'subscriptionId',
      subscription.id,

      'status',
      subscription.status::text,

      'billingInterval',
      subscription.billing_interval::text,

      'complimentaryMode',
      subscription.complimentary_mode::text,

      'complimentaryUntil',
      subscription.complimentary_until,

      'planCode',
      plan.code,

      'planName',
      plan.name
    ),

    (
      subscription.status =
        'active'::public.nova_subscription_status

      and

      plan.is_active is true
    ),

    (
      subscription.status =
        'active'::public.nova_subscription_status

      and

      subscription.complimentary_mode =
        'lifetime'::public.nova_complimentary_mode
    )

  into
    v_subscription,
    v_subscription_ready,
    v_lifetime_complimentary

  from public.business_subscriptions
    as subscription

  join public.subscription_plans
    as plan

    on
      plan.id =
        subscription.plan_id

  where
    subscription.business_id =
      p_business_id;


  v_subscription_ready :=
    coalesce(
      v_subscription_ready,
      false
    );


  v_lifetime_complimentary :=
    coalesce(
      v_lifetime_complimentary,
      false
    );


  if to_regclass(
    'public.platform_backup_events'
  ) is not null
  then

    select
      exists (

        select
          1

        from public.platform_backup_events
          as backup_event

        where
          backup_event.kind =
            'tenant_export'::public.nova_backup_event_kind

          and
          backup_event.status =
            'success'::public.nova_backup_event_status

          and
          backup_event.business_id =
            p_business_id

      ),

      exists (

        select
          1

        from public.platform_backup_events
          as backup_event

        where
          backup_event.kind =
            'database_dump'::public.nova_backup_event_kind

          and
          backup_event.status =
            'success'::public.nova_backup_event_status

      ),

      exists (

        select
          1

        from public.platform_backup_events
          as backup_event

        where
          backup_event.kind =
            'storage_snapshot'::public.nova_backup_event_kind

          and
          backup_event.status =
            'success'::public.nova_backup_event_status

      ),

      exists (

        select
          1

        from public.platform_backup_events
          as backup_event

        where
          backup_event.kind =
            'restore_test'::public.nova_backup_event_kind

          and
          backup_event.status =
            'success'::public.nova_backup_event_status

      )

    into
      v_tenant_export_ready,
      v_database_backup_ready,
      v_storage_backup_ready,
      v_restore_test_ready;

  end if;


  select
    handoff.*

  into
    v_checklist

  from public.platform_business_handoff
    as handoff

  where
    handoff.business_id =
      p_business_id;


  v_manual_ready :=
    coalesce(
      v_checklist.business_details_verified,
      false
    )

    and
    coalesce(
      v_checklist.staff_access_verified,
      false
    )

    and
    coalesce(
      v_checklist.scanner_verified,
      false
    )

    and
    coalesce(
      v_checklist.receipt_print_verified,
      false
    )

    and
    coalesce(
      v_checklist.backup_files_verified,
      false
    )

    and
    coalesce(
      v_checklist.training_completed,
      false
    );


  v_automatic_ready :=
    v_owner_confirmed

    and
    v_product_count > 0

    and
    v_variant_count > 0

    and
    v_location_count > 0

    and
    v_inventory_level_count > 0

    and
    v_receipt_ready

    and
    v_sale_count > 0

    and
    v_subscription_ready

    and
    v_tenant_export_ready

    and
    v_database_backup_ready

    and
    v_storage_backup_ready

    and
    v_restore_test_ready;


  v_ready_to_handoff :=
    v_automatic_ready
    and
    v_manual_ready;


  return
    jsonb_build_object(

      'business',
      jsonb_build_object(
        'id',
        v_business.id,

        'name',
        v_business.name,

        'ownerUserId',
        v_business.owner_user_id,

        'ownerEmail',
        v_owner_email,

        'currencyCode',
        v_business.currency_code,

        'timezone',
        v_business.timezone,

        'createdAt',
        v_business.created_at
      ),

      'subscription',
      v_subscription,

      'counts',
      jsonb_build_object(
        'activeProducts',
        v_product_count,

        'activeVariants',
        v_variant_count,

        'activeLocations',
        v_location_count,

        'inventoryLevels',
        v_inventory_level_count,

        'activeStaff',
        v_active_staff_count,

        'completedSales',
        v_sale_count
      ),

      'automaticChecks',
      jsonb_build_object(
        'ownerConfirmed',
        v_owner_confirmed,

        'catalogConfigured',
        (
          v_product_count > 0
          and
          v_variant_count > 0
        ),

        'inventoryConfigured',
        (
          v_location_count > 0
          and
          v_inventory_level_count > 0
        ),

        'receiptConfigured',
        v_receipt_ready,

        'subscriptionActive',
        v_subscription_ready,

        'lifetimeComplimentary',
        v_lifetime_complimentary,

        'realTransactionCompleted',
        v_sale_count > 0,

        'tenantExportCompleted',
        v_tenant_export_ready,

        'databaseBackupRecorded',
        v_database_backup_ready,

        'storageSnapshotRecorded',
        v_storage_backup_ready,

        'restoreTestRecorded',
        v_restore_test_ready
      ),

      'latestSaleAt',
      v_latest_sale_at,

      'manualChecks',
      jsonb_build_object(
        'businessDetailsVerified',
        coalesce(
          v_checklist.business_details_verified,
          false
        ),

        'staffAccessVerified',
        coalesce(
          v_checklist.staff_access_verified,
          false
        ),

        'scannerVerified',
        coalesce(
          v_checklist.scanner_verified,
          false
        ),

        'receiptPrintVerified',
        coalesce(
          v_checklist.receipt_print_verified,
          false
        ),

        'backupFilesVerified',
        coalesce(
          v_checklist.backup_files_verified,
          false
        ),

        'trainingCompleted',
        coalesce(
          v_checklist.training_completed,
          false
        ),

        'notes',
        coalesce(
          v_checklist.notes,
          ''
        )
      ),

      'automaticReady',
      v_automatic_ready,

      'manualReady',
      v_manual_ready,

      'readyToHandoff',
      v_ready_to_handoff,

      'handoffApproved',
      v_checklist.approved_at is not null,

      'approvedAt',
      v_checklist.approved_at,

      'approvedByUserId',
      v_checklist.approved_by_user_id
    );

end;

$$;


revoke all
on function
public.get_platform_business_production_readiness(uuid)
from
  public,
  anon;


grant execute
on function
public.get_platform_business_production_readiness(uuid)
to authenticated;



-- ============================================================
-- 3. SAVE MANUAL ACCEPTANCE CHECKLIST
-- ============================================================

create or replace function
public.save_platform_business_handoff_checklist(
  p_business_id uuid,
  p_business_details_verified boolean,
  p_staff_access_verified boolean,
  p_scanner_verified boolean,
  p_receipt_print_verified boolean,
  p_backup_files_verified boolean,
  p_training_completed boolean,
  p_notes text
)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_actor_user_id uuid :=
    (
      select auth.uid()
    );

begin

  if not (
    select private.can_manage_platform_commercial()
  )
  then

    raise exception
      'Platform administrative access required'
      using errcode =
        '42501';

  end if;


  if not exists (

    select
      1

    from public.businesses
      as business

    where
      business.id =
        p_business_id

  )
  then

    raise exception
      'NOVA business was not found';

  end if;


  insert into public.platform_business_handoff (
    business_id,
    business_details_verified,
    staff_access_verified,
    scanner_verified,
    receipt_print_verified,
    backup_files_verified,
    training_completed,
    notes,
    updated_by_user_id
  )

  values (
    p_business_id,
    coalesce(
      p_business_details_verified,
      false
    ),
    coalesce(
      p_staff_access_verified,
      false
    ),
    coalesce(
      p_scanner_verified,
      false
    ),
    coalesce(
      p_receipt_print_verified,
      false
    ),
    coalesce(
      p_backup_files_verified,
      false
    ),
    coalesce(
      p_training_completed,
      false
    ),
    btrim(
      coalesce(
        p_notes,
        ''
      )
    ),
    v_actor_user_id
  )

  on conflict (
    business_id
  )

  do update

  set
    business_details_verified =
      excluded.business_details_verified,

    staff_access_verified =
      excluded.staff_access_verified,

    scanner_verified =
      excluded.scanner_verified,

    receipt_print_verified =
      excluded.receipt_print_verified,

    backup_files_verified =
      excluded.backup_files_verified,

    training_completed =
      excluded.training_completed,

    notes =
      excluded.notes,

    updated_by_user_id =
      v_actor_user_id;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    target_business_id,
    metadata
  )

  values (
    v_actor_user_id,
    'business_handoff_checklist_saved',
    p_business_id,
    jsonb_build_object(
      'businessDetailsVerified',
      coalesce(
        p_business_details_verified,
        false
      ),
      'staffAccessVerified',
      coalesce(
        p_staff_access_verified,
        false
      ),
      'scannerVerified',
      coalesce(
        p_scanner_verified,
        false
      ),
      'receiptPrintVerified',
      coalesce(
        p_receipt_print_verified,
        false
      ),
      'backupFilesVerified',
      coalesce(
        p_backup_files_verified,
        false
      ),
      'trainingCompleted',
      coalesce(
        p_training_completed,
        false
      )
    )
  );


  return
    public.get_platform_business_production_readiness(
      p_business_id
    );

end;

$$;


revoke all
on function
public.save_platform_business_handoff_checklist(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text
)
from
  public,
  anon;


grant execute
on function
public.save_platform_business_handoff_checklist(
  uuid,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text
)
to authenticated;



-- ============================================================
-- 4. APPROVE / REOPEN HANDOFF
-- ============================================================

create or replace function
public.set_platform_business_handoff_approval(
  p_business_id uuid,
  p_approved boolean
)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_actor_user_id uuid :=
    (
      select auth.uid()
    );

  v_readiness jsonb;

begin

  if not (
    select private.can_manage_platform_commercial()
  )
  then

    raise exception
      'Platform administrative access required'
      using errcode =
        '42501';

  end if;


  insert into public.platform_business_handoff (
    business_id,
    updated_by_user_id
  )

  values (
    p_business_id,
    v_actor_user_id
  )

  on conflict (
    business_id
  )

  do nothing;


  if
    coalesce(
      p_approved,
      false
    )
  then

    v_readiness :=
      public.get_platform_business_production_readiness(
        p_business_id
      );


    if
      coalesce(
        (
          v_readiness
          ->>
          'readyToHandoff'
        )::boolean,
        false
      )
      is not true
    then

      raise exception
        'All production-readiness checks must pass before handoff approval';

    end if;


    update public.platform_business_handoff

    set
      approved_at =
        now(),

      approved_by_user_id =
        v_actor_user_id,

      updated_by_user_id =
        v_actor_user_id

    where
      business_id =
        p_business_id;

  else

    update public.platform_business_handoff

    set
      approved_at =
        null,

      approved_by_user_id =
        null,

      updated_by_user_id =
        v_actor_user_id

    where
      business_id =
        p_business_id;

  end if;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    target_business_id,
    metadata
  )

  values (
    v_actor_user_id,

    case
      when coalesce(
        p_approved,
        false
      )
      then
        'business_handoff_approved'
      else
        'business_handoff_reopened'
    end,

    p_business_id,

    jsonb_build_object(
      'approved',
      coalesce(
        p_approved,
        false
      )
    )
  );


  return
    public.get_platform_business_production_readiness(
      p_business_id
    );

end;

$$;


revoke all
on function
public.set_platform_business_handoff_approval(
  uuid,
  boolean
)
from
  public,
  anon;


grant execute
on function
public.set_platform_business_handoff_approval(
  uuid,
  boolean
)
to authenticated;


notify pgrst,
'reload schema';
