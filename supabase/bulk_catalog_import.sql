-- ============================================================
-- NOVA POS
-- Bulk catalog import + barcode foundation
-- ============================================================
--
-- Supports CSV / Excel bulk imports from the Products UI.
-- One spreadsheet row represents one product variant.
--
-- Optional product_key:
--   rows with the same product_key become variants of the same
--   product. Blank product_key creates a separate product.
--
-- barcode is stored now so the next scanner step can resolve
-- manufacturer EAN/UPC/Code128 values while NOVA QR stays intact.
-- ============================================================


-- ============================================================
-- 1. BARCODE FOUNDATION
-- ============================================================

alter table
public.product_variants

add column if not exists
barcode text;


alter table
public.product_variants

drop constraint if exists
product_variants_barcode_not_blank;


alter table
public.product_variants

add constraint
product_variants_barcode_not_blank

check (
  barcode is null
  or
  (
    length(
      btrim(
        barcode
      )
    ) between 1 and 128
  )
);


create unique index if not exists
product_variants_business_barcode_unique_idx

on public.product_variants (
  business_id,
  barcode
)

where
  barcode is not null;


comment on column
public.product_variants.barcode

is
  'Optional manufacturer barcode/GTIN/UPC/EAN/Code128 value. NOVA QR token remains a separate permanent identity.';



-- ============================================================
-- 2. BULK IMPORT RPC
-- ============================================================

create or replace function
public.bulk_import_products(
  p_rows jsonb
)

