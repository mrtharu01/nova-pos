select

  exists (

    select 1

    from information_schema.columns

    where
      table_schema =
        'public'

      and
      table_name =
        'sales'

      and
      column_name =
        'checkout_key'

  )
    as checkout_key_exists,


  exists (

    select 1

    from information_schema.columns

    where
      table_schema =
        'public'

      and
      table_name =
        'sales'

      and
      column_name =
        'cashier_label'

  )
    as cashier_label_exists,


  to_regprocedure(
    'private.nova_checkout_items(jsonb)'
  ) is not null
    as checkout_parser_exists,


  to_regprocedure(
    'public.complete_sale(uuid,uuid,jsonb,public.nova_payment_method,numeric,text,numeric,text,text,text,text)'
  ) is not null
    as complete_sale_exists,


  has_function_privilege(

    'authenticated',

    'public.complete_sale(uuid,uuid,jsonb,public.nova_payment_method,numeric,text,numeric,text,text,text,text)',

    'EXECUTE'

  )
    as authenticated_can_checkout,


  has_table_privilege(
    'authenticated',
    'public.sales',
    'INSERT'
  )
    as browser_can_directly_insert_sales;