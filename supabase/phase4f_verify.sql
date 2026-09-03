select

  to_regprocedure(
    'public.get_dashboard_report(uuid,date,date)'
  ) is not null
    as dashboard_report_exists,


  has_function_privilege(
    'authenticated',
    'public.get_dashboard_report(uuid,date,date)',
    'EXECUTE'
  )
    as authenticated_can_report,


  has_function_privilege(
    'anon',
    'public.get_dashboard_report(uuid,date,date)',
    'EXECUTE'
  )
    as anonymous_can_report;