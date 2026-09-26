-- ============================================================
-- NOVA POS — PHASE 1D RECEIPT BUSINESS LOGO
-- ============================================================
-- Adds a business logo to receipt settings and a dedicated
-- Supabase Storage bucket for receipt assets.
--
-- Storage structure:
--
-- receipt-assets/
--   BUSINESS_UUID/
--     logo-RANDOM_UUID.webp
-- ============================================================


-- ============================================================
-- 1. RECEIPT SETTINGS
-- ============================================================

alter table public.receipt_settings
  add column if not exists logo_url text,
  add column if not exists logo_path text;


-- ============================================================
-- 2. RECEIPT ASSET BUCKET
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'receipt-assets',
  'receipt-assets',
  true,
  2097152,
  array['image/webp']::text[]
)
on conflict (id)
do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 3. STORAGE INSERT
-- Owner / Manager only.
-- ============================================================

drop policy if exists
nova_receipt_assets_insert
on storage.objects;

create policy
nova_receipt_assets_insert

on storage.objects

for insert

to authenticated

with check (

  bucket_id =
    'receipt-assets'

  and

  private.is_business_manager(

    case

      when
        (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

      then
        ((storage.foldername(name))[1])::uuid

      else
        null

    end

  )

);


-- ============================================================
-- 4. STORAGE SELECT
--
-- The bucket is public for receipt rendering/printing, while
-- authenticated listing remains tenant scoped.
-- ============================================================

drop policy if exists
nova_receipt_assets_select
on storage.objects;

create policy
nova_receipt_assets_select

on storage.objects

for select

to authenticated

using (

  bucket_id =
    'receipt-assets'

  and

  private.is_business_member(

    case

      when
        (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

      then
        ((storage.foldername(name))[1])::uuid

      else
        null

    end

  )

);


-- ============================================================
-- 5. STORAGE DELETE
-- Owner / Manager only.
-- ============================================================

drop policy if exists
nova_receipt_assets_delete
on storage.objects;

create policy
nova_receipt_assets_delete

on storage.objects

for delete

to authenticated

using (

  bucket_id =
    'receipt-assets'

  and

  private.is_business_manager(

    case

      when
        (storage.foldername(name))[1]
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'

      then
        ((storage.foldername(name))[1])::uuid

      else
        null

    end

  )

);


-- ============================================================
-- 6. RECEIPT SETTINGS UPDATE HARDENING
--
-- Reading stays available to business members because cashiers
-- need receipt settings while printing a sale.
--
-- Updating receipt configuration is Owner / Manager only.
-- ============================================================

drop policy if exists
nova_receipt_settings_update
on public.receipt_settings;

create policy
nova_receipt_settings_update

on public.receipt_settings

for update

to authenticated

using (

  (
    select private.is_business_manager(
      business_id
    )
  )

)

with check (

  (
    select private.is_business_manager(
      business_id
    )
  )

);


-- ============================================================
-- 7. POSTGREST REFRESH
-- ============================================================

notify pgrst,
'reload schema';
