-- ============================================================
-- NOVA POS
-- SaaS Phase 4E — Final platform / SaaS security audit
-- ============================================================
--
-- READ-ONLY.
--
-- Run after Phase 4A–4E database migrations.
-- Any exception means the pre-handoff platform foundation
-- should not be treated as complete.
-- ============================================================


-- ============================================================
-- 1. PLATFORM / COMMERCIAL TABLES MUST HAVE RLS
-- ============================================================

do $$

declare

  v_invalid text;

begin

  with required(table_name) as (

    values
      ('platform_admins'),
      ('platform_admin_audit_log'),
      ('subscription_plans'),
      ('business_subscriptions'),
      ('platform_backup_events'),
      ('platform_business_handoff')

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
      relation.oid is null

      or
      namespace.oid is null

      or
      relation.relrowsecurity
        is not true

  )

  select
    string_agg(
      invalid.table_name,
      ', '
      order by
        invalid.table_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Platform RLS audit failed: %',
      v_invalid;

  end if;

end;

$$;



-- ============================================================
-- 2. NO DIRECT ANON ACCESS TO PLATFORM TABLES
-- ============================================================

do $$

declare

  v_invalid text;

begin

  with protected(table_name) as (

    values
      ('platform_admins'),
      ('platform_admin_audit_log'),
      ('subscription_plans'),
      ('business_subscriptions'),
      ('platform_backup_events'),
      ('platform_business_handoff')

  ),

  invalid as (

    select
      protected.table_name

    from protected

    where
      has_table_privilege(
        'anon',
        format(
          'public.%I',
          protected.table_name
        ),
        'SELECT'
      )

      or
      has_table_privilege(
        'anon',
        format(
          'public.%I',
          protected.table_name
        ),
        'INSERT'
      )

      or
      has_table_privilege(
        'anon',
        format(
          'public.%I',
          protected.table_name
        ),
        'UPDATE'
      )

      or
      has_table_privilege(
        'anon',
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
      order by
        invalid.table_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Anonymous platform-table access remains on: %',
      v_invalid;

  end if;

end;

$$;



-- ============================================================
-- 3. APP ROLES MUST NOT MUTATE PLATFORM TABLES DIRECTLY
-- ============================================================

do $$

declare

  v_invalid text;

begin

  with protected(table_name) as (

    values
      ('platform_admins'),
      ('platform_admin_audit_log'),
      ('subscription_plans'),
      ('business_subscriptions'),
      ('platform_backup_events'),
      ('platform_business_handoff')

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
      order by
        invalid.table_name
    )

  into
    v_invalid

  from invalid;


  if
    v_invalid is not null
  then

    raise exception
      'Direct authenticated platform-table mutation remains on: %',
      v_invalid;

  end if;

end;

$$;



-- ============================================================
-- 4. PRIVATE ADMIN HELPERS MUST NOT BE CLIENT-EXECUTABLE
-- ============================================================

do $$
begin

  if
    has_function_privilege(
      'authenticated',
      'private.is_platform_admin()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'authenticated',
      'private.is_platform_owner()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'authenticated',
      'private.can_manage_platform_commercial()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'private.is_platform_admin()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'private.is_platform_owner()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'private.can_manage_platform_commercial()',
      'EXECUTE'
    )
  then

    raise exception
      'A private platform authorization helper is exposed to an app role';

  end if;

end;

$$;



-- ============================================================
-- 5. PLATFORM SECURITY DEFINER FUNCTIONS PIN SEARCH_PATH
-- ============================================================

do $$

declare

  v_invalid text;

begin

  select
    string_agg(
      procedure_record.proname,
      ', '
      order by
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

    and
    (
      procedure_record.proname like
        '%platform%'

      or

      procedure_record.proname in (
        'get_my_subscription'
      )
    )

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
      'Platform SECURITY DEFINER functions missing fixed search_path: %',
      v_invalid;

  end if;

end;

$$;



-- ============================================================
-- 6. PLAN MODEL MUST REMAIN STARTER / PRO / BUSINESS
-- ============================================================

do $$

declare

  v_invalid text;

begin

  select
    string_agg(
      plan.code,
      ', '
      order by
        plan.code
    )

  into
    v_invalid

  from public.subscription_plans
    as plan

  where
    plan.code not in (
      'starter',
      'pro',
      'business'
    )

    and
    (
      plan.is_public is true
      or
      plan.is_active is true
    );


  if
    v_invalid is not null
  then

    raise exception
      'Unexpected active/public subscription plans exist: %',
      v_invalid;

  end if;


  if exists (

    select
      1

    from public.subscription_plans
      as plan

    where
      plan.code =
        'lifetime_free'

  )
  then

    raise exception
      'Deprecated lifetime_free plan still exists';

  end if;

end;

$$;



-- ============================================================
-- 7. COMPLIMENTARY BILLING SHAPE
-- ============================================================

do $$

declare

  v_invalid_count integer;

begin

  select
    count(*)::integer

  into
    v_invalid_count

  from public.business_subscriptions
    as subscription

  where
    (
      subscription.complimentary_mode =
        'none'::public.nova_complimentary_mode

      and
      subscription.complimentary_until
        is not null
    )

    or

    (
      subscription.complimentary_mode =
        'until_date'::public.nova_complimentary_mode

      and
      subscription.complimentary_until
        is null
    )

    or

    (
      subscription.complimentary_mode =
        'lifetime'::public.nova_complimentary_mode

      and
      subscription.complimentary_until
        is not null
    );


  if
    v_invalid_count > 0
  then

    raise exception
      'Invalid complimentary subscription rows found: %',
      v_invalid_count;

  end if;

end;

$$;



-- ============================================================
-- 8. AT LEAST ONE PLATFORM OWNER MUST EXIST
-- ============================================================

do $$

declare

  v_owner_count integer;

begin

  select
    count(*)::integer

  into
    v_owner_count

  from public.platform_admins
    as platform_admin

  where
    platform_admin.role =
      'owner'::public.nova_platform_admin_role;


  if
    v_owner_count < 1
  then

    raise exception
      'NOVA has no Platform Owner';

  end if;

end;

$$;



-- ============================================================
-- 9. APPROVED HANDOFFS MUST HAVE ALL MANUAL CHECKS
-- ============================================================

do $$

declare

  v_invalid_count integer;

begin

  select
    count(*)::integer

  into
    v_invalid_count

  from public.platform_business_handoff
    as handoff

  where
    handoff.approved_at is not null

    and not (
      handoff.business_details_verified
      and
      handoff.staff_access_verified
      and
      handoff.scanner_verified
      and
      handoff.receipt_print_verified
      and
      handoff.backup_files_verified
      and
      handoff.training_completed
    );


  if
    v_invalid_count > 0
  then

    raise exception
      'Approved handoffs exist with incomplete manual checks: %',
      v_invalid_count;

  end if;

end;

$$;



select
  'PASS'
    as status,

  'NOVA SaaS Phase 4 platform/security audit passed.'
    as result;
