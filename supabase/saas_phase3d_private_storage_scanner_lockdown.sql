-- ============================================================
-- NOVA POS
-- SaaS Phase 3D — Private tenant storage + scanner lockdown
-- ============================================================
--
-- Run ONLY after the Phase 3C frontend is deployed and verified:
--   • product images load through signed URLs
--   • receipt logos load through signed URLs
--   • remote scanner create/close uses RPCs
-- ============================================================


-- ============================================================
-- 1. REMOVE STALE MANAGED PUBLIC URLS
-- ============================================================

update public.products
set image_url = null
where image_path is not null
  and btrim(image_path) <> '';


update public.receipt_settings
set logo_url = null
where logo_path is not null
  and btrim(logo_path) <> '';



-- ============================================================
-- 2. MAKE TENANT ASSET BUCKETS PRIVATE
-- ============================================================

update storage.buckets
set public = false
where id in (
  'product-images',
  'receipt-assets'
);



-- ============================================================
-- 3. LOCK REMOTE SCANNER TABLE
--
-- The browser now uses:
--   create_remote_scanner_session()
--   close_remote_scanner_session()
--
-- Anonymous phones use only:
--   resolve_remote_scanner_session(text)
-- ============================================================

revoke all
on public.remote_scanner_sessions
from anon,
authenticated;



-- ============================================================
-- 4. KEEP ONLY THE INTENDED RPC SURFACE
-- ============================================================

revoke all
on function
public.create_remote_scanner_session()
from public,
anon;


grant execute
on function
public.create_remote_scanner_session()
to authenticated;


revoke all
on function
public.close_remote_scanner_session(uuid)
from public,
anon;


grant execute
on function
public.close_remote_scanner_session(uuid)
to authenticated;


revoke all
on function
public.resolve_remote_scanner_session(text)
from public;


grant execute
on function
public.resolve_remote_scanner_session(text)
to anon,
authenticated;



notify pgrst,
'reload schema';