returns jsonb

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

  v_location_id uuid;

  v_row jsonb;

  v_row_number integer :=
    0;

  v_row_count integer;

  v_products_created integer :=
    0;

  v_variants_created integer :=
    0;

  v_categories_created integer :=
    0;

  v_product_map jsonb :=
    '{}'::jsonb;

  v_product_signature_map jsonb :=
    '{}'::jsonb;

  v_seen_skus jsonb :=
    '{}'::jsonb;

  v_seen_barcodes jsonb :=
    '{}'::jsonb;

  v_group_key text;

  v_product_name text;

  v_description text;

  v_category_name text;

  v_variant_name text;

  v_sku text;

  v_barcode text;

  v_status_text text;

  v_status public.nova_product_status;

  v_price numeric(12,2);

  v_cost numeric(12,2);

  v_initial_stock integer;

  v_low_stock_threshold integer;

  v_category_id uuid;

  v_product_id uuid;

  v_variant_id uuid;

  v_signature jsonb;

  v_existing_signature jsonb;

  v_base_slug text;

  v_slug text;

  v_suffix integer;

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
    p_rows is null

    or
    jsonb_typeof(
      p_rows
    ) <>
      'array'
  then

    raise exception
      'Bulk import rows must be a JSON array';

  end if;


  v_row_count :=
    jsonb_array_length(
      p_rows
    );


  if
    v_row_count < 1
  then

    raise exception
      'Bulk import contains no rows';

  end if;


  if
    v_row_count > 2000
  then

    raise exception
      'Bulk import is limited to 2000 rows per file';

  end if;


  select
    location.id

  into
    v_location_id

  from public.inventory_locations
    as location

  where
    location.business_id =
      v_business_id

    and
    location.is_default is true

    and
    location.is_active is true

  limit 1;


  if
    v_location_id is null
  then

    raise exception
      'Default inventory location is missing';

  end if;


  for
    v_row
  in
    select value
    from jsonb_array_elements(
      p_rows
    )

  loop

    v_row_number :=
      v_row_number + 1;


    if
      jsonb_typeof(
        v_row
      ) <>
        'object'
    then

      raise exception
        'Row % is not a valid object',
        v_row_number;

    end if;


    v_product_name :=
      btrim(
        coalesce(
          v_row
            ->>
            'product_name',
          ''
        )
      );


    v_description :=
      btrim(
        coalesce(
          v_row
            ->>
            'description',
          ''
        )
      );


    v_category_name :=
      btrim(
        coalesce(
          v_row
            ->>
            'category',
          ''
        )
      );


    v_variant_name :=
      btrim(
        coalesce(
          nullif(
            v_row
              ->>
              'variant_name',
            ''
          ),
          'Standard'
        )
      );


    v_barcode :=
      nullif(
        btrim(
          coalesce(
            v_row
              ->>
              'barcode',
            ''
          )
        ),
        ''
      );


    v_sku :=
      upper(
        btrim(
          coalesce(
            v_row
              ->>
              'sku',
            ''
          )
        )
      );


    if
      v_sku = ''

      and
      v_barcode is not null
    then

      v_sku :=
        upper(
          'BC-' ||
          v_barcode
        );

    end if;


    v_status_text :=
      lower(
        btrim(
          coalesce(
            nullif(
              v_row
                ->>
                'status',
              ''
            ),
            'active'
          )
        )
      );


    begin

      v_price :=
        coalesce(
          nullif(
            v_row
              ->>
              'price',
            ''
          )::numeric,
          0
        );


      v_cost :=
        coalesce(
          nullif(
            v_row
              ->>
              'cost',
            ''
          )::numeric,
          0
        );


      v_initial_stock :=
        coalesce(
          nullif(
            v_row
              ->>
              'stock',
            ''
          )::integer,
          0
        );


      v_low_stock_threshold :=
        coalesce(
          nullif(
            v_row
              ->>
              'low_stock_threshold',
            ''
          )::integer,
          5
        );

    exception

      when
        invalid_text_representation
        or numeric_value_out_of_range

      then

        raise exception
          'Row % contains an invalid numeric value',
          v_row_number;

    end;


    if
      length(
        v_product_name
      ) < 2

      or
      length(
        v_product_name
      ) > 160
    then

      raise exception
        'Row %: product_name must be between 2 and 160 characters',
        v_row_number;

    end if;


    if
      length(
        v_variant_name
      ) < 1

      or
      length(
        v_variant_name
      ) > 120
    then

      raise exception
        'Row %: variant_name must be between 1 and 120 characters',
        v_row_number;

    end if;


    if
      v_sku = ''
    then

      raise exception
        'Row %: provide either sku or barcode',
        v_row_number;

    end if;


    if
      length(
        v_sku
      ) > 120
    then

      raise exception
        'Row %: sku is too long',
        v_row_number;

    end if;


    if
      v_barcode is not null

      and
      length(
        v_barcode
      ) > 128
    then

      raise exception
        'Row %: barcode is too long',
        v_row_number;

    end if;


    if
      v_price < 0

      or
      v_cost < 0
    then

      raise exception
        'Row %: price and cost cannot be negative',
        v_row_number;

    end if;


    if
      v_initial_stock < 0

      or
      v_low_stock_threshold < 0
    then

      raise exception
        'Row %: stock values cannot be negative',
        v_row_number;

    end if;


    if
      v_status_text not in (
        'active',
        'draft'
      )
    then

      raise exception
        'Row %: status must be active or draft',
        v_row_number;

    end if;


    v_status :=
      v_status_text::public.nova_product_status;


    if
      v_seen_skus ?
        lower(
          v_sku
        )
    then

      raise exception
        'Row %: duplicate SKU inside import: %',
        v_row_number,
        v_sku;

    end if;


    v_seen_skus :=
      v_seen_skus ||
      jsonb_build_object(
        lower(
          v_sku
        ),
        true
      );


    if
      v_barcode is not null
    then

      if
        v_seen_barcodes ?
          v_barcode
      then

        raise exception
          'Row %: duplicate barcode inside import: %',
          v_row_number,
          v_barcode;

      end if;


      v_seen_barcodes :=
        v_seen_barcodes ||
        jsonb_build_object(
          v_barcode,
          true
        );

    end if;


    if exists (

      select
        1

      from public.product_variants
        as existing_variant

      where
        existing_variant.business_id =
          v_business_id

        and
        lower(
          existing_variant.sku
        ) =
          lower(
            v_sku
          )

    )
    then

      raise exception
        'Row %: SKU already exists in NOVA: %',
        v_row_number,
        v_sku;

    end if;


    if
      v_barcode is not null

      and exists (

        select
          1

        from public.product_variants
          as existing_variant

        where
          existing_variant.business_id =
            v_business_id

          and
          existing_variant.barcode =
            v_barcode

      )
    then

      raise exception
        'Row %: barcode already exists in NOVA: %',
        v_row_number,
        v_barcode;

    end if;


    v_group_key :=
      btrim(
        coalesce(
          v_row
            ->>
            'product_key',
          ''
        )
      );


    if
      v_group_key = ''
    then

      v_group_key :=
        '__row_' ||
        v_row_number::text;

    end if;


    v_signature :=
      jsonb_build_object(
        'name',
        v_product_name,
        'description',
        v_description,
        'category',
        lower(
          v_category_name
        ),
        'status',
        v_status_text
      );


    v_existing_signature :=
      v_product_signature_map
        ->
        v_group_key;


    if
      v_existing_signature is not null

      and
      v_existing_signature <>
        v_signature
    then

      raise exception
        'Row %: rows sharing product_key "%" must use the same product name, category, description and status',
        v_row_number,
        v_group_key;

    end if;


    v_product_id :=
      nullif(
        v_product_map
          ->>
          v_group_key,
        ''
      )::uuid;


    if
      v_product_id is null
    then

      v_category_id :=
        null;


      if
        v_category_name <>
          ''
      then

        select
          category.id

        into
          v_category_id

        from public.categories
          as category

        where
          category.business_id =
            v_business_id

          and
          lower(
            category.name
          ) =
            lower(
              v_category_name
            )

        order by
          category.created_at asc

        limit 1;


        if
          v_category_id is null
        then

          v_base_slug :=
            trim(
              both '-'
              from regexp_replace(
                lower(
                  v_category_name
                ),
                '[^a-z0-9]+',
                '-',
                'g'
              )
            );


          if
            v_base_slug = ''
          then

            v_base_slug :=
              'category';

          end if;


          v_slug :=
            v_base_slug;

          v_suffix :=
            1;


          while exists (

            select
              1

            from public.categories
              as category

            where
              category.business_id =
                v_business_id

              and
              lower(
                category.slug
              ) =
                lower(
                  v_slug
                )

          )
          loop

            v_suffix :=
              v_suffix + 1;


            v_slug :=
              v_base_slug ||
              '-' ||
              v_suffix::text;

          end loop;


          insert into public.categories (
            business_id,
            name,
            slug,
            is_active
          )

          values (
            v_business_id,
            v_category_name,
            v_slug,
            true
          )

          returning
            id

          into
            v_category_id;


          v_categories_created :=
            v_categories_created + 1;

        end if;

      end if;


      insert into public.products (
        business_id,
        category_id,
        name,
        description,
        image_url,
        image_path,
        status
      )

      values (
        v_business_id,
        v_category_id,
        v_product_name,
        v_description,
        null,
        null,
        v_status
      )

      returning
        id

      into
        v_product_id;


      v_product_map :=
        v_product_map ||
        jsonb_build_object(
          v_group_key,
          v_product_id::text
        );


      v_product_signature_map :=
        v_product_signature_map ||
        jsonb_build_object(
          v_group_key,
          v_signature
        );


      v_products_created :=
        v_products_created + 1;

    end if;


    insert into public.product_variants (
      business_id,
      product_id,
      name,
      sku,
      barcode,
      price,
      cost,
      is_active
    )

    values (
      v_business_id,
      v_product_id,
      v_variant_name,
      v_sku,
      v_barcode,
      v_price,
      v_cost,
      true
    )

    returning
      id

    into
      v_variant_id;


    insert into public.inventory_levels (
      business_id,
      location_id,
      variant_id,
      on_hand,
      low_stock_threshold
    )

    values (
      v_business_id,
      v_location_id,
      v_variant_id,
      v_initial_stock,
      v_low_stock_threshold
    );


    if
      v_initial_stock > 0
    then

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
        actor_user_id
      )

      values (
        v_business_id,
        v_location_id,
        v_variant_id,
        'stock_in'::public.nova_inventory_movement_type,
        v_initial_stock,
        0,
        v_initial_stock,
        'Bulk import',
        'Initial stock from CSV / Excel import',
        v_user_id
      );

    end if;


    v_variants_created :=
      v_variants_created + 1;

  end loop;


  return
    jsonb_build_object(
      'rowsImported',
      v_row_count,
      'productsCreated',
      v_products_created,
      'variantsCreated',
      v_variants_created,
      'categoriesCreated',
      v_categories_created
    );

end;

$$;


revoke all
on function
public.bulk_import_products(jsonb)
from
  public,
  anon;


grant execute
on function
public.bulk_import_products(jsonb)
to authenticated;


notify pgrst,
'reload schema';
