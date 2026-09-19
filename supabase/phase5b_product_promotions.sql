-- ============================================================
-- NOVA POS — PHASE 5B PRODUCT PROMOTIONS
-- ============================================================
-- Product-level temporary promotions with optional scheduling.
--
-- Important:
--   • product_variants.price remains the NORMAL selling price.
--   • catalog_variant_inventory exposes the live effective POS price.
--   • complete_sale calculates that same price in PostgreSQL.
--   • receipts snapshot the normal price + promotion saving.
--   • historical sales stay correct after promotions change.
-- ============================================================


-- ============================================================
-- 1. PROMOTION CONFIG
-- ============================================================

alter table public.products
  add column if not exists promotion_enabled boolean not null default false,
  add column if not exists promotion_type text not null default 'percentage',
  add column if not exists promotion_value numeric(12,2) not null default 0,
  add column if not exists promotion_starts_at timestamptz,
  add column if not exists promotion_ends_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'products_promotion_type_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_promotion_type_check
      check (promotion_type in ('percentage', 'fixed'));
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'products_promotion_value_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_promotion_value_check
      check (promotion_value >= 0);
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'products_promotion_window_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_promotion_window_check
      check (
        promotion_starts_at is null
        or promotion_ends_at is null
        or promotion_starts_at < promotion_ends_at
      );
  end if;
end;
$$;


-- ============================================================
-- 2. HISTORICAL SALE SNAPSHOT
-- ============================================================

alter table public.sale_items
  add column if not exists regular_unit_price numeric(12,2);

update public.sale_items
set regular_unit_price = unit_price
where regular_unit_price is null;

alter table public.sale_items
  alter column regular_unit_price set default 0,
  alter column regular_unit_price set not null;

alter table public.sale_items
  add column if not exists product_discount_total numeric(12,2)
  not null
  default 0;

alter table public.sales
  add column if not exists product_discount_total numeric(12,2)
  not null
  default 0;


-- ============================================================
-- 3. PRICE HELPERS
-- ============================================================

create or replace function private.nova_promotional_price(
  p_regular_price numeric,
  p_promotion_type text,
  p_promotion_value numeric
)
returns numeric
language sql
immutable
security invoker
set search_path = ''
as $$
  select round(
    greatest(
      0,
      case
        when p_promotion_type = 'percentage'
          then coalesce(p_regular_price, 0)
            * (100 - coalesce(p_promotion_value, 0))
            / 100
        when p_promotion_type = 'fixed'
          then coalesce(p_regular_price, 0)
            - coalesce(p_promotion_value, 0)
        else coalesce(p_regular_price, 0)
      end
    ),
    2
  );
$$;


