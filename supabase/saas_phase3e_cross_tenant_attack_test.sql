-- ============================================================
-- NOVA POS
-- SaaS Phase 3E — Cross-tenant attack test
-- ============================================================
--
-- PURPOSE
--   Prove that Business A cannot read or mutate Business B
--   and Business B cannot read or mutate Business A.
--
-- SAFE TEST DESIGN
--   • creates temporary fixture rows inside both businesses
--   • simulates each owner with the authenticated Postgres role
--   • attacks the opposite tenant through RLS + SECURITY DEFINER RPCs
--   • removes every fixture before COMMIT
--   • never deletes either real business
--
-- BUSINESS SELECTION
--   A = business named "Diper House"
--   B = business named "NOVA Isolation Test"
--
--   If B has another name, this script will use it automatically
--   only when it is the ONLY other business in the project.
-- ============================================================

begin;


create temporary table
nova_phase3e_results (

  test text not null,

  status text not null,

  detail text not null

)
on commit preserve rows;


grant
  select,
  insert

on nova_phase3e_results

to authenticated;



-- ============================================================
-- 1. DISCOVER TENANTS + OWNERS
-- ============================================================

do $$

declare

  v_business_a uuid;

  v_business_b uuid;

  v_owner_a uuid;

  v_owner_b uuid;

  v_other_businesses uuid[];

begin

  select
    business.id,
    business.owner_user_id

  into
    v_business_a,
    v_owner_a

  from public.businesses
    as business

  where
    lower(
      btrim(
        business.name
      )
    ) =
      'diper house'

  order by
    business.created_at asc

  limit 1;


  if
    v_business_a is null
  then

    raise exception
      'Phase 3E could not find Business A named "Diper House".';

  end if;


  select
    business.id,
    business.owner_user_id

  into
    v_business_b,
    v_owner_b

  from public.businesses
    as business

  where
    lower(
      btrim(
        business.name
      )
    ) =
      'nova isolation test'

    and
    business.id <>
      v_business_a

  order by
    business.created_at desc

  limit 1;


  if
    v_business_b is null
  then

    select
      array_agg(
        business.id
        order by
          business.created_at desc
      )

    into
      v_other_businesses

    from public.businesses
      as business

    where
      business.id <>
        v_business_a;


    if
      coalesce(
        cardinality(
          v_other_businesses
        ),
        0
      ) <>
        1
    then

      raise exception
        'Phase 3E could not safely auto-select Tenant B. Rename the temporary business to "NOVA Isolation Test" and run again.';

    end if;


    v_business_b :=
      v_other_businesses[1];


    select
      business.owner_user_id

    into
      v_owner_b

    from public.businesses
      as business

    where
      business.id =
        v_business_b;

  end if;


  if
    v_owner_a is null
    or
    v_owner_b is null
  then

    raise exception
      'Both test businesses must have owner accounts.';

  end if;


  if
    v_owner_a =
      v_owner_b
  then

    raise exception
      'Tenant A and Tenant B must use different owner accounts.';

  end if;


  perform set_config(
    'nova.phase3e.business_a',
    v_business_a::text,
    true
  );


  perform set_config(
    'nova.phase3e.business_b',
    v_business_b::text,
    true
  );


  perform set_config(
    'nova.phase3e.owner_a',
    v_owner_a::text,
    true
  );


  perform set_config(
    'nova.phase3e.owner_b',
    v_owner_b::text,
    true
  );


  insert into nova_phase3e_results
  values (
    '00 tenant discovery',
    'PASS',
    'Two distinct businesses and owners were resolved.'
  );

end;

$$;



-- ============================================================
-- 2. RESOLVE / CREATE TEST LOCATIONS
-- ============================================================

do $$

declare

  v_business_a uuid :=
    current_setting(
      'nova.phase3e.business_a'
    )::uuid;

  v_business_b uuid :=
    current_setting(
      'nova.phase3e.business_b'
    )::uuid;

  v_location_a uuid;

  v_location_b uuid;

