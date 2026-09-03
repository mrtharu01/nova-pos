select

  to_regprocedure(
    'public.get_my_business_access(uuid)'
  ) is not null
    as access_function_exists,

  to_regprocedure(
    'public.list_business_staff(uuid)'
  ) is not null
    as list_staff_exists,

  to_regprocedure(
    'public.add_business_staff(uuid,text,public.nova_staff_role)'
  ) is not null
    as add_staff_exists,

  to_regprocedure(
    'public.update_business_staff(uuid,uuid,public.nova_staff_role,public.nova_staff_status)'
  ) is not null
    as update_staff_exists,

  has_function_privilege(
    'authenticated',
    'public.get_my_business_access(uuid)',
    'EXECUTE'
  )
    as authenticated_can_get_access,

  has_function_privilege(
    'anon',
    'public.get_my_business_access(uuid)',
    'EXECUTE'
  )
    as anonymous_can_get_access;