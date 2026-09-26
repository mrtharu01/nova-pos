-- ============================================================
-- NOVA POS — PHASE 1D RECEIPT LOGO VERIFY
-- Run AFTER phase1d_receipt_logo.sql.
-- Read-only verification.
-- ============================================================


-- 1. Logo columns must exist.
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'receipt_settings'
  and column_name in (
    'logo_url',
    'logo_path'
  )
order by column_name;


-- 2. Receipt asset bucket must be public and WebP-only.
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'receipt-assets';


-- 3. Storage policies must exist.
select
  policyname,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'nova_receipt_assets_insert',
    'nova_receipt_assets_select',
    'nova_receipt_assets_delete'
  )
order by policyname;


-- 4. Receipt settings manager update policy must exist.
select
  policyname,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'receipt_settings'
  and policyname = 'nova_receipt_settings_update';
