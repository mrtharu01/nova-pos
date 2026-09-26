-- ============================================================
-- NOVA POS
-- Dual NOVA QR + manufacturer barcode scanner support
-- ============================================================
--
-- Keeps the existing permanent NOVA QR token system unchanged
-- and appends manufacturer barcode values to the tenant catalog
-- view used by POS / local scanner / remote scanner.
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

  p.image_path,

  pv.barcode

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


notify pgrst,
'reload schema';
