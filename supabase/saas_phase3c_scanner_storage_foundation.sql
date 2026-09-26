-- ============================================================
-- NOVA POS
-- SaaS Phase 3C — Scanner + private storage foundation
-- ============================================================
--
-- SAFE TRANSITION MIGRATION.
--
-- This migration is deliberately backward compatible:
--   • existing public image URLs keep working for now
--   • direct scanner table writes keep working for now
--
-- After the frontend is switched to the new contracts, a
-- separate lockdown migration will:
--   • make tenant asset buckets private
--   • revoke direct scanner INSERT / UPDATE access
-- ============================================================


-- ============================================================
-- 1. PRODUCT IMAGE OBJECT PATH
-- ============================================================

alter table
public.products

add column if not exists
image_path text;


-- Recover object paths from existing Supabase public URLs.
-- External image URLs are left alone and image_path remains null.

update public.products

set image_path =
  split_part(
    image_url,
    '/storage/v1/object/public/product-images/',
    2
  )

where
  image_path is null

  and
  image_url like
    '%/storage/v1/object/public/product-images/%';


-- Every NOVA-managed product image must live inside the
-- owning business folder.

alter table
public.products

drop constraint if exists
products_image_path_business_check;


alter table
public.products

add constraint
products_image_path_business_check

check (

  image_path is null

  or

  btrim(
    image_path
  ) = ''

  or

  split_part(
    image_path,
    '/',
    1
  ) =
    business_id::text

);


create index if not exists
products_image_path_idx

on public.products (
  image_path
)

where
  image_path is not null;



-- ============================================================
-- 2. RECEIPT LOGO OBJECT PATH
-- ============================================================

update public.receipt_settings

set logo_path =
  split_part(
    logo_url,
    '/storage/v1/object/public/receipt-assets/',
    2
  )

where
  logo_path is null

  and
  logo_url like
    '%/storage/v1/object/public/receipt-assets/%';


alter table
public.receipt_settings

drop constraint if exists
receipt_settings_logo_path_business_check;


alter table
public.receipt_settings

add constraint
receipt_settings_logo_path_business_check

check (

  logo_path is null

  or

  btrim(
    logo_path
  ) = ''

  or

  split_part(
    logo_path,
    '/',
    1
  ) =
    business_id::text

);



-- ============================================================
-- 3. PRODUCT SAVE CONTRACT WITH PRIVATE STORAGE PATH
--
-- Existing save_product_with_promotion() is kept for rollback
-- compatibility. New frontend code will use this V2 contract.
-- ============================================================

