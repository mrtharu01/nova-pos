# NOVA POS

A mobile-first Point of Sale system built with Next.js, TypeScript, Tailwind CSS, Zustand and Supabase.

## Current stage — Phase 3B

NOVA now has a live Supabase-backed owner workspace plus real product, variant and inventory management.

Implemented foundation:

- responsive POS UI
- cart and explicit variant selection
- QR/SKU scan-value resolution
- light/dark/system themes
- cookie-based Supabase Auth + protected routes
- owner onboarding + default Main inventory location
- businesses + staff-aware RLS
- category creation
- product create/edit/archive-status workflow
- multi-variant SKU/price/cost management
- permanent UUID QR token per variant
- initial stock recording for new variants
- audited inventory adjustments
- inventory movement history
- shared live catalog used by POS, Products, Inventory, Scan, Dashboard and QR screens

## Run locally

```bash
npm install
```

Copy `.env.example` to `.env.local` and set your NOVA Supabase project URL + publishable key.

After Phase 3A is complete, live mode should be:

```text
NEXT_PUBLIC_NOVA_DEMO_MODE="false"
```

Then:

```bash
npm run dev
```

## Supabase install order

Run the SQL files in this order:

1. `supabase/phase2_catalog_inventory.sql`
2. `supabase/phase3a_auth_onboarding.sql`
3. `supabase/phase3b_product_inventory_crud.sql`

Verification helpers are also included.

Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable.

## Product/inventory safety rule

Product editing does **not** directly overwrite existing stock. Existing stock changes are performed through the Inventory screen and `adjust_inventory()` so every change has before/after quantities, a reason, actor and timestamp.

See `PHASE-3B-NOTES.md` for the test procedure.
