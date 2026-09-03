-- NOVA POS — Phase 3C
-- Product image storage.
--
-- QR identities do NOT need a new table.
-- product_variants.qr_token already contains the permanent QR identity.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- PRODUCT IMAGE STORAGE POLICIES
-- ============================================================

-- Images are stored using this structure:
--
-- product-images/
--   BUSINESS_UUID/
--     RANDOM_UUID.webp
--
-- Example:
--
-- product-images/
--   186b8c26-ae6a-40f6-83a1-87e296357b78/
--     50f55220-7da1-4630-baae-fbbffd2239aa.webp


-- ============================================================
-- INSERT
-- ============================================================

drop policy if exists nova_product_images_insert
on storage.objects;

create policy nova_product_images_insert
on storage.objects
for insert
to authenticated
with check (

  bucket_id = 'product-images'

  and private.is_business_manager(

    case

      when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

      then ((storage.foldername(name))[1])::uuid

      else null

    end

  )

);


-- ============================================================
-- SELECT
-- ============================================================

drop policy if exists nova_product_images_select
on storage.objects;

create policy nova_product_images_select
on storage.objects
for select
to authenticated
using (

  bucket_id = 'product-images'

  and private.is_business_member(

    case

      when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

      then ((storage.foldername(name))[1])::uuid

      else null

    end

  )

);


-- ============================================================
-- DELETE
-- ============================================================

drop policy if exists nova_product_images_delete
on storage.objects;

create policy nova_product_images_delete
on storage.objects
for delete
to authenticated
using (

  bucket_id = 'product-images'

  and private.is_business_manager(

    case

      when (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

      then ((storage.foldername(name))[1])::uuid

      else null

    end

  )

);