create or replace function
public.save_product_with_promotion_v2(

  p_product_id uuid,

  p_name text,

  p_description text,

  p_category_id uuid,

  p_image_path text,

  p_status public.nova_product_status,

  p_variants jsonb,

  p_promotion_enabled boolean default false,

  p_promotion_type text default 'percentage',

  p_promotion_value numeric default 0,

  p_promotion_starts_at timestamptz default null,

  p_promotion_ends_at timestamptz default null

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

  v_business_id uuid;

  v_product_id uuid;

  v_image_path text :=
    nullif(
      btrim(
        coalesce(
          p_image_path,
          ''
        )
      ),
      ''
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


  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null
  then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  if not (
    select private.is_business_manager(
      v_business_id
    )
  )
  then

    raise exception
      'Manager access required'

      using errcode =
        '42501';

  end if;


  if
    v_image_path is not null

    and

    split_part(
      v_image_path,
      '/',
      1
    ) <>
      v_business_id::text
  then

    raise exception
      'Product image does not belong to this business'

      using errcode =
        '42501';

  end if;


  -- Keep the old URL field empty for NOVA-managed private
  -- objects. External legacy URLs remain supported when their
  -- existing row is not replaced.

  v_product_id :=
    public.save_product_with_promotion(

      p_product_id,

      p_name,

      p_description,

      p_category_id,

      case
        when v_image_path is null
        then ''
        else ''
      end,

      p_status,

      p_variants,

      p_promotion_enabled,

      p_promotion_type,

      p_promotion_value,

      p_promotion_starts_at,

      p_promotion_ends_at

    );


  update public.products
  set
    image_path =
      v_image_path,

    image_url =
      null

  where
    id =
      v_product_id

    and
    business_id =
      v_business_id;


  if not found
  then

    raise exception
      'Product could not be resolved inside the active business'

      using errcode =
        '42501';

  end if;


  return
    v_product_id;

end;

$$;


revoke all
on function
public.save_product_with_promotion_v2(
  uuid,
  text,
  text,
  uuid,
  text,
  public.nova_product_status,
  jsonb,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz
)
from
  public,
  anon;


grant execute
on function
public.save_product_with_promotion_v2(
  uuid,
  text,
  text,
  uuid,
  text,
  public.nova_product_status,
  jsonb,
  boolean,
  text,
  numeric,
  timestamptz,
  timestamptz
)
to authenticated;



-- ============================================================
-- 4. CATALOG VIEW — APPEND IMAGE PATH
-- ============================================================

create or replace view
public.catalog_variant_inventory

with (
  security_invoker = true
)

as

select

  p.business_id,

  p.id
    as product_id,

  p.name
    as product_name,

  p.description,

  p.image_url,

  p.status
    as product_status,

  c.id
    as category_id,

  c.name
    as category_name,

  pv.id
    as variant_id,

  pv.name
    as variant_name,

  pv.sku,

  pv.qr_token,

  (
    case

      when
        p.promotion_enabled

        and
        (
          p.promotion_starts_at
            is null

          or

          p.promotion_starts_at <=
            now()
        )

        and
        (
          p.promotion_ends_at
            is null

          or

          p.promotion_ends_at >
            now()
        )

      then

        round(

          greatest(

            0,

            case

              when
                p.promotion_type =
                  'percentage'

              then
                pv.price
                *
                (
                  100 -
                  p.promotion_value
                )
                /
                100

              when
                p.promotion_type =
                  'fixed'

              then
                pv.price -
                p.promotion_value

              else
                pv.price

            end

          ),

          2

        )

      else
        pv.price

    end

  )::numeric(12,2)
    as price,

  pv.cost,

  pv.is_active,

  loc.id
    as location_id,

  coalesce(
    level.on_hand,
    0
  )
    as stock,

  coalesce(
    level.low_stock_threshold,
    5
  )
    as low_stock_threshold,

  pv.price
    as regular_price,

  p.promotion_enabled,

  (
    p.promotion_enabled

    and
    (
      p.promotion_starts_at
        is null

      or

      p.promotion_starts_at <=
        now()
    )

    and
    (
      p.promotion_ends_at
        is null

      or

      p.promotion_ends_at >
        now()
    )
  )
    as promotion_active,

  p.promotion_type,

  p.promotion_value,

  p.promotion_starts_at,

  p.promotion_ends_at,

  p.image_path

from public.products
  as p

join public.product_variants
  as pv

  on
    pv.product_id =
      p.id

  and
    pv.business_id =
      p.business_id

left join public.categories
  as c

  on
    c.id =
      p.category_id

left join public.inventory_locations
  as loc

  on
    loc.business_id =
      p.business_id

  and
    loc.is_default =
      true

left join public.inventory_levels
  as level

  on
    level.business_id =
      p.business_id

  and
    level.location_id =
      loc.id

  and
    level.variant_id =
      pv.id;


revoke all
on public.catalog_variant_inventory
from
  anon,
  authenticated;


grant select
on public.catalog_variant_inventory
to authenticated;



-- ============================================================
-- 5. SERVER-GENERATED REMOTE SCANNER SESSION
--
-- Pair tokens are always generated by Postgres. The client
-- cannot choose a weak token or another business_id.
-- ============================================================

create or replace function
public.create_remote_scanner_session()

returns table (

  id uuid,

  pair_token uuid,

  expires_at timestamptz

)

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );

  v_business_id uuid;

  v_session_id uuid;

  v_pair_token uuid;

  v_expires_at timestamptz :=
    now() +
    interval '8 hours';

begin

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null

    or

    not (
      select private.is_business_member(
        v_business_id
      )
    )
  then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  update public.remote_scanner_sessions

  set
    status =
      'closed',

    closed_at =
      now()

  where
    business_id =
      v_business_id

    and
    created_by =
      v_user_id

    and
    status =
      'active';


  insert into public.remote_scanner_sessions (

    business_id,

    created_by,

    expires_at

  )

  values (

    v_business_id,

    v_user_id,

    v_expires_at

  )

  returning

    remote_scanner_sessions.id,

    remote_scanner_sessions.pair_token,

    remote_scanner_sessions.expires_at

  into

    v_session_id,

    v_pair_token,

    v_expires_at;


  return query

  select
    v_session_id,
    v_pair_token,
    v_expires_at;

end;

$$;


revoke all
on function
public.create_remote_scanner_session()
from
  public,
  anon;


grant execute
on function
public.create_remote_scanner_session()
to authenticated;



create or replace function
public.close_remote_scanner_session(
  p_session_id uuid
)

returns void

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );

  v_business_id uuid;

begin

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null
  then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  update public.remote_scanner_sessions

  set
    status =
      'closed',

    closed_at =
      now()

  where
    id =
      p_session_id

    and
    business_id =
      v_business_id

    and
    created_by =
      v_user_id

    and
    status =
      'active';


  if not found
  then

    raise exception
      'Scanner session was not found in the active business'

      using errcode =
        '42501';

  end if;

end;

$$;


revoke all
on function
public.close_remote_scanner_session(uuid)
from
  public,
  anon;


grant execute
on function
public.close_remote_scanner_session(uuid)
to authenticated;



comment on function
public.create_remote_scanner_session()
is
  'Creates an eight-hour high-entropy remote scanner session for the database-resolved active business.';


comment on function
public.close_remote_scanner_session(uuid)
is
  'Closes only a remote scanner session created by the authenticated user inside their database-resolved active business.';


notify pgrst,
'reload schema';
