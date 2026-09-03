-- ============================================================
-- NOVA POS
-- PHASE 4I — CUSTOMERS + LOYALTY
-- ============================================================


-- ============================================================
-- LOYALTY TRANSACTION TYPE
-- ============================================================

do $$

begin

  create type
    public.nova_loyalty_transaction_type
  as enum (

    'earn',

    'redeem',

    'refund_reversal',

    'manual_adjustment'

  );

exception

  when duplicate_object then
    null;

end;

$$;


-- ============================================================
-- PHONE NORMALIZER
--
-- NOVA currently targets Sri Lankan retail businesses.
--
-- These all match:
--
-- 0771234567
-- +94 77 123 4567
-- 94771234567
--
-- canonical:
--
-- 771234567
-- ============================================================

create or replace function
private.normalize_customer_phone(
  p_phone text
)

returns text

language plpgsql

immutable

set search_path = ''

as $$

declare

  v_digits text;

begin

  v_digits :=
    pg_catalog.regexp_replace(
      coalesce(
        p_phone,
        ''
      ),
      '[^0-9]',
      '',
      'g'
    );


  if
    v_digits = ''
  then

    return '';

  end if;


  if
    length(
      v_digits
    ) = 10

    and
    left(
      v_digits,
      1
    ) = '0'
  then

    return right(
      v_digits,
      9
    );

  end if;


  if
    length(
      v_digits
    ) = 11

    and
    left(
      v_digits,
      2
    ) = '94'
  then

    return right(
      v_digits,
      9
    );

  end if;


  return v_digits;

end;

$$;


-- ============================================================
-- CUSTOMERS
-- ============================================================

create table if not exists
public.customers (

  id uuid
    primary key
    default gen_random_uuid(),


  business_id uuid
    not null
    references public.businesses(id)
    on delete cascade,


  name text
    not null,


  phone text
    not null,


  phone_normalized text
    not null,


  email text,


  default_discount_percent numeric(5,2)
    not null
    default 0
    check (
      default_discount_percent >= 0

      and

      default_discount_percent <= 100
    ),


  notes text
    not null
    default '',


  is_active boolean
    not null
    default true,


  created_at timestamptz
    not null
    default now(),


  updated_at timestamptz
    not null
    default now(),


  constraint customers_name_not_blank
    check (
      btrim(name) <> ''
    ),


  constraint customers_phone_not_blank
    check (
      btrim(phone_normalized) <> ''
    ),


  constraint customers_id_business_unique
    unique (
      id,
      business_id
    ),


  constraint customers_phone_unique
    unique (
      business_id,
      phone_normalized
    )

);


create index if not exists
customers_business_name_idx

on public.customers (
  business_id,
  name
);


create index if not exists
customers_business_active_idx

on public.customers (
  business_id,
  is_active
);


-- ============================================================
-- CUSTOMER NORMALIZATION TRIGGER
-- ============================================================

create or replace function
private.prepare_customer_record()

returns trigger

language plpgsql

set search_path = ''

as $$

begin

  new.name :=
    btrim(
      new.name
    );


  new.phone :=
    btrim(
      new.phone
    );


  new.phone_normalized :=
    private.normalize_customer_phone(
      new.phone
    );


  if
    new.phone_normalized = ''
  then

    raise exception
      'Customer phone number is required';

  end if;


  if
    new.email is not null
  then

    new.email :=
      nullif(
        lower(
          btrim(
            new.email
          )
        ),
        ''
      );

  end if;


  new.notes :=
    coalesce(
      new.notes,
      ''
    );


  new.updated_at :=
    now();


  return new;

end;

$$;


drop trigger if exists
customers_prepare_record
on public.customers;


create trigger
customers_prepare_record

before insert
or update

on public.customers

for each row

execute function
private.prepare_customer_record();


-- ============================================================
-- LOYALTY SETTINGS
-- ============================================================