begin

  select
    location.id

  into
    v_location_a

  from public.inventory_locations
    as location

  where
    location.business_id =
      v_business_a

  order by
    location.is_default desc,
    location.created_at asc

  limit 1;


  if
    v_location_a is null
  then

    insert into public.inventory_locations (
      business_id,
      name,
      code,
      is_default,
      is_active
    )

    values (
      v_business_a,
      'Phase 3E Test',
      'P3EA-' ||
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          8
        ),
      false,
      true
    )

    returning id
    into v_location_a;


    perform set_config(
      'nova.phase3e.created_location_a',
      v_location_a::text,
      true
    );

  end if;


  select
    location.id

  into
    v_location_b

  from public.inventory_locations
    as location

  where
    location.business_id =
      v_business_b

  order by
    location.is_default desc,
    location.created_at asc

  limit 1;


  if
    v_location_b is null
  then

    insert into public.inventory_locations (
      business_id,
      name,
      code,
      is_default,
      is_active
    )

    values (
      v_business_b,
      'Phase 3E Test',
      'P3EB-' ||
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          8
        ),
      false,
      true
    )

    returning id
    into v_location_b;


    perform set_config(
      'nova.phase3e.created_location_b',
      v_location_b::text,
      true
    );

  end if;


  perform set_config(
    'nova.phase3e.location_a',
    v_location_a::text,
    true
  );


  perform set_config(
    'nova.phase3e.location_b',
    v_location_b::text,
    true
  );

end;

$$;



-- ============================================================
-- 3. CREATE ROLLBACK-SAFE FIXTURES
-- ============================================================

do $$

declare

  v_business_a uuid :=
    current_setting(
      'nova.phase3e.business_a'
    )::uuid;

  v_business_b uuid :=
    current_setting(
      'nova.phase3e.business_b'
    )::uuid;

  v_owner_a uuid :=
    current_setting(
      'nova.phase3e.owner_a'
    )::uuid;

  v_owner_b uuid :=
    current_setting(
      'nova.phase3e.owner_b'
    )::uuid;

  v_location_a uuid :=
    current_setting(
      'nova.phase3e.location_a'
    )::uuid;

  v_location_b uuid :=
    current_setting(
      'nova.phase3e.location_b'
    )::uuid;

  v_product_a uuid :=
    gen_random_uuid();

  v_product_b uuid :=
    gen_random_uuid();

  v_variant_a uuid :=
    gen_random_uuid();

  v_variant_b uuid :=
    gen_random_uuid();

  v_customer_a uuid :=
    gen_random_uuid();

  v_customer_b uuid :=
    gen_random_uuid();

  v_expense_a uuid :=
    gen_random_uuid();

  v_expense_b uuid :=
    gen_random_uuid();

  v_sale_a uuid :=
    gen_random_uuid();

  v_sale_b uuid :=
    gen_random_uuid();

  v_scanner_a uuid :=
    gen_random_uuid();

  v_scanner_b uuid :=
    gen_random_uuid();

  v_storage_a_product text;

  v_storage_b_product text;

  v_storage_a_receipt text;

  v_storage_b_receipt text;

  v_sequence_a bigint;

  v_sequence_b bigint;

