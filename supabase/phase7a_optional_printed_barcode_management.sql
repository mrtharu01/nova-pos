-- ============================================================
-- ARC POS
-- PHASE 7A — OPTIONAL PRINTED BARCODE MANAGEMENT
--
-- Manufacturer / existing printed barcode and ARC-generated
-- barcode are intentionally separate identities.
--
-- Updating or clearing the printed barcode never changes:
--   • variant id
--   • permanent ARC QR token
--   • ARC-generated Code 128 identity
--   • FIFO price-batch labels
-- ============================================================


create or replace function
public.set_variant_barcode(
  p_variant_id uuid,
  p_barcode text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_barcode text;
  v_duplicate boolean := false;
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
      using errcode = '42501';
  end if;


  v_barcode :=
    nullif(
      btrim(
        coalesce(
          p_barcode,
          ''
        )
      ),
      ''
    );


  if
    v_barcode is not null
    and length(
      v_barcode
    ) >
      128
  then
    raise exception
      'Barcode values must be 128 characters or fewer';
  end if;


  if
    v_barcode is not null
  then

    select
      exists (
        select 1
        from public.product_variants
          as duplicate_variant
        where
          duplicate_variant.business_id =
            v_business_id
          and
          duplicate_variant.id <>
            p_variant_id
          and
          duplicate_variant.barcode =
            v_barcode
      )
    into
      v_duplicate;


    if
      v_duplicate
    then
      raise exception
        'That printed barcode is already assigned to another product variant';
    end if;

  end if;


  update public.product_variants
  set
    barcode =
      v_barcode,
    updated_at =
      now()
  where
    id =
      p_variant_id
    and
    business_id =
      v_business_id;


  if not found
  then
    raise exception
      'Product variant not found';
  end if;

end;
$$;


revoke all
on function public.set_variant_barcode(
  uuid,
  text
)
from
  public,
  anon;


grant execute
on function public.set_variant_barcode(
  uuid,
  text
)
to authenticated;


comment on function
public.set_variant_barcode(
  uuid,
  text
)
is
  'Assigns or clears an optional manufacturer/existing printed barcode without changing permanent ARC-generated identities.';


notify pgrst,
'reload schema';