create table if not exists
public.loyalty_settings (

  business_id uuid
    primary key
    references public.businesses(id)
    on delete cascade,


  enabled boolean
    not null
    default false,


  spend_amount_per_earn numeric(12,2)
    not null
    default 100
    check (
      spend_amount_per_earn > 0
    ),


  points_earned integer
    not null
    default 1
    check (
      points_earned > 0
    ),


  redeem_points integer
    not null
    default 100
    check (
      redeem_points > 0
    ),


  redeem_value numeric(12,2)
    not null
    default 100
    check (
      redeem_value > 0
    ),


  minimum_redeem_points integer
    not null
    default 100
    check (
      minimum_redeem_points >= 0
    ),


  maximum_discount_percent numeric(5,2)
    not null
    default 50
    check (
      maximum_discount_percent >= 0

      and

      maximum_discount_percent <= 100
    ),


  allow_cashier_redeem boolean
    not null
    default true,


  created_at timestamptz
    not null
    default now(),


  updated_at timestamptz
    not null
    default now()

);


insert into public.loyalty_settings (
  business_id
)

select
  business_record.id

from public.businesses
  as business_record

on conflict (
  business_id
)

do nothing;


-- ============================================================
-- AUTO-CREATE SETTINGS FOR NEW BUSINESS
-- ============================================================

create or replace function
private.create_business_loyalty_settings()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  insert into public.loyalty_settings (
    business_id
  )

  values (
    new.id
  )

  on conflict (
    business_id
  )

  do nothing;


  return new;

end;

$$;


drop trigger if exists
businesses_create_loyalty_settings
on public.businesses;


create trigger
businesses_create_loyalty_settings

after insert

on public.businesses

for each row

execute function
private.create_business_loyalty_settings();


-- ============================================================
-- LOYALTY TRANSACTIONS
--
-- Never store only:
--
-- customers.points = 500
--
-- The ledger is the source of truth.
-- Balance = SUM(points_delta)
-- ============================================================

create table if not exists
public.loyalty_transactions (

  id uuid
    primary key
    default gen_random_uuid(),


  business_id uuid
    not null
    references public.businesses(id)
    on delete cascade,


  customer_id uuid
    not null,


  transaction_type
    public.nova_loyalty_transaction_type
    not null,


  points_delta integer
    not null
    check (
      points_delta <> 0
    ),


  monetary_value numeric(12,2)
    not null
    default 0
    check (
      monetary_value >= 0
    ),


  sale_id uuid,


  refund_id uuid,


  description text
    not null
    default '',


  actor_user_id uuid
    references auth.users(id)
    on delete set null,


  created_at timestamptz
    not null
    default now(),


  constraint loyalty_transactions_customer_fk

    foreign key (
      customer_id,
      business_id
    )

    references public.customers(
      id,
      business_id
    ),


  constraint loyalty_transactions_sale_fk

    foreign key (
      sale_id,
      business_id
    )

    references public.sales(
      id,
      business_id
    ),


  constraint loyalty_transactions_refund_fk

    foreign key (
      refund_id,
      business_id
    )

    references public.sale_refunds(
      id,
      business_id
    )

);


create index if not exists
loyalty_transactions_customer_idx

on public.loyalty_transactions (
  business_id,
  customer_id,
  created_at desc
);


create index if not exists
loyalty_transactions_sale_idx

on public.loyalty_transactions (
  sale_id
);


create index if not exists
loyalty_transactions_refund_idx

on public.loyalty_transactions (
  refund_id
);


-- ============================================================
-- IDEMPOTENCY
--
-- One customer may:
--
-- earn points on a sale
-- AND
-- redeem points on the same sale
--
-- Therefore earn/redeem need separate uniqueness rules.
-- ============================================================

create unique index if not exists
loyalty_one_earn_per_sale_idx

on public.loyalty_transactions (
  business_id,
  customer_id,
  sale_id
)

where

  transaction_type =
    'earn'::public.nova_loyalty_transaction_type

  and

  sale_id is not null;


create unique index if not exists
loyalty_one_redeem_per_sale_idx

on public.loyalty_transactions (
  business_id,
  customer_id,
  sale_id
)

where

  transaction_type =
    'redeem'::public.nova_loyalty_transaction_type

  and

  sale_id is not null;


create unique index if not exists
loyalty_one_reversal_per_refund_idx

on public.loyalty_transactions (
  business_id,
  customer_id,
  refund_id
)

where

  transaction_type =
    'refund_reversal'::public.nova_loyalty_transaction_type

  and

  refund_id is not null;


-- ============================================================
-- LINK SALES TO CUSTOMER
-- ============================================================

alter table
public.sales

add column if not exists
customer_id uuid;


do $$