begin

  perform set_config(
    'nova.phase3e.product_a',
    v_product_a::text,
    true
  );

  perform set_config(
    'nova.phase3e.product_b',
    v_product_b::text,
    true
  );

  perform set_config(
    'nova.phase3e.variant_a',
    v_variant_a::text,
    true
  );

  perform set_config(
    'nova.phase3e.variant_b',
    v_variant_b::text,
    true
  );

  perform set_config(
    'nova.phase3e.customer_a',
    v_customer_a::text,
    true
  );

  perform set_config(
    'nova.phase3e.customer_b',
    v_customer_b::text,
    true
  );

  perform set_config(
    'nova.phase3e.expense_a',
    v_expense_a::text,
    true
  );

  perform set_config(
    'nova.phase3e.expense_b',
    v_expense_b::text,
    true
  );

  perform set_config(
    'nova.phase3e.sale_a',
    v_sale_a::text,
    true
  );

  perform set_config(
    'nova.phase3e.sale_b',
    v_sale_b::text,
    true
  );

  perform set_config(
    'nova.phase3e.scanner_a',
    v_scanner_a::text,
    true
  );

  perform set_config(
    'nova.phase3e.scanner_b',
    v_scanner_b::text,
    true
  );


  insert into public.products (
    id,
    business_id,
    name,
    description,
    status
  )
  values
    (
      v_product_a,
      v_business_a,
      'PHASE3E-A',
      'Temporary tenant isolation fixture',
      'active'::public.nova_product_status
    ),
    (
      v_product_b,
      v_business_b,
      'PHASE3E-B',
      'Temporary tenant isolation fixture',
      'active'::public.nova_product_status
    );


  insert into public.product_variants (
    id,
    business_id,
    product_id,
    name,
    sku,
    price,
    cost,
    is_active
  )
  values
    (
      v_variant_a,
      v_business_a,
      v_product_a,
      'Standard',
      'P3EA-' ||
        substr(
          replace(
            v_variant_a::text,
            '-',
            ''
          ),
          1,
          12
        ),
      10,
      5,
      true
    ),
    (
      v_variant_b,
      v_business_b,
      v_product_b,
      'Standard',
      'P3EB-' ||
        substr(
          replace(
            v_variant_b::text,
            '-',
            ''
          ),
          1,
          12
        ),
      10,
      5,
      true
    );


  insert into public.inventory_levels (
    business_id,
    location_id,
    variant_id,
    on_hand,
    low_stock_threshold
  )
  values
    (
      v_business_a,
      v_location_a,
      v_variant_a,
      7,
      2
    ),
    (
      v_business_b,
      v_location_b,
      v_variant_b,
      7,
      2
    );


  insert into public.customers (
    id,
    business_id,
    name,
    phone,
    phone_normalized,
    notes,
    is_active
  )
  values
    (
      v_customer_a,
      v_business_a,
      'PHASE3E Customer A',
      '+999000000001',
      '+999000000001',
      'Temporary tenant isolation fixture',
      true
    ),
    (
      v_customer_b,
      v_business_b,
      'PHASE3E Customer B',
      '+999000000002',
      '+999000000002',
      'Temporary tenant isolation fixture',
      true
    );


  insert into public.expenses (
    id,
    business_id,
    expense_date,
    category,
    title,
    amount,
    payment_method,
    note,
    created_by_user_id
  )
  values
    (
      v_expense_a,
      v_business_a,
      current_date,
      'other',
      'PHASE3E Expense A',
      1,
      'cash'::public.nova_payment_method,
      'Temporary tenant isolation fixture',
      v_owner_a
    ),
    (
      v_expense_b,
      v_business_b,
      current_date,
      'other',
      'PHASE3E Expense B',
      1,
      'cash'::public.nova_payment_method,
      'Temporary tenant isolation fixture',
      v_owner_b
    );


  select
    coalesce(
      max(
        sale.receipt_sequence
      ),
      0
    ) +
    1000000

  into
    v_sequence_a

  from public.sales
    as sale

  where
    sale.business_id =
      v_business_a;


  select
    coalesce(
      max(
        sale.receipt_sequence
      ),
      0
    ) +
    1000000

  into
    v_sequence_b

  from public.sales
    as sale

  where
    sale.business_id =
      v_business_b;


  insert into public.sales (
    id,
    business_id,
    location_id,
    receipt_sequence,
    receipt_number,
    currency_code,
    cashier_user_id,
    subtotal,
    discount_total,
    tax_total,
    total,
    item_quantity_total,
    note,
    checkout_key
  )
  values
    (
      v_sale_a,
      v_business_a,
      v_location_a,
      v_sequence_a,
      'P3E-A-' ||
        substr(
          replace(
            v_sale_a::text,
            '-',
            ''
          ),
          1,
          12
        ),
      'LKR',
      v_owner_a,
      10,
      0,
      0,
      10,
      1,
      'Temporary tenant isolation fixture',
      gen_random_uuid()
    ),
    (
      v_sale_b,
      v_business_b,
      v_location_b,
      v_sequence_b,
      'P3E-B-' ||
        substr(
          replace(
            v_sale_b::text,
            '-',
            ''
          ),
          1,
          12
        ),
      'LKR',
      v_owner_b,
      10,
      0,
      0,
      10,
      1,
      'Temporary tenant isolation fixture',
      gen_random_uuid()
    );


  insert into public.remote_scanner_sessions (
    id,
    business_id,
    created_by,
    status,
    expires_at
  )
  values
    (
      v_scanner_a,
      v_business_a,
      v_owner_a,
      'active',
      now() +
        interval '8 hours'
    ),
    (
      v_scanner_b,
      v_business_b,
      v_owner_b,
      'active',
      now() +
        interval '8 hours'
    );


  v_storage_a_product :=
    v_business_a::text
    ||
    '/phase3e-'
    ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    )
    ||
    '.webp';


  v_storage_b_product :=
    v_business_b::text
    ||
    '/phase3e-'
    ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    )
    ||
    '.webp';


  v_storage_a_receipt :=
    v_business_a::text
    ||
    '/phase3e-'
    ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    )
    ||
    '.webp';


  v_storage_b_receipt :=
    v_business_b::text
    ||
    '/phase3e-'
    ||
    replace(
      gen_random_uuid()::text,
      '-',
      ''
    )
    ||
    '.webp';


  perform set_config(
    'nova.phase3e.storage_a_product',
    v_storage_a_product,
    true
  );

  perform set_config(
    'nova.phase3e.storage_b_product',
    v_storage_b_product,
    true
  );

  perform set_config(
    'nova.phase3e.storage_a_receipt',
    v_storage_a_receipt,
    true
  );

  perform set_config(
    'nova.phase3e.storage_b_receipt',
    v_storage_b_receipt,
    true
  );


  insert into storage.objects (
    bucket_id,
    name
  )
  values
    (
      'product-images',
      v_storage_a_product
    ),
    (
      'product-images',
      v_storage_b_product
    ),
    (
      'receipt-assets',
      v_storage_a_receipt
    ),
    (
      'receipt-assets',
      v_storage_b_receipt
    );


  insert into nova_phase3e_results
  values (
    '01 fixtures',
    'PASS',
    'Temporary A/B product, inventory, customer, sale, expense, scanner and storage fixtures created.'
  );

