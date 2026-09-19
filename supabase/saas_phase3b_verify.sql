-- ============================================================
-- NOVA POS
-- SaaS Phase 3 — Single-tenant guardrail verification
-- ============================================================
--
-- Read-only verification. Run after:
--   saas_phase3b_single_tenant_guardrails.sql
-- ============================================================


-- ============================================================
-- 1. EXISTING DATA MUST NOT LINK A USER TO MULTIPLE ACTIVE
--    BUSINESSES.
-- ============================================================

do $$

declare
  v_conflicting_users text;

begin

  with active_links as (

    select
      business.owner_user_id
        as user_id,

      business.id
        as business_id

    from public.businesses
      as business


    union


    select
      staff.user_id,

      staff.business_id

    from public.staff_members
      as staff

    where
      staff.status =
        'active'::public.nova_staff_status

  ),

  conflicts as (

    select
      active_links.user_id

    from active_links

    group by
      active_links.user_id

    having
      count(
        distinct active_links.business_id
      ) > 1

  )

  select
    string_agg(
      conflicts.user_id::text,
      ', '
      order by conflicts.user_id::text
    )

  into
    v_conflicting_users

  from conflicts;


  if
    v_conflicting_users is not null
  then

    raise exception
      'Existing cross-tenant memberships must be resolved before continuing: %',
      v_conflicting_users;

  end if;

end;

$$;



-- ============================================================
-- 2. EXPECTED TRIGGERS MUST EXIST AND BE ENABLED.
-- ============================================================

do $$

declare
  v_missing text;

begin

  with expected(
    table_name,
    trigger_name
  ) as (

    values
      (
        'staff_members',
        'nova_single_active_business_membership'
      ),
      (
        'businesses',
        'nova_single_owner_workspace'
      )

  ),

  missing as (

    select
      expected.trigger_name

    from expected

    left join pg_catalog.pg_trigger
      as trigger_record

      on
        trigger_record.tgname =
          expected.trigger_name

        and
        trigger_record.tgrelid =
          (
            'public.'
            ||
            expected.table_name
          )::regclass

        and
        trigger_record.tgenabled <>
          'D'

    where
      trigger_record.oid
        is null

  )

  select
    string_agg(
      missing.trigger_name,
      ', '
      order by missing.trigger_name
    )

  into
    v_missing

  from missing;


  if
    v_missing is not null
  then

    raise exception
      'Tenant guardrail trigger check failed: %',
      v_missing;

  end if;

end;

$$;



-- ============================================================
-- 3. MEMBERSHIP HELPERS MUST REMAIN SECURITY DEFINER AND
--    UNAVAILABLE TO CLIENT ROLES DIRECTLY.
-- ============================================================

do $$

declare
  v_is_member_definer boolean;

  v_is_manager_definer boolean;

begin

  select
    procedure_record.prosecdef

  into
    v_is_member_definer

  from pg_catalog.pg_proc
    as procedure_record

  where
    procedure_record.oid =
      'private.is_business_member(uuid)'::regprocedure;


  select
    procedure_record.prosecdef

  into
    v_is_manager_definer

  from pg_catalog.pg_proc
    as procedure_record

  where
    procedure_record.oid =
      'private.is_business_manager(uuid)'::regprocedure;


  if
    v_is_member_definer is not true

    or

    v_is_manager_definer is not true
  then

    raise exception
      'Tenant membership helpers must remain SECURITY DEFINER';

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
      'Anonymous users must not execute private tenant helpers';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'private.is_business_member(uuid)',
      'EXECUTE'
    )

    or not

    has_function_privilege(
      'authenticated',
      'private.is_business_manager(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated RLS evaluation requires tenant helper EXECUTE privileges';

  end if;

end;

$$;


do $
begin
  raise notice
    'NOVA SaaS single-tenant guardrails verified.';
end;
$;
