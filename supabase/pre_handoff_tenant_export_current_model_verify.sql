-- ============================================================
-- ARC
-- PRE-HANDOFF — CURRENT-MODEL TENANT EXPORT VERIFY
-- READ-ONLY
-- ============================================================


do $$
declare
  v_definition text;
begin

  if to_regprocedure(
    'public.export_platform_business_snapshot(uuid)'
  ) is null
  then
    raise exception
      'Tenant export RPC is missing';
  end if;


  select
    pg_get_functiondef(
      to_regprocedure(
        'public.export_platform_business_snapshot(uuid)'
      )
    )
  into
    v_definition;


  if
    v_definition not like
      '%inventory_price_batches%'
  then
    raise exception
      'Tenant export does not include FIFO price batches';
  end if;


  if
    v_definition not like
      '%inventory_unit_breaks%'
  then
    raise exception
      'Tenant export does not include pack/loose break history';
  end if;


  if
    v_definition not like
      '%inventory_supplier_bonus_receipts%'
  then
    raise exception
      'Tenant export does not include supplier bonus history';
  end if;


  if
    v_definition not like
      '%platform_business_handoff%'
  then
    raise exception
      'Tenant export does not include the handoff checklist';
  end if;


  if
    has_function_privilege(
      'anon',
      'public.export_platform_business_snapshot(uuid)',
      'EXECUTE'
    )
  then
    raise exception
      'Anonymous role can execute the tenant export';
  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.export_platform_business_snapshot(uuid)',
      'EXECUTE'
    )
  then
    raise exception
      'Authenticated platform administrators cannot execute the tenant export RPC';
  end if;

end;
$$;


select
  'PASS'
    as status,

  'ARC current-model tenant export verified.'
    as result;