end;

$$;



-- ============================================================
-- 4. STRUCTURAL LOCKDOWN CHECKS
-- ============================================================

do $$

declare

  v_public_count integer;

begin

  select
    count(*)::integer

  into
    v_public_count

  from storage.buckets
    as bucket

  where
    bucket.id in (
      'product-images',
      'receipt-assets'
    )

    and
    bucket.public is true;


  insert into nova_phase3e_results
  values (
    '02 private asset buckets',
    case
      when v_public_count = 0
      then 'PASS'
      else 'FAIL'
    end,
    case
      when v_public_count = 0
      then 'Both tenant asset buckets are private.'
      else 'At least one tenant asset bucket is still public.'
    end
  );


  insert into nova_phase3e_results
  values (
    '03 scanner direct table access',
    case
      when
        not has_table_privilege(
          'authenticated',
          'public.remote_scanner_sessions',
          'SELECT'
        )
        and
        not has_table_privilege(
          'authenticated',
          'public.remote_scanner_sessions',
          'INSERT'
        )
        and
        not has_table_privilege(
          'authenticated',
          'public.remote_scanner_sessions',
          'UPDATE'
        )
      then 'PASS'
      else 'FAIL'
    end,
    'Authenticated browser role must use scanner RPCs instead of direct table access.'
  );

end;

$$;



-- ============================================================
-- 5. BUSINESS A ATTACKS BUSINESS B
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  current_setting(
    'nova.phase3e.owner_a'
  ),
  true
);


select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);


select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting(
      'nova.phase3e.owner_a'
    ),
    'role',
    'authenticated'
  )::text,
  true
);


set local role authenticated;


do $$

declare

  v_business_a uuid :=
    current_setting(
      'nova.phase3e.business_a'
    )::uuid;

  v_business_b uuid :=
    current_setting(
      'nova.phase3e.business_b'
    )::uuid;

  v_count integer;

  v_row_count integer;

  v_resolved uuid;

