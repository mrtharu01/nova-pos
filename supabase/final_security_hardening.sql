-- ============================================================
-- NOVA POS
-- FINAL SECURITY HARDENING
-- ============================================================


-- ============================================================
-- 1. ANONYMOUS USERS MUST HAVE NO DIRECT TABLE ACCESS
-- ============================================================
--
-- Remote scanner anonymous access goes through the dedicated
-- resolve_remote_scanner_session() RPC, not direct table access.
--

revoke all privileges
on all tables
in schema public
from anon;



-- ============================================================
-- 2. REMOVE DATABASE-ADMIN STYLE PRIVILEGES FROM APP USERS
-- ============================================================
--
-- NOVA never needs authenticated browser users to:
--   TRUNCATE tables
--   create/use triggers
--   create foreign-key references
--

revoke
  truncate,
  trigger,
  references
on all tables
in schema public
from authenticated;



-- ============================================================
-- 3. CUSTOMERS
-- ============================================================
--
-- Customer mutations must use NOVA RPCs such as:
--   save_customer()
--   adjust_customer_loyalty()
--
-- Direct SELECT remains available and is protected by RLS.
--

revoke
  insert,
  update,
  delete
on public.customers
from authenticated;



-- ============================================================
-- 4. LOYALTY SETTINGS
-- ============================================================
--
-- Members may read.
-- Managers may update.
-- Creation is handled by NOVA bootstrap/default mechanisms.
--

revoke
  insert,
  delete
on public.loyalty_settings
from authenticated;



-- ============================================================
-- 5. LOYALTY TRANSACTIONS
-- ============================================================
--
-- Loyalty ledger mutations must only happen through trusted
-- checkout / loyalty RPCs.
--

revoke
  insert,
  update,
  delete
on public.loyalty_transactions
from authenticated;



-- ============================================================
-- 6. REFUND TABLES
-- ============================================================
--
-- Refund and void records must only be created through:
--
--   refund_sale()
--   void_sale()
--
-- Authenticated business members may still SELECT them
-- through RLS.
--

revoke
  insert,
  update,
  delete
on public.sale_refunds
from authenticated;


revoke
  insert,
  update,
  delete
on public.sale_refund_items
from authenticated;


revoke
  insert,
  update,
  delete
on public.sale_voids
from authenticated;



-- ============================================================
-- 7. REPORT SETTINGS
-- ============================================================
--
-- Report settings support SELECT / INSERT / UPDATE.
-- There is no need for clients to delete the row.
--

revoke delete
on public.report_settings
from authenticated;



-- ============================================================
-- 8. REMOVE PUBLIC EXECUTE FROM INTERNAL HELPERS
-- ============================================================

revoke execute
on function
private.create_business_loyalty_settings()
from public;


revoke execute
on function
private.create_default_report_settings()
from public;


revoke execute
on function
private.normalize_customer_phone(text)
from public;


revoke execute
on function
private.nova_create_receipt_settings()
from public;


revoke execute
on function
private.nova_touch_expense_updated_at()
from public;


revoke execute
on function
private.nova_touch_updated_at()
from public;


revoke execute
on function
private.prepare_customer_record()
from public;


revoke execute
on function
public.set_updated_at()
from public;


-- Explicitly remove the old API-role grants too.
revoke execute
on function
public.set_updated_at()
from anon;


revoke execute
on function
public.set_updated_at()
from authenticated;



-- ============================================================
-- IMPORTANT FUNCTIONS WE INTENTIONALLY KEEP
-- ============================================================
--
-- DO NOT revoke:
--
-- authenticated:
--   complete_sale()
--   refund_sale()
--   void_sale()
--   save_customer()
--   lookup_customer_by_phone()
--   list_customers()
--   get_customer_detail()
--   adjust_customer_loyalty()
--   update_loyalty_settings()
--   add_business_staff()
--   update_business_staff()
--   list_business_staff()
--   get_dashboard_report()
--   get_expense_report()
--   get_my_business_access()
--   save_product()
--   adjust_inventory()
--   etc.
--
-- anon + authenticated:
--   resolve_remote_scanner_session(text)
--
-- The anonymous scanner resolver is intentional.
-- ============================================================


notify pgrst,
'reload schema';