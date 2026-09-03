select

  to_regclass(
    'public.receipt_settings'
  ) is not null
    as receipt_settings_exists,

  (
    select relrowsecurity

    from pg_class

    where oid =
      'public.receipt_settings'::regclass
  )
    as receipt_settings_rls,

  has_table_privilege(
    'authenticated',
    'public.receipt_settings',
    'SELECT'
  )
    as authenticated_can_read,

  has_table_privilege(
    'authenticated',
    'public.receipt_settings',
    'UPDATE'
  )
    as authenticated_can_update,

  has_table_privilege(
    'authenticated',
    'public.receipt_settings',
    'INSERT'
  )
    as authenticated_can_insert;