begin

  select
    current_business.id

  into
    v_resolved

  from public.get_my_current_business()
    as current_business;


  insert into nova_phase3e_results
  values (
    'A01 current tenant resolver',
    case
      when v_resolved = v_business_a
      then 'PASS'
      else 'FAIL'
    end,
    'Business A owner must resolve only to Business A.'
  );


  select count(*)::integer
  into v_count
  from public.businesses
  where id = v_business_b;

  insert into nova_phase3e_results
  values (
    'A02 business read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B business row.'
  );


  select count(*)::integer
  into v_count
  from public.products
  where id =
    current_setting(
      'nova.phase3e.product_b'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'A03 product read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B product.'
  );


  select count(*)::integer
  into v_count
  from public.product_variants
  where id =
    current_setting(
      'nova.phase3e.variant_b'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'A04 variant read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B variant.'
  );


  select count(*)::integer
  into v_count
  from public.inventory_levels
  where business_id =
    v_business_b;

  insert into nova_phase3e_results
  values (
    'A05 inventory read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B inventory.'
  );


  select count(*)::integer
  into v_count
  from public.customers
  where id =
    current_setting(
      'nova.phase3e.customer_b'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'A06 customer read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B customer.'
  );


  select count(*)::integer
  into v_count
  from public.sales
  where id =
    current_setting(
      'nova.phase3e.sale_b'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'A07 sales read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B sale.'
  );


  select count(*)::integer
  into v_count
  from public.expenses
  where id =
    current_setting(
      'nova.phase3e.expense_b'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'A08 expense read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B expense.'
  );


  select count(*)::integer
  into v_count
  from public.receipt_settings
  where business_id =
    v_business_b;

  insert into nova_phase3e_results
  values (
    'A09 receipt settings isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B receipt settings.'
  );


  select count(*)::integer
  into v_count
  from public.report_settings
  where business_id =
    v_business_b;

  insert into nova_phase3e_results
  values (
    'A10 report settings isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business A must not read Business B report settings.'
  );


  begin

    select count(*)::integer
    into v_count
    from storage.objects
    where
      (
        bucket_id =
          'product-images'

        and

        name =
          current_setting(
            'nova.phase3e.storage_b_product'
          )
      )

      or

      (
        bucket_id =
          'receipt-assets'

        and

        name =
          current_setting(
            'nova.phase3e.storage_b_receipt'
          )
      );


    insert into nova_phase3e_results
    values (
      'A11 storage object isolation',
      case when v_count = 0 then 'PASS' else 'FAIL' end,
      'Business A must not read Business B private storage metadata.'
    );

  exception

    when insufficient_privilege then

      insert into nova_phase3e_results
      values (
        'A11 storage object isolation',
        'PASS',
        'Direct storage metadata read is denied to the authenticated role.'
      );

  end;


  begin

    update public.products

    set
      name =
        name

    where
      id =
        current_setting(
          'nova.phase3e.product_b'
        )::uuid;


    get diagnostics
      v_row_count =
        row_count;


    insert into nova_phase3e_results
    values (
      'A12 cross-tenant product update',
      case when v_row_count = 0 then 'PASS' else 'FAIL' end,
      'Business A must not update Business B product even when the UUID is known.'
    );

  exception

    when insufficient_privilege then

      insert into nova_phase3e_results
      values (
        'A12 cross-tenant product update',
        'PASS',
        'Cross-tenant product update was rejected.'
      );

  end;


  begin

    insert into public.categories (
      business_id,
      name,
      slug
    )
    values (
      v_business_b,
      'PHASE3E forged category',
      'phase3e-forged-' ||
        substr(
          replace(
            gen_random_uuid()::text,
            '-',
            ''
          ),
          1,
          12
        )
    );


    insert into nova_phase3e_results
    values (
      'A13 forged business_id insert',
      'FAIL',
      'Business A was able to insert a row owned by Business B.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A13 forged business_id insert',
        'PASS',
        'RLS rejected a forged Business B business_id.'
      );

  end;

end;

$$;



-- ============================================================
-- 6. BUSINESS A ATTACKS BUSINESS B SECURITY-DEFINER RPCS
-- ============================================================

do $$