create or replace function private.nova_promotion_is_active(
  p_enabled boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(p_enabled, false)
    and (p_starts_at is null or p_starts_at <= now())
    and (p_ends_at is null or p_ends_at > now());
$$;


create or replace function private.nova_effective_product_price(
  p_regular_price numeric,
  p_enabled boolean,
  p_promotion_type text,
  p_promotion_value numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns numeric
language sql
stable
security invoker
set search_path = ''
as $$
  select
    case
      when private.nova_promotion_is_active(
        p_enabled,
        p_starts_at,
        p_ends_at
      )
      then private.nova_promotional_price(
        p_regular_price,
        p_promotion_type,
        p_promotion_value
      )
      else round(coalesce(p_regular_price, 0), 2)
    end;
$$;


-- ============================================================
-- 4. MANAGER PROMOTION RPC
-- ============================================================

drop function if exists
public.set_product_promotion(
  uuid,
  boolean,
  text,
  numeric
);

drop function if exists
public.set_product_promotion(
  uuid,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz
);

create function public.set_product_promotion(
  p_product_id uuid,
  p_enabled boolean,
  p_type text,
  p_value numeric,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_type text := lower(btrim(coalesce(p_type, 'percentage')));
  v_value numeric(12,2) := round(greatest(coalesce(p_value, 0), 0), 2);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  select p.business_id
  into v_business_id
  from public.products p
  where p.id = p_product_id
  for update;

  if v_business_id is null then
    raise exception 'Product not found';
  end if;

  if not (
    select private.is_business_manager(v_business_id)
  ) then
    raise exception 'Manager access required'
      using errcode = '42501';
  end if;

  if v_type not in ('percentage', 'fixed') then
    raise exception 'Promotion type must be percentage or fixed';
  end if;

  if p_starts_at is not null
     and p_ends_at is not null
     and p_starts_at >= p_ends_at
  then
    raise exception 'Promotion end must be after promotion start';
  end if;

  if coalesce(p_enabled, false) then
    if v_value <= 0 then
      raise exception 'Promotion value must be greater than zero';
    end if;

    if v_type = 'percentage'
       and v_value >= 100
    then
      raise exception 'Percentage promotion must be less than 100%%';
    end if;

    if v_type = 'fixed'
       and exists (
         select 1
         from public.product_variants pv
         where pv.product_id = p_product_id
           and pv.business_id = v_business_id
           and pv.is_active = true
           and v_value >= pv.price
       )
    then
      raise exception 'Fixed promotion must be lower than every active variant price';
    end if;
  end if;

  update public.products
  set
    promotion_enabled = coalesce(p_enabled, false),
    promotion_type = v_type,
    promotion_value = v_value,
    promotion_starts_at = p_starts_at,
    promotion_ends_at = p_ends_at,
    updated_at = now()
  where id = p_product_id
    and business_id = v_business_id;
end;
$$;

revoke all
on function public.set_product_promotion(
  uuid,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz
)
from public, anon;

grant execute
on function public.set_product_promotion(
  uuid,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz
)
to authenticated;


-- ============================================================
-- 5. SNAPSHOT PROMOTION INTO SALE ITEMS
-- ============================================================

create or replace function private.snapshot_sale_item_product_promotion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regular_price numeric(12,2);
begin
  select pv.price
  into v_regular_price
  from public.product_variants pv
  where pv.id = new.variant_id
    and pv.business_id = new.business_id;

  new.regular_unit_price :=
    coalesce(v_regular_price, new.unit_price);

  new.product_discount_total :=
    round(
      greatest(
        new.regular_unit_price - new.unit_price,
        0
      ) * new.quantity,
      2
    );

  return new;
end;
$$;

drop trigger if exists sale_items_snapshot_product_promotion
on public.sale_items;

create trigger sale_items_snapshot_product_promotion
before insert on public.sale_items
for each row
execute function private.snapshot_sale_item_product_promotion();


create or replace function private.refresh_sale_product_discount_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale_id uuid;
  v_business_id uuid;
begin
  if tg_op = 'DELETE' then
    v_sale_id := old.sale_id;
    v_business_id := old.business_id;
  else
    v_sale_id := new.sale_id;
    v_business_id := new.business_id;
  end if;

  update public.sales s
  set product_discount_total = (
    select coalesce(sum(si.product_discount_total), 0)
    from public.sale_items si
    where si.sale_id = v_sale_id
      and si.business_id = v_business_id
  )
  where s.id = v_sale_id
    and s.business_id = v_business_id;

  return null;
end;
$$;

drop trigger if exists sale_items_refresh_product_discount_total
on public.sale_items;

create trigger sale_items_refresh_product_discount_total
after insert or update of product_discount_total or delete
on public.sale_items
for each row
execute function private.refresh_sale_product_discount_total();


-- ============================================================
-- 6. CATALOG VIEW
-- Keep all existing view columns in their original order.
-- New promotion columns are appended so CREATE OR REPLACE is safe.
-- ============================================================

create or replace view public.catalog_variant_inventory
with (security_invoker = true)
as
select
  p.business_id,
  p.id as product_id,
  p.name as product_name,
  p.description,
  p.image_url,
  p.status as product_status,
  c.id as category_id,
  c.name as category_name,
  pv.id as variant_id,
  pv.name as variant_name,
  pv.sku,
  pv.qr_token,
  private.nova_effective_product_price(
    pv.price,
    p.promotion_enabled,
    p.promotion_type,
    p.promotion_value,
    p.promotion_starts_at,
    p.promotion_ends_at
  ) as price,
  pv.cost,
  pv.is_active,
  loc.id as location_id,
  coalesce(level.on_hand, 0) as stock,
  coalesce(level.low_stock_threshold, 5) as low_stock_threshold,
  pv.price as regular_price,
  p.promotion_enabled,
  private.nova_promotion_is_active(
    p.promotion_enabled,
    p.promotion_starts_at,
    p.promotion_ends_at
  ) as promotion_active,
  p.promotion_type,
  p.promotion_value,
  p.promotion_starts_at,
  p.promotion_ends_at
from public.products p
join public.product_variants pv
  on pv.product_id = p.id
 and pv.business_id = p.business_id
left join public.categories c
  on c.id = p.category_id
left join public.inventory_locations loc
  on loc.business_id = p.business_id
 and loc.is_default = true
left join public.inventory_levels level
  on level.business_id = p.business_id
 and level.location_id = loc.id
 and level.variant_id = pv.id;

revoke all on public.catalog_variant_inventory from anon, authenticated;
grant select on public.catalog_variant_inventory to authenticated;


-- ============================================================
-- 7. AUTHORITATIVE CHECKOUT
-- Same checkout contract; only variant price resolution changes.
-- ============================================================

create function
public.complete_sale(

  p_business_id uuid,

  p_checkout_key uuid,

  p_items jsonb,

  p_payment_method
    public.nova_payment_method,

  p_cash_received numeric
    default null,

  p_reference_number text
    default null,

  p_discount_total numeric
    default 0,

  p_customer_name text
    default null,

  p_customer_email text
    default null,

  p_customer_phone text
    default null,

  p_note text
    default '',

  p_customer_id uuid
    default null,

  p_loyalty_points_to_redeem integer
    default 0

)

returns table (

  sale_id uuid,

  receipt_number text,

  receipt_sequence bigint,

  currency_code text,

  subtotal numeric,

  discount_total numeric,

  tax_total numeric,

  total numeric,

  item_quantity_total integer,

  payment_method text,

  cash_received numeric,

  change_due numeric,

  created_at timestamptz,

  was_existing boolean

)

language plpgsql

security definer

set search_path = ''

as $$

declare

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  v_user_id uuid :=
    (
      select auth.uid()
    );


  -- ==========================================================
  -- BUSINESS / INVENTORY
  -- ==========================================================

  v_location_id uuid;

  v_currency_code text;


  -- ==========================================================
  -- CART
  -- ==========================================================

  v_requested_count integer :=
    0;

  v_processed_count integer :=
    0;

  v_inserted_count integer :=
    0;

  v_item_quantity_total integer :=
    0;


  -- ==========================================================
  -- MONEY
  -- ==========================================================

  v_subtotal numeric(12,2) :=
    0;


  v_manual_discount_total numeric(12,2) :=
    round(
      coalesce(
        p_discount_total,
        0
      ),
      2
    );


  v_customer_discount_total numeric(12,2) :=
    0;


  v_loyalty_discount_total numeric(12,2) :=
    0;


  v_discount_total numeric(12,2) :=
    0;


  v_pre_loyalty_total numeric(12,2) :=
    0;


  v_tax_total numeric(12,2) :=
    0;


  v_total numeric(12,2);


  v_cash_received numeric(12,2);

  v_change_due numeric(12,2) :=
    0;


  -- ==========================================================
  -- SALE
  -- ==========================================================

  v_sale_id uuid;

  v_receipt_number text;

  v_receipt_sequence bigint;

  v_created_at timestamptz;

  v_cashier_label text;

  v_existing_payment_method text;

  -- ==========================================================
-- EXISTING SALE / IDEMPOTENCY RESULT
--
-- These MUST remain separate from the calculation variables.
-- A SELECT INTO returning no row sets its targets to NULL.
-- ==========================================================

v_existing_sale_id uuid;

v_existing_receipt_number text;

v_existing_receipt_sequence bigint;

v_existing_currency_code text;

v_existing_subtotal numeric(12,2);

v_existing_discount_total numeric(12,2);

v_existing_tax_total numeric(12,2);

v_existing_total numeric(12,2);

v_existing_item_quantity_total integer;

v_existing_cash_received numeric(12,2);

v_existing_change_due numeric(12,2);

v_existing_created_at timestamptz;


  -- ==========================================================
  -- CUSTOMER
  -- ==========================================================

  v_customer_id uuid :=
    p_customer_id;


  v_customer_name text;

  v_customer_email text;

  v_customer_phone text;


  v_customer_discount_percent numeric(5,2) :=
    0;


  v_customer_phone_verified_at timestamptz;


  -- ==========================================================
  -- LOYALTY SETTINGS
  -- ==========================================================

  v_loyalty_enabled boolean :=
    false;


  v_spend_amount_per_earn numeric(12,2) :=
    100;


  v_points_earned_rule integer :=
    1;


  v_redeem_points integer :=
    100;


  v_redeem_value numeric(12,2) :=
    100;


  v_minimum_redeem_points integer :=
    100;


  v_maximum_discount_percent numeric(5,2) :=
    50;


  v_allow_cashier_redeem boolean :=
    true;


  v_require_verified_phone boolean :=
    false;


  v_loyalty_balance integer :=
    0;


  v_points_to_redeem integer :=
    greatest(
      coalesce(
        p_loyalty_points_to_redeem,
        0
      ),
      0
    );


  v_points_earned integer :=
    0;


  v_max_loyalty_discount numeric(12,2) :=
    0;


  -- ==========================================================
  -- OTHER
  -- ==========================================================

  v_note text;

  v_reference_number text;

  v_item record;

  v_before integer;

  v_after integer;

  v_line_subtotal numeric(12,2);

  v_line_discount numeric(12,2);

  v_allocated_discount numeric(12,2) :=
    0;


begin


  -- ==========================================================
  -- AUTHENTICATION
  -- ==========================================================

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if
    p_business_id is null
  then

    raise exception
      'Business is required';

  end if;


  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'You do not have access to this business'

      using errcode =
        '42501';

  end if;


  if
    p_checkout_key is null
  then

    raise exception
      'Checkout key is required';

  end if;


  if
    p_payment_method is null
  then

    raise exception
      'Payment method is required';

  end if;


  -- ==========================================================
  -- IDEMPOTENCY LOCK
  -- ==========================================================

  perform
    pg_catalog.pg_advisory_xact_lock(

      pg_catalog.hashtextextended(

        p_business_id::text
        ||
        ':'
        ||
        p_checkout_key::text,

        0

      )

    );


  -- ==========================================================
  -- ALREADY COMPLETED
  -- ==========================================================

  -- ==========================================================
-- ALREADY COMPLETED?
--
-- IMPORTANT:
--
-- Do NOT use v_subtotal / v_total / etc. as SELECT INTO
-- targets here.
--
-- A SELECT INTO that finds no row sets its target variables
-- to NULL. Those variables are needed later to calculate a
-- brand-new transaction.
-- ==========================================================

select

  sale_record.id,

  sale_record.receipt_number,

  sale_record.receipt_sequence,

  sale_record.currency_code,

  sale_record.subtotal,

  sale_record.discount_total,

  sale_record.tax_total,

  sale_record.total,

  sale_record.item_quantity_total,

  payment_record.method::text,

  payment_record.cash_received,

  payment_record.change_due,

  sale_record.created_at

into

  v_existing_sale_id,

  v_existing_receipt_number,

  v_existing_receipt_sequence,

  v_existing_currency_code,

  v_existing_subtotal,

  v_existing_discount_total,

  v_existing_tax_total,

  v_existing_total,

  v_existing_item_quantity_total,

  v_existing_payment_method,

  v_existing_cash_received,

  v_existing_change_due,

  v_existing_created_at

from public.sales
  as sale_record


left join lateral (

  select
    payment.*

  from public.payments
    as payment

  where
    payment.sale_id =
      sale_record.id

    and
    payment.business_id =
      sale_record.business_id

  order by
    payment.created_at asc

  limit 1

) as payment_record

  on true


where
  sale_record.business_id =
    p_business_id

  and
  sale_record.checkout_key =
    p_checkout_key

limit 1;


if
  v_existing_sale_id is not null
then

  return query

  select

    v_existing_sale_id,

    v_existing_receipt_number,

    v_existing_receipt_sequence,

    v_existing_currency_code,

    v_existing_subtotal,

    v_existing_discount_total,

    v_existing_tax_total,

    v_existing_total,

    v_existing_item_quantity_total,

    coalesce(
      v_existing_payment_method,
      p_payment_method::text
    ),

    v_existing_cash_received,

    v_existing_change_due,

    v_existing_created_at,

    true;


  return;

end if;


  -- ==========================================================
  -- CART VALIDATION
  -- ==========================================================

  if
    p_items is null

    or

    jsonb_typeof(
      p_items
    ) <> 'array'
  then

    raise exception
      'Checkout items must be a JSON array';

  end if;


  if
    jsonb_array_length(
      p_items
    ) = 0
  then

    raise exception
      'Cart is empty';

  end if;


  if
    jsonb_array_length(
      p_items
    ) > 200
  then

    raise exception
      'Too many cart lines';

  end if;


  if
    v_manual_discount_total < 0
  then

    raise exception
      'Discount cannot be negative';

  end if;


  -- ==========================================================
  -- CASHIER
  -- ==========================================================

  select

    coalesce(
      user_record.email,
      'Cashier'
    )

  into
    v_cashier_label

  from auth.users
    as user_record

  where
    user_record.id =
      v_user_id;


  v_cashier_label :=
    coalesce(
      v_cashier_label,
      'Cashier'
    );


  -- ==========================================================
  -- RAW CUSTOMER SNAPSHOT
  -- ==========================================================

  v_customer_name :=
    nullif(
      btrim(
        coalesce(
          p_customer_name,
          ''
        )
      ),
      ''
    );


  v_customer_email :=
    nullif(
      lower(
        btrim(
          coalesce(
            p_customer_email,
            ''
          )
        )
      ),
      ''
    );


  v_customer_phone :=
    nullif(
      btrim(
        coalesce(
          p_customer_phone,
          ''
        )
      ),
      ''
    );


  v_note :=
    btrim(
      coalesce(
        p_note,
        ''
      )
    );


  v_reference_number :=
    nullif(
      btrim(
        coalesce(
          p_reference_number,
          ''
        )
      ),
      ''
    );


  if
    v_customer_name is not null

    and
    length(
      v_customer_name
    ) > 160
  then

    raise exception
      'Customer name is too long';

  end if;


  if
    v_customer_email is not null
  then

    if
      length(
        v_customer_email
      ) > 320

      or

      position(
        '@'
        in
        v_customer_email
      ) = 0
    then

      raise exception
        'Customer email is invalid';

    end if;

  end if;


  if
    v_customer_phone is not null

    and
    length(
      v_customer_phone
    ) > 50
  then

    raise exception
      'Customer phone is too long';

  end if;


  if
    length(
      v_note
    ) > 1000
  then

    raise exception
      'Sale note is too long';

  end if;


  -- ==========================================================
  -- RESOLVE REGISTERED CUSTOMER
  --
  -- Explicit customer ID wins.
  --
  -- If no ID is supplied, NOVA also attempts to match the
  -- entered phone number to an active customer.
  -- ==========================================================

  if
    v_customer_id is null

    and

    v_customer_phone is not null
  then

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
          v_customer_phone
        )

      and
      customer_record.is_active =
        true

    limit 1;

  end if;


  if
    v_customer_id is not null
  then

    select

      customer_record.name,

      customer_record.email,

      customer_record.phone,

      customer_record.default_discount_percent,

      customer_record.phone_verified_at

    into

      v_customer_name,

      v_customer_email,

      v_customer_phone,

      v_customer_discount_percent,

      v_customer_phone_verified_at

    from public.customers
      as customer_record

    where
      customer_record.id =
        v_customer_id

      and
      customer_record.business_id =
        p_business_id

      and
      customer_record.is_active =
        true;


    if not found then

      raise exception
        'Selected customer could not be found';

    end if;


    -- ========================================================
    -- CUSTOMER LOYALTY LOCK
    --
    -- Prevents two tills from spending the same points at the
    -- same moment.
    -- ========================================================

    perform
      pg_catalog.pg_advisory_xact_lock(

        pg_catalog.hashtextextended(

          'loyalty:'
          ||
          p_business_id::text
          ||
          ':'
          ||
          v_customer_id::text,

          0

        )

      );


    insert into public.loyalty_settings (
      business_id
    )

    values (
      p_business_id
    )

    on conflict (
      business_id
    )

    do nothing;


    select

      setting_record.enabled,

      setting_record.spend_amount_per_earn,

      setting_record.points_earned,

      setting_record.redeem_points,

      setting_record.redeem_value,

      setting_record.minimum_redeem_points,

      setting_record.maximum_discount_percent,

      setting_record.allow_cashier_redeem,

      setting_record.require_verified_phone_for_redemption

    into

      v_loyalty_enabled,

      v_spend_amount_per_earn,

      v_points_earned_rule,

      v_redeem_points,

      v_redeem_value,

      v_minimum_redeem_points,

      v_maximum_discount_percent,

      v_allow_cashier_redeem,

      v_require_verified_phone

    from public.loyalty_settings
      as setting_record

    where
      setting_record.business_id =
        p_business_id;

  end if;


  -- ==========================================================
  -- BUSINESS
  -- ==========================================================

  select
    business_record.currency_code

  into
    v_currency_code

  from public.businesses
    as business_record

  where
    business_record.id =
      p_business_id;


  if
    v_currency_code is null
  then

    raise exception
      'Business not found';

  end if;


  -- ==========================================================
  -- DEFAULT INVENTORY LOCATION
  -- ==========================================================

  select
    location_record.id

  into
    v_location_id

  from public.inventory_locations
    as location_record

  where
    location_record.business_id =
      p_business_id

    and
    location_record.is_default =
      true

    and
    location_record.is_active =
      true

  limit 1;


  if
    v_location_id is null
  then

    raise exception
      'No active default inventory location is configured';

  end if;


  -- ==========================================================
  -- UNIQUE CART VARIANTS
  -- ==========================================================

  select
    count(*)::integer

  into
    v_requested_count

  from private.nova_checkout_items(
    p_items
  );


  if
    v_requested_count = 0
  then

    raise exception
      'Cart is empty';

  end if;


  -- ==========================================================
  -- ENSURE INVENTORY ROWS
  -- ==========================================================

  insert into public.inventory_levels (

    business_id,

    location_id,

    variant_id,

    on_hand,

    low_stock_threshold

  )

  select

    p_business_id,

    v_location_id,

    requested.variant_id,

    0,

    5

  from private.nova_checkout_items(
    p_items
  ) as requested


  join public.product_variants
    as variant_record

    on
      variant_record.id =
        requested.variant_id

    and
      variant_record.business_id =
        p_business_id


  on conflict (
    location_id,
    variant_id
  )

  do nothing;


  -- ==========================================================
  -- LOCK + VALIDATE STOCK + CALCULATE SUBTOTAL
  -- ==========================================================

  for v_item in

    select

      requested.variant_id,

      requested.quantity,

      variant_record.product_id,

      product_record.name
        as product_name,

      variant_record.name
        as variant_name,

      variant_record.sku,

      private.nova_effective_product_price(
        variant_record.price,
        product_record.promotion_enabled,
        product_record.promotion_type,
        product_record.promotion_value,
        product_record.promotion_starts_at,
        product_record.promotion_ends_at
      ) as price,

      variant_record.cost,

      inventory_record.on_hand


    from private.nova_checkout_items(
      p_items
    ) as requested


    join public.product_variants
      as variant_record

      on
        variant_record.id =
          requested.variant_id

      and
        variant_record.business_id =
          p_business_id

      and
        variant_record.is_active =
          true


    join public.products
      as product_record

      on
        product_record.id =
          variant_record.product_id

      and
        product_record.business_id =
          variant_record.business_id

      and
        product_record.status =
          'active'::public.nova_product_status


    join public.inventory_levels
      as inventory_record

      on
        inventory_record.business_id =
          p_business_id

      and
        inventory_record.location_id =
          v_location_id

      and
        inventory_record.variant_id =
          variant_record.id


    order by
      requested.variant_id


    for update of inventory_record


  loop

    v_processed_count :=
      v_processed_count +
      1;


    if
      v_item.quantity is null

      or
      v_item.quantity <= 0
    then

      raise exception
        'Item quantity must be greater than zero';

    end if;


    if
      v_item.quantity > 9999
    then

      raise exception
        'Item quantity is too large';

    end if;


    if
      v_item.on_hand <
      v_item.quantity
    then

      raise exception

        'Insufficient stock for % (%): requested %, available %',

        v_item.product_name,

        v_item.sku,

        v_item.quantity,

        v_item.on_hand;

    end if;


    v_subtotal :=
      v_subtotal
      +
      round(
        v_item.price *
        v_item.quantity,
        2
      );


    v_item_quantity_total :=
      v_item_quantity_total +
      v_item.quantity;

  end loop;


  if
    v_processed_count <>
    v_requested_count
  then

    raise exception
      'One or more cart items are unavailable, inactive, or belong to another business';

  end if;


  v_subtotal :=
    round(
      v_subtotal,
      2
    );


  if
    v_subtotal <= 0
  then

    raise exception
      'Sale subtotal must be greater than zero';

  end if;


  if
    v_manual_discount_total >
    v_subtotal
  then

    raise exception
      'Discount cannot exceed the subtotal';

  end if;


  -- ==========================================================
  -- CUSTOMER PERMANENT DISCOUNT
  --
  -- It applies AFTER the ordinary/cart discount.
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_customer_discount_percent > 0
  then

    v_customer_discount_total :=
      round(

        (
          v_subtotal -
          v_manual_discount_total
        )

        *

        v_customer_discount_percent

        /

        100,

        2

      );

  end if;


  v_pre_loyalty_total :=
    round(

      v_subtotal
      -
      v_manual_discount_total
      -
      v_customer_discount_total,

      2

    );


  -- ==========================================================
  -- LOYALTY REDEMPTION
  -- ==========================================================

  if
    v_points_to_redeem > 0
  then

    if
      v_customer_id is null
    then

      raise exception
        'A registered customer is required to redeem loyalty points';

    end if;


    if not
      v_loyalty_enabled
    then

      raise exception
        'The loyalty program is currently disabled';

    end if;


    if
      not v_allow_cashier_redeem

      and

      not (
        select private.is_business_manager(
          p_business_id
        )
      )
    then

      raise exception
        'Manager access is required to redeem loyalty points'

        using errcode =
          '42501';

    end if;


    if
      v_require_verified_phone

      and

      v_customer_phone_verified_at is null
    then

      raise exception
        'This customer must verify their phone number before redeeming loyalty points';

    end if;


    select

      coalesce(
        sum(
          transaction_record.points_delta
        ),
        0
      )::integer

    into
      v_loyalty_balance

    from public.loyalty_transactions
      as transaction_record

    where
      transaction_record.business_id =
        p_business_id

      and
      transaction_record.customer_id =
        v_customer_id;


    if
      v_points_to_redeem >
      v_loyalty_balance
    then

      raise exception
        'Customer does not have enough loyalty points';

    end if;


    if
      v_points_to_redeem <
      v_minimum_redeem_points
    then

      raise exception
        'Minimum loyalty redemption is % points',
        v_minimum_redeem_points;

    end if;


    if
      mod(
        v_points_to_redeem,
        v_redeem_points
      ) <> 0
    then

      raise exception
        'Loyalty points must be redeemed in blocks of %',
        v_redeem_points;

    end if;


    v_loyalty_discount_total :=
      round(

        (
          v_points_to_redeem::numeric

          /

          v_redeem_points::numeric
        )

        *

        v_redeem_value,

        2

      );


    v_max_loyalty_discount :=
      round(

        v_pre_loyalty_total

        *

        v_maximum_discount_percent

        /

        100,

        2

      );


    if
      v_loyalty_discount_total >
      v_max_loyalty_discount
    then

      raise exception

        'Loyalty redemption exceeds the maximum allowed discount of %%%',

        v_maximum_discount_percent;

    end if;


    if
      v_loyalty_discount_total >
      v_pre_loyalty_total
    then

      raise exception
        'Loyalty redemption exceeds the sale total';

    end if;

  end if;


  -- ==========================================================
  -- COMBINED DISCOUNT
  -- ==========================================================

  v_discount_total :=
    round(

      v_manual_discount_total

      +

      v_customer_discount_total

      +

      v_loyalty_discount_total,

      2

    );


  -- ==========================================================
  -- AUTHORITATIVE TOTAL
  -- ==========================================================

  v_total :=
    round(

      v_subtotal

      -

      v_discount_total

      +

      v_tax_total,

      2

    );


  /*
   * Keep a small payable amount for the current payment
   * architecture.
   *
   * Later, if we add fully loyalty-paid sales, NOVA can support
   * zero-payment transactions explicitly.
   */

  if
    v_total <= 0
  then

    raise exception
      'Discounts cannot reduce the payable sale total to zero';

  end if;


  -- ==========================================================
  -- CALCULATE POINTS TO EARN
  --
  -- Earn from the actual amount paid AFTER all discounts.
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_loyalty_enabled

    and
    v_spend_amount_per_earn > 0
  then

    v_points_earned :=

      floor(
        v_total /
        v_spend_amount_per_earn
      )::integer

      *

      v_points_earned_rule;

  end if;


  -- ==========================================================
  -- PAYMENT VALIDATION
  -- ==========================================================

  if
    p_payment_method =
      'cash'::public.nova_payment_method
  then

    v_cash_received :=
      round(
        coalesce(
          p_cash_received,
          0
        ),
        2
      );


    if
      v_cash_received <
      v_total
    then

      raise exception

        'Cash received is less than the live sale total of % %',

        v_currency_code,

        v_total;

    end if;


    v_change_due :=
      round(

        v_cash_received -
        v_total,

        2

      );

  else

    v_cash_received :=
      null;


    v_change_due :=
      null;

  end if;


  -- ==========================================================
  -- RECEIPT
  -- ==========================================================

  select

    identity.receipt_sequence,

    identity.receipt_number

  into

    v_receipt_sequence,

    v_receipt_number

  from private.next_receipt_identity(
    p_business_id
  ) as identity;


  -- ==========================================================
  -- CREATE SALE
  -- ==========================================================

  insert into public.sales
  as inserted_sale (

    business_id,

    location_id,

    checkout_key,

    receipt_sequence,

    receipt_number,

    currency_code,

    status,

    cashier_user_id,

    cashier_label,

    customer_id,

    customer_name,

    customer_email,

    customer_phone,

    subtotal,

    manual_discount_total,

    customer_discount_total,

    loyalty_discount_total,

    discount_total,

    tax_total,

    total,

    item_quantity_total,

    loyalty_points_redeemed,

    loyalty_points_earned,

    note

  )

  values (

    p_business_id,

    v_location_id,

    p_checkout_key,

    v_receipt_sequence,

    v_receipt_number,

    v_currency_code,

    'completed'::public.nova_sale_status,

    v_user_id,

    v_cashier_label,

    v_customer_id,

    v_customer_name,

    v_customer_email,

    v_customer_phone,

    v_subtotal,

    v_manual_discount_total,

    v_customer_discount_total,

    v_loyalty_discount_total,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    v_points_to_redeem,

    v_points_earned,

    v_note

  )

  returning

  inserted_sale.id,

  inserted_sale.created_at

into

  v_sale_id,

  v_created_at;


  -- ==========================================================
  -- SALE ITEMS + INVENTORY
  -- ==========================================================

  for v_item in

    select

      requested.variant_id,

      requested.quantity,

      variant_record.product_id,

      product_record.name
        as product_name,

      variant_record.name
        as variant_name,

      variant_record.sku,

      private.nova_effective_product_price(
        variant_record.price,
        product_record.promotion_enabled,
        product_record.promotion_type,
        product_record.promotion_value,
        product_record.promotion_starts_at,
        product_record.promotion_ends_at
      ) as price,

      variant_record.cost,

      inventory_record.on_hand


    from private.nova_checkout_items(
      p_items
    ) as requested


    join public.product_variants
      as variant_record

      on
        variant_record.id =
          requested.variant_id

      and
        variant_record.business_id =
          p_business_id


    join public.products
      as product_record

      on
        product_record.id =
          variant_record.product_id

      and
        product_record.business_id =
          variant_record.business_id


    join public.inventory_levels
      as inventory_record

      on
        inventory_record.business_id =
          p_business_id

      and
        inventory_record.location_id =
          v_location_id

      and
        inventory_record.variant_id =
          variant_record.id


    order by
      requested.variant_id


  loop

    v_inserted_count :=
      v_inserted_count +
      1;


    v_line_subtotal :=
      round(

        v_item.price *
        v_item.quantity,

        2

      );


    -- ========================================================
    -- ALLOCATE ALL DISCOUNTS ACROSS ITEM LINES
    --
    -- This keeps partial refund maths correct.
    -- ========================================================

    if
      v_discount_total > 0
    then

      if
        v_inserted_count =
        v_requested_count
      then

        v_line_discount :=
          round(

            v_discount_total -
            v_allocated_discount,

            2

          );

      else

        v_line_discount :=
          round(

            v_discount_total

            *

            v_line_subtotal

            /

            v_subtotal,

            2

          );

      end if;

    else

      v_line_discount :=
        0;

    end if;


    v_allocated_discount :=
      v_allocated_discount +
      v_line_discount;


    insert into public.sale_items (

      business_id,

      sale_id,

      product_id,

      variant_id,

      product_name,

      variant_name,

      sku,

      quantity,

      unit_price,

      unit_cost,

      line_subtotal,

      discount_total,

      tax_total,

      line_total

    )

    values (

      p_business_id,

      v_sale_id,

      v_item.product_id,

      v_item.variant_id,

      v_item.product_name,

      v_item.variant_name,

      v_item.sku,

      v_item.quantity,

      v_item.price,

      v_item.cost,

      v_line_subtotal,

      v_line_discount,

      0,

      round(

        v_line_subtotal -
        v_line_discount,

        2

      )

    );


    v_before :=
      v_item.on_hand;


    v_after :=
      v_before -
      v_item.quantity;


    update public.inventory_levels

    set

      on_hand =
        v_after,

      updated_at =
        now()

    where
      business_id =
        p_business_id

      and
      location_id =
        v_location_id

      and
      variant_id =
        v_item.variant_id;


    insert into public.inventory_movements (

      business_id,

      location_id,

      variant_id,

      movement_type,

      quantity_delta,

      quantity_before,

      quantity_after,

      reason,

      note,

      reference_type,

      reference_id,

      actor_user_id

    )

    values (

      p_business_id,

      v_location_id,

      v_item.variant_id,

      'sale'::public.nova_inventory_movement_type,

      -v_item.quantity,

      v_before,

      v_after,

      'Sale',

      v_receipt_number,

      'sale',

      v_sale_id,

      v_user_id

    );

  end loop;


  -- ==========================================================
  -- PAYMENT
  -- ==========================================================

  insert into public.payments (

    business_id,

    sale_id,

    method,

    status,

    amount,

    reference_number,

    cash_received,

    change_due,

    received_by_user_id

  )

  values (

    p_business_id,

    v_sale_id,

    p_payment_method,

    'completed'::public.nova_payment_status,

    v_total,

    v_reference_number,

    v_cash_received,

    v_change_due,

    v_user_id

  );


  -- ==========================================================
  -- LOYALTY REDEMPTION LEDGER
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_points_to_redeem > 0
  then

    insert into public.loyalty_transactions (

      business_id,

      customer_id,

      transaction_type,

      points_delta,

      monetary_value,

      sale_id,

      description,

      actor_user_id

    )

    values (

      p_business_id,

      v_customer_id,

      'redeem'::public.nova_loyalty_transaction_type,

      -v_points_to_redeem,

      v_loyalty_discount_total,

      v_sale_id,

      'Redeemed on ' ||
      v_receipt_number,

      v_user_id

    );

  end if;


  -- ==========================================================
  -- LOYALTY EARNING LEDGER
  -- ==========================================================

  if
    v_customer_id is not null

    and
    v_points_earned > 0
  then

    insert into public.loyalty_transactions (

      business_id,

      customer_id,

      transaction_type,

      points_delta,

      monetary_value,

      sale_id,

      description,

      actor_user_id

    )

    values (

      p_business_id,

      v_customer_id,

      'earn'::public.nova_loyalty_transaction_type,

      v_points_earned,

      v_total,

      v_sale_id,

      'Earned from ' ||
      v_receipt_number,

      v_user_id

    );

  end if;


  -- ==========================================================
  -- RESULT
  -- ==========================================================

  return query

  select

    v_sale_id,

    v_receipt_number,

    v_receipt_sequence,

    v_currency_code,

    v_subtotal,

    v_discount_total,

    v_tax_total,

    v_total,

    v_item_quantity_total,

    p_payment_method::text,

    v_cash_received,

    v_change_due,

    v_created_at,

    false;


end;

$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function
public.complete_sale(

  uuid,

  uuid,

  jsonb,

  public.nova_payment_method,

  numeric,

  text,

  numeric,

  text,

  text,

  text,

  text,

  uuid,

  integer

)

from
  public,
  anon;


grant execute
on function
public.complete_sale(

  uuid,

  uuid,

  jsonb,

  public.nova_payment_method,

  numeric,

  text,

  numeric,

  text,

  text,

  text,

  text,

  uuid,

  integer

)

to authenticated;


comment on function
public.complete_sale(

  uuid,

  uuid,

  jsonb,

  public.nova_payment_method,

  numeric,

  text,

  numeric,

  text,

  text,

  text,

  text,

  uuid,

  integer

)

is
'NOVA atomic checkout with registered customers, permanent customer discounts, loyalty redemption and loyalty earning.';





-- ============================================================
-- 8. POSTGREST REFRESH
-- ============================================================

notify pgrst, 'reload schema';
