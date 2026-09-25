-- ============================================================
-- NOVA POS
-- Platform administrator management verification
-- READ-ONLY
-- ============================================================

do $$

begin

  if not
    has_function_privilege(
      'authenticated',
      'public.list_platform_admins()',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.add_platform_admin(text,text)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.set_platform_admin_role(uuid,text)',
      'EXECUTE'
    )

    or not
    has_function_privilege(
      'authenticated',
      'public.remove_platform_admin(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Authenticated role is missing a platform admin management RPC grant';

  end if;


  if
    has_function_privilege(
      'anon',
      'public.list_platform_admins()',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.add_platform_admin(text,text)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.set_platform_admin_role(uuid,text)',
      'EXECUTE'
    )

    or
    has_function_privilege(
      'anon',
      'public.remove_platform_admin(uuid)',
      'EXECUTE'
    )
  then

    raise exception
      'Anonymous role can execute a platform admin management RPC';

  end if;


  if
    has_function_privilege(
      'authenticated',
      'private.is_platform_owner()',
      'EXECUTE'
    )
  then

    raise exception
      'Private platform-owner helper is exposed to authenticated clients';

  end if;

end;

$$;


select
  'PASS'
    as status,

  'NOVA platform administrator management verified.'
    as result;