begin

  begin

    perform public.list_customers(
      current_setting(
        'nova.phase3e.business_b'
      )::uuid,
      '',
      10
    );


    insert into nova_phase3e_results
    values (
      'A14 customer RPC tenant validation',
      'FAIL',
      'list_customers accepted Business B from Business A.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A14 customer RPC tenant validation',
        'PASS',
        'list_customers rejected Business B.'
      );

  end;


  begin

    perform public.get_customer_detail(
      current_setting(
        'nova.phase3e.business_b'
      )::uuid,
      current_setting(
        'nova.phase3e.customer_b'
      )::uuid
    );


    insert into nova_phase3e_results
    values (
      'A15 customer detail RPC tenant validation',
      'FAIL',
      'get_customer_detail accepted Business B from Business A.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A15 customer detail RPC tenant validation',
        'PASS',
        'get_customer_detail rejected Business B.'
      );

  end;


  begin

    perform public.get_expense_report(
      current_setting(
        'nova.phase3e.business_b'
      )::uuid,
      current_date -
        1,
      current_date
    );


    insert into nova_phase3e_results
    values (
      'A16 expense RPC tenant validation',
      'FAIL',
      'get_expense_report accepted Business B from Business A.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A16 expense RPC tenant validation',
        'PASS',
        'get_expense_report rejected Business B.'
      );

  end;


  begin

    perform public.remove_product(
      current_setting(
        'nova.phase3e.product_b'
      )::uuid
    );


    insert into nova_phase3e_results
    values (
      'A17 product mutation RPC tenant validation',
      'FAIL',
      'remove_product accepted a Business B product from Business A.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A17 product mutation RPC tenant validation',
        'PASS',
        'remove_product rejected the Business B product UUID.'
      );

  end;


  begin

    perform public.close_remote_scanner_session(
      current_setting(
        'nova.phase3e.scanner_b'
      )::uuid
    );


    insert into nova_phase3e_results
    values (
      'A18 scanner RPC tenant validation',
      'FAIL',
      'Business A closed Business B scanner session.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A18 scanner RPC tenant validation',
        'PASS',
        'Scanner close RPC rejected Business B session UUID.'
      );

  end;


  begin

    perform public.complete_sale(
      current_setting(
        'nova.phase3e.business_b'
      )::uuid,
      gen_random_uuid(),
      '[]'::jsonb,
      'cash'::public.nova_payment_method
    );


    insert into nova_phase3e_results
    values (
      'A19 checkout RPC tenant validation',
      'FAIL',
      'complete_sale accepted Business B from Business A.'
    );

  exception

    when sqlstate '42501' then

      insert into nova_phase3e_results
      values (
        'A19 checkout RPC tenant validation',
        'PASS',
        'complete_sale rejected Business B before processing checkout.'
      );

    when others then

      insert into nova_phase3e_results
      values (
        'A19 checkout RPC tenant validation',
        'FAIL',
        'Checkout reached a later validation stage instead of rejecting tenant access. SQLSTATE='
        ||
        sqlstate
      );

  end;

end;

$$;



-- ============================================================
-- 7. BUSINESS B ATTACKS BUSINESS A
-- ============================================================

reset role;


select set_config(
  'request.jwt.claim.sub',
  current_setting(
    'nova.phase3e.owner_b'
  ),
  true
);


select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);


select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',
    current_setting(
      'nova.phase3e.owner_b'
    ),
    'role',
    'authenticated'
  )::text,
  true
);


set local role authenticated;


do $$

declare

  v_business_a uuid :=
    current_setting(
      'nova.phase3e.business_a'
    )::uuid;

  v_business_b uuid :=
    current_setting(
      'nova.phase3e.business_b'
    )::uuid;

  v_count integer;

  v_row_count integer;

  v_resolved uuid;

begin

  select
    current_business.id

  into
    v_resolved

  from public.get_my_current_business()
    as current_business;


  insert into nova_phase3e_results
  values (
    'B01 current tenant resolver',
    case
      when v_resolved = v_business_b
      then 'PASS'
      else 'FAIL'
    end,
    'Business B owner must resolve only to Business B.'
  );


  select count(*)::integer
  into v_count
  from public.products
  where id =
    current_setting(
      'nova.phase3e.product_a'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'B02 product read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business B must not read Business A product.'
  );


  select count(*)::integer
  into v_count
  from public.customers
  where id =
    current_setting(
      'nova.phase3e.customer_a'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'B03 customer read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business B must not read Business A customer.'
  );


  select count(*)::integer
  into v_count
  from public.sales
  where id =
    current_setting(
      'nova.phase3e.sale_a'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'B04 sales read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business B must not read Business A sale.'
  );


  select count(*)::integer
  into v_count
  from public.expenses
  where id =
    current_setting(
      'nova.phase3e.expense_a'
    )::uuid;

  insert into nova_phase3e_results
  values (
    'B05 expense read isolation',
    case when v_count = 0 then 'PASS' else 'FAIL' end,
    'Business B must not read Business A expense.'
  );


  begin

    select count(*)::integer
    into v_count
    from storage.objects
    where
      (
        bucket_id =
          'product-images'

        and

        name =
          current_setting(
            'nova.phase3e.storage_a_product'
          )
      )

      or

      (
        bucket_id =
          'receipt-assets'

        and

        name =
          current_setting(
            'nova.phase3e.storage_a_receipt'
          )
      );


    insert into nova_phase3e_results
    values (
      'B06 storage object isolation',
      case when v_count = 0 then 'PASS' else 'FAIL' end,
      'Business B must not read Business A private storage metadata.'
    );

  exception

    when insufficient_privilege then

      insert into nova_phase3e_results
      values (
        'B06 storage object isolation',
        'PASS',
        'Direct storage metadata read is denied to the authenticated role.'
      );

  end;


  begin

    update public.products

    set
      name =
        name

    where
      id =
        current_setting(
          'nova.phase3e.product_a'
        )::uuid;


    get diagnostics
      v_row_count =
        row_count;


    insert into nova_phase3e_results
    values (
      'B07 cross-tenant product update',
      case when v_row_count = 0 then 'PASS' else 'FAIL' end,
      'Business B must not update Business A product even when the UUID is known.'
    );

  exception

    when insufficient_privilege then

      insert into nova_phase3e_results
      values (
        'B07 cross-tenant product update',
        'PASS',
        'Cross-tenant product update was rejected.'
      );

  end;