begin

  if not exists (

    select
      1

    from pg_catalog.pg_constraint

    where
      conname =
        'sales_customer_business_fk'

      and
      conrelid =
        'public.sales'::regclass

  ) then

    alter table
    public.sales

    add constraint
    sales_customer_business_fk

    foreign key (
      customer_id,
      business_id
    )

    references public.customers(
      id,
      business_id
    );

  end if;

end;

$$;


create index if not exists
sales_customer_id_idx

on public.sales (
  business_id,
  customer_id,
  created_at desc
);


-- ============================================================
-- RLS
-- ============================================================

alter table
public.customers
enable row level security;


alter table
public.loyalty_settings
enable row level security;


alter table
public.loyalty_transactions
enable row level security;


-- ============================================================
-- CUSTOMERS SELECT
-- ============================================================

drop policy if exists
customers_member_select
on public.customers;


create policy
customers_member_select

on public.customers

for select

to authenticated

using (
  private.is_business_member(
    business_id
  )
);


-- ============================================================
-- LOYALTY SETTINGS SELECT
-- ============================================================

drop policy if exists
loyalty_settings_member_select
on public.loyalty_settings;


create policy
loyalty_settings_member_select

on public.loyalty_settings

for select

to authenticated

using (
  private.is_business_member(
    business_id
  )
);


-- ============================================================
-- LOYALTY SETTINGS MANAGER UPDATE
-- ============================================================

drop policy if exists
loyalty_settings_manager_update
on public.loyalty_settings;


create policy
loyalty_settings_manager_update

on public.loyalty_settings

for update

to authenticated

using (
  private.is_business_manager(
    business_id
  )
)

with check (
  private.is_business_manager(
    business_id
  )
);


-- ============================================================
-- LOYALTY TRANSACTIONS SELECT
-- ============================================================

drop policy if exists
loyalty_transactions_member_select
on public.loyalty_transactions;


create policy
loyalty_transactions_member_select

on public.loyalty_transactions

for select

to authenticated

using (
  private.is_business_member(
    business_id
  )
);


-- ============================================================
-- PREVENT DIRECT LOYALTY LEDGER WRITES
-- ============================================================

revoke
insert,
update,
delete

on public.loyalty_transactions

from
authenticated,
anon;


-- ============================================================
-- CUSTOMER CREATE / UPDATE
--
-- Active staff can register a customer.
--
-- Only managers can assign a permanent discount.
-- ============================================================

create or replace function
public.save_customer(

  p_business_id uuid,

  p_customer_id uuid,

  p_name text,

  p_phone text,

  p_email text default null,

  p_default_discount_percent numeric default 0,

  p_notes text default '',

  p_is_active boolean default true

)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_customer_id uuid;


  v_discount numeric(5,2) :=
    greatest(
      0,
      least(
        coalesce(
          p_default_discount_percent,
          0
        ),
        100
      )
    );


begin

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  if
    btrim(
      coalesce(
        p_name,
        ''
      )
    ) = ''
  then

    raise exception
      'Customer name is required';

  end if;


  if
    private.normalize_customer_phone(
      p_phone
    ) = ''
  then

    raise exception
      'Customer phone number is required';

  end if;


  if
    v_discount > 0

    and

    not (
      select private.is_business_manager(
        p_business_id
      )
    )
  then

    raise exception
      'Manager access is required to assign customer discounts'

      using errcode =
        '42501';

  end if;


  if
    p_customer_id is null
  then

    insert into public.customers (

      business_id,

      name,

      phone,

      phone_normalized,

      email,

      default_discount_percent,

      notes,

      is_active

    )

    values (

      p_business_id,

      p_name,

      p_phone,

      private.normalize_customer_phone(
        p_phone
      ),

      p_email,

      v_discount,

      coalesce(
        p_notes,
        ''
      ),

      true

    )

    returning id
    into v_customer_id;


  else

    if not exists (

      select
        1

      from public.customers
        as customer_record

      where
        customer_record.id =
          p_customer_id

        and
        customer_record.business_id =
          p_business_id

    ) then

      raise exception
        'Customer not found';

    end if;


    update public.customers

    set

      name =
        p_name,

      phone =
        p_phone,

      email =
        p_email,

      default_discount_percent =
        v_discount,

      notes =
        coalesce(
          p_notes,
          ''
        ),

      is_active =
        coalesce(
          p_is_active,
          true
        )

    where
      id =
        p_customer_id

      and
      business_id =
        p_business_id

    returning id
    into v_customer_id;

  end if;


  return
    v_customer_id;


