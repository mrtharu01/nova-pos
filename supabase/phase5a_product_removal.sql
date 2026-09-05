-- ============================================================
-- NOVA POS
-- PHASE 5A — SAFE PRODUCT REMOVAL
--
-- Purpose:
--   • Add a production-safe Delete Product action.
--   • Permanently delete only products with no business history.
--   • Archive products that must remain for sales / inventory.
--   • Prevent direct client DELETE on public.products.
--
-- Run after the existing production hardening migrations.
-- ============================================================


-- ============================================================
-- 1. REMOVE DIRECT PRODUCT DELETE FROM CLIENTS
-- ============================================================

revoke delete
on table public.products
from authenticated;


drop policy if exists
products_delete_manager
on public.products;


-- ============================================================
-- 2. SAFE REMOVE PRODUCT RPC
-- ============================================================

create or replace function
public.remove_product(
  p_product_id uuid
)
returns text
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

  v_has_sale_history boolean := false;

  v_has_inventory_history boolean := false;

  v_has_stock boolean := false;

begin

  if
    v_user_id is null
  then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  select
    product_record.business_id

  into
    v_business_id

  from public.products
    as product_record

  where
    product_record.id =
      p_product_id

  for update;


  if
    v_business_id is null
  then
    raise exception
      'Product not found';
  end if;


  if not (
    select
      private.is_business_manager(
        v_business_id
      )
  ) then
    raise exception
      'Manager access required'
      using errcode = '42501';
  end if;


  -- ==========================================================
  -- SALE HISTORY
  -- ==========================================================

  select exists (
    select 1
    from public.sale_items
      as sale_item
    where
      sale_item.business_id =
        v_business_id
      and
      sale_item.product_id =
        p_product_id
  )
  into
    v_has_sale_history;


  -- ==========================================================
  -- INVENTORY HISTORY
  -- ==========================================================

  select exists (
    select 1
    from public.inventory_movements
      as movement_record
    join public.product_variants
      as variant_record
      on
        variant_record.id =
          movement_record.variant_id
        and
        variant_record.business_id =
          movement_record.business_id
    where
      movement_record.business_id =
        v_business_id
      and
      variant_record.product_id =
        p_product_id
  )
  into
    v_has_inventory_history;


  -- ==========================================================
  -- CURRENT STOCK
  -- ==========================================================

  select exists (
    select 1
    from public.inventory_levels
      as inventory_record
    join public.product_variants
      as variant_record
      on
        variant_record.id =
          inventory_record.variant_id
        and
        variant_record.business_id =
          inventory_record.business_id
    where
      inventory_record.business_id =
        v_business_id
      and
      variant_record.product_id =
        p_product_id
      and
      inventory_record.on_hand > 0
  )
  into
    v_has_stock;


  -- ==========================================================
  -- PRESERVE HISTORY WHEN REQUIRED
  -- ==========================================================

  if
    v_has_sale_history
    or
    v_has_inventory_history
    or
    v_has_stock
  then

    update public.products
    set
      status =
        'archived'::public.nova_product_status
    where
      id = p_product_id
      and
      business_id = v_business_id;


    return 'archived';

  end if;


  -- ==========================================================
  -- SAFE PERMANENT DELETE
  --
  -- At this point:
  --   • no sales reference this product
  --   • no inventory movement references its variants
  --   • no stock remains
  --
  -- product_variants and inventory_levels can therefore be
  -- removed safely through their existing cascade rules.
  -- ==========================================================

  delete from public.products
  where
    id = p_product_id
    and
    business_id = v_business_id;


  if not found then
    raise exception
      'Product could not be deleted';
  end if;


  return 'deleted';

end;
$$;


-- ============================================================
-- 3. RPC PERMISSIONS
-- ============================================================

revoke all
on function public.remove_product(uuid)
from
  public,
  anon;


grant execute
on function public.remove_product(uuid)
to authenticated;


-- ============================================================
-- 4. POSTGREST SCHEMA REFRESH
-- ============================================================

notify pgrst,
'reload schema';