end;

$$;



-- ============================================================
-- 8. CLEAN UP ALL FIXTURES
-- ============================================================

reset role;


delete from storage.objects
where
  (
    bucket_id =
      'product-images'

    and

    name in (
      current_setting(
        'nova.phase3e.storage_a_product'
      ),
      current_setting(
        'nova.phase3e.storage_b_product'
      )
    )
  )

  or

  (
    bucket_id =
      'receipt-assets'

    and

    name in (
      current_setting(
        'nova.phase3e.storage_a_receipt'
      ),
      current_setting(
        'nova.phase3e.storage_b_receipt'
      )
    )
  );


delete from public.remote_scanner_sessions
where id in (
  current_setting(
    'nova.phase3e.scanner_a'
  )::uuid,
  current_setting(
    'nova.phase3e.scanner_b'
  )::uuid
);


delete from public.sales
where id in (
  current_setting(
    'nova.phase3e.sale_a'
  )::uuid,
  current_setting(
    'nova.phase3e.sale_b'
  )::uuid
);


delete from public.expenses
where id in (
  current_setting(
    'nova.phase3e.expense_a'
  )::uuid,
  current_setting(
    'nova.phase3e.expense_b'
  )::uuid
);


delete from public.customers
where id in (
  current_setting(
    'nova.phase3e.customer_a'
  )::uuid,
  current_setting(
    'nova.phase3e.customer_b'
  )::uuid
);


delete from public.inventory_levels
where variant_id in (
  current_setting(
    'nova.phase3e.variant_a'
  )::uuid,
  current_setting(
    'nova.phase3e.variant_b'
  )::uuid
);


delete from public.product_variants
where id in (
  current_setting(
    'nova.phase3e.variant_a'
  )::uuid,
  current_setting(
    'nova.phase3e.variant_b'
  )::uuid
);


delete from public.products
where id in (
  current_setting(
    'nova.phase3e.product_a'
  )::uuid,
  current_setting(
    'nova.phase3e.product_b'
  )::uuid
);


-- Remove fallback locations only when this script had to create them.

delete from public.inventory_locations
where
  id =
    nullif(
      current_setting(
        'nova.phase3e.created_location_a',
        true
      ),
      ''
    )::uuid

  or

  id =
    nullif(
      current_setting(
        'nova.phase3e.created_location_b',
        true
      ),
      ''
    )::uuid;


insert into nova_phase3e_results
values (
  '99 cleanup',
  'PASS',
  'All temporary Phase 3E fixture rows were removed.'
);



-- ============================================================
-- 9. SUMMARY
-- ============================================================

insert into nova_phase3e_results

select
  'SUMMARY',
  case
    when count(*) filter (
      where status =
        'FAIL'
    ) = 0
    then 'PASS'
    else 'FAIL'
  end,
  (
    count(*) filter (
      where status =
        'PASS'
    )
  )::text
  ||
  ' checks passed; '
  ||
  (
    count(*) filter (
      where status =
        'FAIL'
    )
  )::text
  ||
  ' checks failed.'

from nova_phase3e_results;


commit;


select
  test,
  status,
  detail

from nova_phase3e_results

order by
  case
    when test =
      'SUMMARY'
    then 1
    else 0
  end,
  test;