exception

  when unique_violation then

    raise exception
      'A customer with this phone number already exists';

end;

$$;


-- ============================================================
-- CUSTOMER LIST
-- ============================================================

create or replace function
public.list_customers(

  p_business_id uuid,

  p_search text default '',

  p_limit integer default 100

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_result jsonb :=
    '[]'::jsonb;


  v_limit integer :=
    greatest(
      1,
      least(
        coalesce(
          p_limit,
          100
        ),
        250
      )
    );


  v_search text :=
    lower(
      btrim(
        coalesce(
          p_search,
          ''
        )
      )
    );


begin

  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'id',
          summary.id,

          'name',
          summary.name,

          'phone',
          summary.phone,

          'email',
          summary.email,

          'defaultDiscountPercent',
          summary.default_discount_percent,

          'notes',
          summary.notes,

          'isActive',
          summary.is_active,

          'loyaltyPoints',
          summary.loyalty_points,

          'lifetimeSpend',
          summary.lifetime_spend,

          'visits',
          summary.visits,

          'lastPurchaseAt',
          summary.last_purchase_at,

          'createdAt',
          summary.created_at

        )

        order by

          summary.last_purchase_at desc nulls last,

          summary.created_at desc

      ),

      '[]'::jsonb

    )

  into
    v_result

  from (

    select

      customer_record.id,

      customer_record.name,

      customer_record.phone,

      customer_record.email,

      customer_record.default_discount_percent,

      customer_record.notes,

      customer_record.is_active,

      customer_record.created_at,


      coalesce(
        loyalty_summary.points,
        0
      )::bigint
        as loyalty_points,


      coalesce(
        sale_summary.lifetime_spend,
        0
      )::numeric(14,2)
        as lifetime_spend,


      coalesce(
        sale_summary.visits,
        0
      )::bigint
        as visits,


      sale_summary.last_purchase_at


    from public.customers
      as customer_record


    left join lateral (

      select

        sum(
          transaction_record.points_delta
        )::bigint
          as points

      from public.loyalty_transactions
        as transaction_record

      where
        transaction_record.business_id =
          customer_record.business_id

        and
        transaction_record.customer_id =
          customer_record.id

    ) as loyalty_summary

      on true


    left join lateral (

      select

        count(*) filter (
          where
            sale_record.status <>
              'voided'::public.nova_sale_status
        )::bigint
          as visits,


        sum(

          case

            when
              sale_record.status =
                'voided'::public.nova_sale_status

            then
              0

            else

              greatest(

                sale_record.total

                -

                coalesce(
                  refund_summary.refunded_amount,
                  0
                ),

                0

              )

          end

        )::numeric(14,2)
          as lifetime_spend,


        max(
          sale_record.created_at
        ) filter (
          where
            sale_record.status <>
              'voided'::public.nova_sale_status
        )
          as last_purchase_at


      from public.sales
        as sale_record


      left join lateral (

        select

          coalesce(
            sum(
              refund_record.amount
            ),
            0
          )::numeric(14,2)
            as refunded_amount

        from public.sale_refunds
          as refund_record

        where
          refund_record.business_id =
            sale_record.business_id

          and
          refund_record.sale_id =
            sale_record.id

      ) as refund_summary

        on true


      where
        sale_record.business_id =
          customer_record.business_id

        and
        sale_record.customer_id =
          customer_record.id

    ) as sale_summary

      on true


    where
      customer_record.business_id =
        p_business_id


      and (

        v_search = ''

        or

        lower(
          customer_record.name
        ) like
          '%' ||
          v_search ||
          '%'

        or

        lower(
          customer_record.phone
        ) like
          '%' ||
          v_search ||
          '%'

        or

        lower(
          coalesce(
            customer_record.email,
            ''
          )
        ) like
          '%' ||
          v_search ||
          '%'

        or

        customer_record.phone_normalized like
          '%' ||
          private.normalize_customer_phone(
            v_search
          ) ||
          '%'

      )


    order by

      sale_summary.last_purchase_at desc nulls last,

      customer_record.created_at desc


    limit
      v_limit

  ) as summary;


  return
    v_result;

end;

$$;


-- ============================================================
-- CUSTOMER DETAILS
-- ============================================================

