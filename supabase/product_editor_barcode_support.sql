-- ============================================================
-- NOVA POS
-- Product editor barcode persistence
-- ============================================================
--
-- Adds a V3 product-save contract that preserves all V2
-- behavior and atomically persists optional manufacturer
-- barcodes per variant.
-- ============================================================

create or replace function
public.save_product_with_promotion_v3(

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

  v_business_id uuid;

  v_product_id uuid;

  v_variant jsonb;

  v_variant_id uuid;

  v_sku text;

  v_barcode text;

  v_duplicate_count integer;

begin

  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null

    or not (
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
    p_variants is null

    or
    jsonb_typeof(
      p_variants
    ) <>
      'array'

    or
    jsonb_array_length(
      p_variants
    ) =
      0
  then

    raise exception
      'At least one product variant is required';

  end if;


  select
    count(*)::integer

  into
    v_duplicate_count

  from (

    select
      nullif(
        btrim(
          item
            ->>
            'barcode'
        ),
        ''
      )
        as barcode

    from jsonb_array_elements(
      p_variants
    )
      as item

  )
    as submitted

  where
    submitted.barcode
      is not null

  group by
    submitted.barcode

  having
    count(*) >
      1

  limit 1;


  if
    coalesce(
      v_duplicate_count,
      0
    ) >
      1
  then

    raise exception
      'Variant barcodes must be unique';

  end if;


  v_product_id :=
    public.save_product_with_promotion_v2(

      p_product_id,

      p_name,

      p_description,

      p_category_id,

      p_image_path,

      p_status,

      p_variants,

      p_promotion_enabled,

      p_promotion_type,

      p_promotion_value,

      p_promotion_starts_at,

      p_promotion_ends_at

    );


  for
    v_variant
  in
    select value
    from jsonb_array_elements(
      p_variants
    )

  loop

    v_variant_id :=
      nullif(
        v_variant
          ->>
          'id',
        ''
      )::uuid;


    v_sku :=
      upper(
        btrim(
          coalesce(
            v_variant
              ->>
              'sku',
            ''
          )
        )
      );


    v_barcode :=
      nullif(
        btrim(
          coalesce(
            v_variant
              ->>
              'barcode',
            ''
          )
        ),
        ''
      );


    if
      v_variant_id is not null
    then

      update public.product_variants

      set
        barcode =
          v_barcode

      where
        id =
          v_variant_id

        and
        product_id =
          v_product_id

        and
        business_id =
          v_business_id;


    else

      update public.product_variants

      set
        barcode =
          v_barcode

      where
        product_id =
          v_product_id

        and
        business_id =
          v_business_id

        and
        upper(
          sku
        ) =
          v_sku;

    end if;


    if not found
    then

      raise exception
        'A submitted product variant could not be resolved for barcode assignment';

    end if;

  end loop;


  return
    v_product_id;

exception

  when unique_violation
  then

    raise exception
      'A barcode or SKU is already assigned to another variant in this business';

end;

$$;


revoke all
on function
public.save_product_with_promotion_v3(
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
public.save_product_with_promotion_v3(
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


comment on function
public.save_product_with_promotion_v3(
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

is
  'Atomically saves a product, variants, promotion, private image path and optional manufacturer barcode values.';


notify pgrst,
'reload schema';
