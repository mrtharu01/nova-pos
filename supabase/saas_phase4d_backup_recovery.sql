-- ============================================================
-- NOVA POS
-- SaaS Phase 4D — Backup / recovery foundation
-- ============================================================
--
-- Adds:
--   • secure backup / restore event ledger
--   • tenant JSON export RPC for NOVA Control
--   • backup overview RPC
--
-- Important:
--   Supabase database backups do NOT contain Storage object
--   bytes. NOVA therefore tracks database and Storage backups
--   separately.
--
-- Full database dumps / Storage snapshots remain operational
-- jobs outside the browser. NOVA Control records their status
-- and provides tenant-scoped exports.
-- ============================================================


-- ============================================================
-- 1. TYPES
-- ============================================================

do $$
begin
  create type
    public.nova_backup_event_kind
  as enum (
    'database_dump',
    'storage_snapshot',
    'tenant_export',
    'restore_test'
  );
exception
  when duplicate_object
  then null;
end;
$$;


do $$
begin
  create type
    public.nova_backup_event_status
  as enum (
    'success',
    'failed'
  );
exception
  when duplicate_object
  then null;
end;
$$;



-- ============================================================
-- 2. BACKUP / RECOVERY EVENT LEDGER
-- ============================================================

create table if not exists
public.platform_backup_events (

  id uuid
    primary key
    default gen_random_uuid(),

  kind public.nova_backup_event_kind
    not null,

  status public.nova_backup_event_status
    not null,

  business_id uuid
    references public.businesses(id)
    on delete set null,

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  note text
    not null
    default '',

  metadata jsonb
    not null
    default '{}'::jsonb,

  occurred_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  constraint
    platform_backup_events_metadata_object
    check (
      jsonb_typeof(
        metadata
      ) =
        'object'
    )

);


create index if not exists
platform_backup_events_kind_occurred_idx

on public.platform_backup_events (
  kind,
  occurred_at desc
);


create index if not exists
platform_backup_events_business_occurred_idx

on public.platform_backup_events (
  business_id,
  occurred_at desc
);


alter table
public.platform_backup_events
enable row level security;


revoke all
on public.platform_backup_events
from
  public,
  anon,
  authenticated;



-- ============================================================
-- 3. RECORD BACKUP / RESTORE EVENT
--
-- Owner + Admin may record operational events.
-- Support is read-only.
-- ============================================================

create or replace function
public.record_platform_backup_event(
  p_kind text,
  p_status text,
  p_target_business_id uuid
    default null,
  p_note text
    default '',
  p_metadata jsonb
    default '{}'::jsonb,
  p_occurred_at timestamptz
    default now()
)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_actor_user_id uuid :=
    (
      select auth.uid()
    );

  v_kind
    public.nova_backup_event_kind;

  v_status
    public.nova_backup_event_status;

  v_event_id uuid;

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


  begin

    v_kind :=
      lower(
        btrim(
          coalesce(
            p_kind,
            ''
          )
        )
      )::public.nova_backup_event_kind;

  exception
    when invalid_text_representation
    then
      raise exception
        'Invalid backup event kind';
  end;


  begin

    v_status :=
      lower(
        btrim(
          coalesce(
            p_status,
            ''
          )
        )
      )::public.nova_backup_event_status;

  exception
    when invalid_text_representation
    then
      raise exception
        'Invalid backup event status';
  end;


  if
    p_target_business_id is not null

    and not exists (

      select
        1

      from public.businesses
        as business

      where
        business.id =
          p_target_business_id

    )
  then

    raise exception
      'NOVA business was not found';

  end if;


  if
    jsonb_typeof(
      coalesce(
        p_metadata,
        '{}'::jsonb
      )
    ) <>
      'object'
  then

    raise exception
      'Backup metadata must be a JSON object';

  end if;


  insert into public.platform_backup_events (
    kind,
    status,
    business_id,
    actor_user_id,
    note,
    metadata,
    occurred_at
  )

  values (
    v_kind,
    v_status,
    p_target_business_id,
    v_actor_user_id,
    btrim(
      coalesce(
        p_note,
        ''
      )
    ),
    coalesce(
      p_metadata,
      '{}'::jsonb
    ),
    coalesce(
      p_occurred_at,
      now()
    )
  )

  returning
    id

  into
    v_event_id;


  insert into public.platform_admin_audit_log (
    actor_user_id,
    action,
    target_business_id,
    metadata
  )

  values (
    v_actor_user_id,
    'backup_event_recorded',
    p_target_business_id,
    jsonb_build_object(
      'backupEventId',
      v_event_id,
      'kind',
      v_kind::text,
      'status',
      v_status::text
    )
  );


  return
    v_event_id;