create or replace function
public.get_customer_detail(

  p_business_id uuid,

  p_customer_id uuid

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_customer jsonb;


  v_sales jsonb :=
    '[]'::jsonb;


  v_loyalty jsonb :=
    '[]'::jsonb;


  v_points bigint :=
    0;


  v_lifetime_spend numeric(14,2) :=
    0;


  v_visits bigint :=
    0;


begin

  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  select

    jsonb_build_object(

      'id',
      customer_record.id,

      'name',
      customer_record.name,

      'phone',
      customer_record.phone,

      'email',
      customer_record.email,

      'defaultDiscountPercent',
      customer_record.default_discount_percent,

      'notes',
      customer_record.notes,

      'isActive',
      customer_record.is_active,

      'createdAt',
      customer_record.created_at,

      'updatedAt',
      customer_record.updated_at

    )

  into
    v_customer

  from public.customers
    as customer_record

  where
    customer_record.business_id =
      p_business_id

    and
    customer_record.id =
      p_customer_id;


  if
    v_customer is null
  then

    raise exception
      'Customer not found';

  end if;


  select

    coalesce(
      sum(
        transaction_record.points_delta
      ),
      0
    )::bigint

  into
    v_points

  from public.loyalty_transactions
    as transaction_record

  where
    transaction_record.business_id =
      p_business_id

    and
    transaction_record.customer_id =
      p_customer_id;


  select

    count(*) filter (
      where
        sale_record.status <>
          'voided'::public.nova_sale_status
    )::bigint,


    coalesce(

      sum(

        case

          when
            sale_record.status =
              'voided'::public.nova_sale_status

          then
            0

          else

            greatest(

              sale_record.total

              -

              coalesce(
                refund_summary.refunded_amount,
                0
              ),

              0

            )

        end

      ),

      0

    )::numeric(14,2)

  into

    v_visits,

    v_lifetime_spend

  from public.sales
    as sale_record


  left join lateral (

    select

      coalesce(
        sum(
          refund_record.amount
        ),
        0
      )::numeric(14,2)
        as refunded_amount

    from public.sale_refunds
      as refund_record

    where
      refund_record.business_id =
        sale_record.business_id

      and
      refund_record.sale_id =
        sale_record.id

  ) as refund_summary

    on true


  where
    sale_record.business_id =
      p_business_id

    and
    sale_record.customer_id =
      p_customer_id;


  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'id',
          recent.id,

          'receiptNumber',
          recent.receipt_number,

          'createdAt',
          recent.created_at,

          'status',
          recent.status,

          'originalTotal',
          recent.original_total,

          'netTotal',
          recent.net_total,

          'currencyCode',
          recent.currency_code

        )

        order by
          recent.created_at desc

      ),

      '[]'::jsonb

    )

  into
    v_sales

  from (

    select

      sale_record.id,

      sale_record.receipt_number,

      sale_record.created_at,

      sale_record.status::text
        as status,

      sale_record.total
        as original_total,

      sale_record.currency_code,


      case

        when
          sale_record.status =
            'voided'::public.nova_sale_status

        then
          0

        else

          greatest(

            sale_record.total

            -

            coalesce(
              refund_summary.refunded_amount,
              0
            ),

            0

          )

      end
        as net_total


    from public.sales
      as sale_record


    left join lateral (

      select

        coalesce(
          sum(
            refund_record.amount
          ),
          0
        )::numeric(14,2)
          as refunded_amount

      from public.sale_refunds
        as refund_record

      where
        refund_record.business_id =
          sale_record.business_id

        and
        refund_record.sale_id =
          sale_record.id

    ) as refund_summary

      on true


    where
      sale_record.business_id =
        p_business_id

      and
      sale_record.customer_id =
        p_customer_id


    order by
      sale_record.created_at desc


    limit 25

  ) as recent;


  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'id',
          transaction_record.id,

          'type',
          transaction_record.transaction_type::text,

          'pointsDelta',
          transaction_record.points_delta,

          'monetaryValue',
          transaction_record.monetary_value,

          'description',
          transaction_record.description,

          'saleId',
          transaction_record.sale_id,

          'refundId',
          transaction_record.refund_id,

          'createdAt',
          transaction_record.created_at

        )

        order by
          transaction_record.created_at desc

      ),

      '[]'::jsonb

    )

  into
    v_loyalty

  from (

    select
      *

    from public.loyalty_transactions
      as loyalty_record

    where
      loyalty_record.business_id =
        p_business_id

      and
      loyalty_record.customer_id =
        p_customer_id

    order by
      loyalty_record.created_at desc

    limit 50

  ) as transaction_record;


  return jsonb_build_object(

    'customer',
    v_customer,

    'loyaltyPoints',
    v_points,

    'lifetimeSpend',
    v_lifetime_spend,

    'visits',
    v_visits,

    'sales',
    v_sales,

    'loyaltyTransactions',
    v_loyalty

  );

