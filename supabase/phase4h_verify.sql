select

  to_regclass(
    'public.sale_refunds'
  ) is not null
    as refunds_table_exists,


  to_regclass(
    'public.sale_refund_items'
  ) is not null
    as refund_items_table_exists,


  to_regclass(
    'public.sale_voids'
  ) is not null
    as sale_voids_table_exists,


  to_regprocedure(
    'public.refund_sale(uuid,uuid,jsonb,public.nova_payment_method,text,text)'
  ) is not null
    as refund_rpc_exists,


  to_regprocedure(
    'public.void_sale(uuid,uuid,text,text)'
  ) is not null
    as void_rpc_exists,


  has_function_privilege(
    'authenticated',
    'public.refund_sale(uuid,uuid,jsonb,public.nova_payment_method,text,text)',
    'EXECUTE'
  )
    as authenticated_can_refund,


  has_function_privilege(
    'anon',
    'public.refund_sale(uuid,uuid,jsonb,public.nova_payment_method,text,text)',
    'EXECUTE'
  )
    as anonymous_can_refund;