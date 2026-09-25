-- ============================================================
-- DEPRECATED — DO NOT RUN
-- ============================================================
--
-- This early Phase 4 draft modeled "Lifetime Free" as a plan.
-- NOVA's corrected architecture keeps only:
--
--   Starter
--   Pro
--   Business
--
-- Complimentary access (including a lifetime complimentary
-- grant for a specific tenant) is a billing override attached
-- to a normal plan, not a separate plan.
--
-- The corrected subscription migration is being introduced in
-- SaaS Phase 4B after the platform-admin foundation.
-- ============================================================

do $$
begin
  raise exception
    'Deprecated NOVA Phase 4 draft. Do not run this file. Use the corrected Phase 4B subscription migration instead.';
end;
$$;
