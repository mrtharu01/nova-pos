-- ============================================================
-- NOVA POS
-- Tenant plan surface verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if
    has_function_privilege(
      'anon',
      'public.list_my_available_subscription_plans()',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can list the NOVA tenant plan catalog';

  end if;


  if not
    has_function_privilege(
      'authenticated',
      'public.list_my_available_subscription_plans()',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role cannot list the NOVA tenant plan catalog';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'NOVA tenant plan surface verified.'
    as result;
