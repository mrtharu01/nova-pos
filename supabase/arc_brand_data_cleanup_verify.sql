-- ============================================================
-- ARC
-- Brand data cleanup verification
-- READ-ONLY
-- ============================================================

do $$
begin

  if exists (

    select
      1

    from public.subscription_plans
      as plan

    where
      plan.description like
        '%NOVA%'

  )
  then

    raise exception
      'A visible subscription plan description still contains NOVA';

  end if;


  if exists (

    select
      1

    from public.report_settings
      as settings

    where
      settings.footer_message =
        'Thank you for using NOVA POS.'

  )
  then

    raise exception
      'A report footer still contains the legacy NOVA POS brand';

  end if;

end;
$$;


select
  'PASS'
    as status,

  'ARC persisted brand data verified.'
    as result;