end;

$$;


revoke all
on function
public.record_platform_backup_event(
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz
)
from
  public,
  anon;


grant execute
on function
public.record_platform_backup_event(
  text,
  text,
  uuid,
  text,
  jsonb,
  timestamptz
)
to authenticated;



-- ============================================================
-- 4. LIST BACKUP / RESTORE EVENTS
-- ============================================================

create or replace function
public.list_platform_backup_events(
  p_limit integer
    default 100
)

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(
          p_limit,
          100
        ),
        500
      )
    );

  v_result jsonb :=
    '[]'::jsonb;

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
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
          backup_event.id,

          'kind',
          backup_event.kind::text,

          'status',
          backup_event.status::text,

          'businessId',
          backup_event.business_id,

          'businessName',
          business.name,

          'actorUserId',
          backup_event.actor_user_id,

          'actorEmail',
          auth_user.email,

          'note',
          backup_event.note,

          'metadata',
          backup_event.metadata,

          'occurredAt',
          backup_event.occurred_at,

          'createdAt',
          backup_event.created_at
        )
        order by
          backup_event.occurred_at desc
      ),
      '[]'::jsonb
    )

  into
    v_result

  from (

    select
      event_row.*

    from public.platform_backup_events
      as event_row

    order by
      event_row.occurred_at desc

    limit
      v_limit

  )
    as backup_event

  left join public.businesses
    as business

    on
      business.id =
        backup_event.business_id

  left join auth.users
    as auth_user

    on
      auth_user.id =
        backup_event.actor_user_id;


  return
    v_result;

end;

$$;


revoke all
on function
public.list_platform_backup_events(integer)
from
  public,
  anon;


grant execute
on function
public.list_platform_backup_events(integer)
to authenticated;



-- ============================================================
-- 5. BACKUP OVERVIEW
-- ============================================================

create or replace function
public.get_platform_backup_overview()

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

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


  return
    jsonb_build_object(

      'latestDatabaseDumpAt',
      (
        select
          max(
            event_row.occurred_at
          )

        from public.platform_backup_events
          as event_row

        where
          event_row.kind =
            'database_dump'::public.nova_backup_event_kind

          and
          event_row.status =
            'success'::public.nova_backup_event_status
      ),

      'latestStorageSnapshotAt',
      (
        select
          max(
            event_row.occurred_at
          )

        from public.platform_backup_events
          as event_row

        where
          event_row.kind =
            'storage_snapshot'::public.nova_backup_event_kind

          and
          event_row.status =
            'success'::public.nova_backup_event_status
      ),

      'latestRestoreTestAt',
      (
        select
          max(
            event_row.occurred_at
          )

        from public.platform_backup_events
          as event_row

        where
          event_row.kind =
            'restore_test'::public.nova_backup_event_kind

          and
          event_row.status =
            'success'::public.nova_backup_event_status
      ),

      'tenantExportCount',
      (
        select
          count(*)::bigint

        from public.platform_backup_events
          as event_row

        where
          event_row.kind =
            'tenant_export'::public.nova_backup_event_kind

          and
          event_row.status =
            'success'::public.nova_backup_event_status
      )
    );

end;

$$;


revoke all
on function
public.get_platform_backup_overview()
from
  public,
  anon;


grant execute
on function
public.get_platform_backup_overview()
to authenticated;



-- ============================================================
-- 6. TENANT SNAPSHOT EXPORT
--
-- Data only. Password hashes / secret keys are never exported.
-- Storage object BYTES are not inside this JSON. A storage
-- manifest is included so object backups can be verified
-- separately.
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
      'staff_invitations'
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
      'NOVA business was not found';

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
      'NOVA_TENANT_EXPORT_V1',

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