end;

$$;


-- ============================================================
-- LOOKUP CUSTOMER BY PHONE
--
-- This will be used by POS checkout.
-- ============================================================

create or replace function
public.lookup_customer_by_phone(

  p_business_id uuid,

  p_phone text

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_customer_id uuid;

begin

  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  select
    customer_record.id

  into
    v_customer_id

  from public.customers
    as customer_record

  where
    customer_record.business_id =
      p_business_id

    and
    customer_record.phone_normalized =
      private.normalize_customer_phone(
        p_phone
      )

    and
    customer_record.is_active =
      true

  limit 1;


  if
    v_customer_id is null
  then

    return null;

  end if;


  return public.get_customer_detail(
    p_business_id,
    v_customer_id
  );

end;

$$;


-- ============================================================
-- MANUAL LOYALTY ADJUSTMENT
--
-- Manager only.
-- ============================================================

create or replace function
public.adjust_customer_loyalty(

  p_business_id uuid,

  p_customer_id uuid,

  p_points_delta integer,

  p_reason text

)

returns integer

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_balance integer;

begin

  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then

    raise exception
      'Manager access required'

      using errcode =
        '42501';

  end if;


  if
    p_points_delta = 0
  then

    raise exception
      'Points adjustment cannot be zero';

  end if;


  if not exists (

    select
      1

    from public.customers
      as customer_record

    where
      customer_record.business_id =
        p_business_id

      and
      customer_record.id =
        p_customer_id

  ) then

    raise exception
      'Customer not found';

  end if;


  select

    coalesce(
      sum(
        transaction_record.points_delta
      ),
      0
    )::integer

  into
    v_balance

  from public.loyalty_transactions
    as transaction_record

  where
    transaction_record.business_id =
      p_business_id

    and
    transaction_record.customer_id =
      p_customer_id;


  if
    (
      v_balance +
      p_points_delta
    ) < 0
  then

    raise exception
      'Loyalty balance cannot become negative';

  end if;


  insert into public.loyalty_transactions (

    business_id,

    customer_id,

    transaction_type,

    points_delta,

    monetary_value,

    description,

    actor_user_id

  )

  values (

    p_business_id,

    p_customer_id,

    'manual_adjustment'::public.nova_loyalty_transaction_type,

    p_points_delta,

    0,

    coalesce(
      nullif(
        btrim(
          p_reason
        ),
        ''
      ),
      'Manual loyalty adjustment'
    ),

    auth.uid()

  );


  return
    v_balance +
    p_points_delta;

end;

$$;


-- ============================================================
-- FUNCTION SECURITY
-- ============================================================

revoke all
on function
public.save_customer(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  text,
  boolean
)
from
  public,
  anon;


grant execute
on function
public.save_customer(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  text,
  boolean
)
to authenticated;


revoke all
on function
public.list_customers(
  uuid,
  text,
  integer
)
from
  public,
  anon;


grant execute
on function
public.list_customers(
  uuid,
  text,
  integer
)
to authenticated;


revoke all
on function
public.get_customer_detail(
  uuid,
  uuid
)
from
  public,
  anon;


grant execute
on function
public.get_customer_detail(
  uuid,
  uuid
)
to authenticated;


revoke all
on function
public.lookup_customer_by_phone(
  uuid,
  text
)
from
  public,
  anon;


grant execute
on function
public.lookup_customer_by_phone(
  uuid,
  text
)
to authenticated;


revoke all
on function
public.adjust_customer_loyalty(
  uuid,
  uuid,
  integer,
  text
)
from
  public,
  anon;


grant execute
on function
public.adjust_customer_loyalty(
  uuid,
  uuid,
  integer,
  text
)
to authenticated;


-- ============================================================
-- COMMENTS
-- ============================================================

comment on table
public.customers

is
'NOVA POS customer profiles linked to purchases and loyalty.';


comment on table
public.loyalty_transactions

is
'NOVA POS immutable loyalty points ledger.';


comment on table
public.loyalty_settings

is
'NOVA POS configurable loyalty earning and redemption rules.';