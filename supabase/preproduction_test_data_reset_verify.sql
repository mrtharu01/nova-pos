-- ============================================================
-- ARC POS
-- PRE-PRODUCTION TEST DATA RESET — VERIFY
-- READ-ONLY
--
-- This file does not modify tenant data.
-- ============================================================


-- Reset helpers exist.
select
  to_regprocedure(
    'private.arc_preproduction_reset_snapshot(uuid)'
  )
    as reset_snapshot_function,

  to_regprocedure(
    'private.arc_preproduction_reset_business(uuid,text,text,boolean,boolean,boolean,boolean)'
  )
    as reset_function;


-- Dangerous reset RPC must NOT be callable by application roles.
-- The reset function also blocks execution when the target business
-- already has an approved production handoff.
select
  has_function_privilege(
    'anon',
    'private.arc_preproduction_reset_business(uuid,text,text,boolean,boolean,boolean,boolean)',
    'EXECUTE'
  )
    as anon_can_reset,

  has_function_privilege(
    'authenticated',
    'private.arc_preproduction_reset_business(uuid,text,text,boolean,boolean,boolean,boolean)',
    'EXECUTE'
  )
    as authenticated_can_reset;


-- Expected:
--   reset_snapshot_function = non-null
--   reset_function          = non-null
--   anon_can_reset          = false
--   authenticated_can_reset = false


-- ------------------------------------------------------------
-- AFTER running a tenant reset, use:
--
-- select private.arc_preproduction_reset_snapshot(
--   'BUSINESS_UUID_HERE'::uuid
-- );
--
-- Expected operational counts:
--   products                0
--   variants                0
--   categories              0   (if reset_categories=true)
--   inventoryLevels         0
--   inventoryMovements      0
--   fifoBatches             0
--   unitBreaks              0   (when table exists)
--   supplierBonusReceipts   0   (when table exists)
--   sales                   0
--   payments                0
--   customers               0   (if reset_customers=true)
--   loyaltyTransactions     0
--   expenses                0   (if reset_expenses=true)
--   remoteScannerSessions   0
--
-- Preserved counts:
--   activeStaff             should remain
--   inventoryLocations      should remain
-- ------------------------------------------------------------


-- Product images are intentionally not deleted through SQL.
-- List any remaining files for a target business before deleting
-- the folder through Supabase Storage UI:
--
-- select
--   name,
--   created_at
-- from storage.objects
-- where
--   bucket_id = 'product-images'
--   and
--   name like
--     'BUSINESS_UUID_HERE/%'
-- order by created_at;
