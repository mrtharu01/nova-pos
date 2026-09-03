# NOVA POS Supabase

Use a dedicated NOVA Supabase project.

## Install order

Run these SQL files in Supabase SQL Editor in order:

1. `phase2_catalog_inventory.sql`
2. `phase3a_auth_onboarding.sql`
3. `phase3b_product_inventory_crud.sql`

Optional verification queries:

- `phase3a_verify.sql`
- `phase3b_verify.sql`

## Current database foundation

- businesses
- staff_members
- categories
- products
- product_variants
- inventory_locations
- inventory_levels
- inventory_movements
- `catalog_variant_inventory` security-invoker view
- `inventory_movement_details` security-invoker view
- `bootstrap_business()` onboarding RPC
- `create_category()` manager RPC
- `save_product()` atomic product/variant RPC
- `adjust_inventory()` atomic inventory RPC
- RLS policies + explicit Data API grants

Every product variant receives a permanent UUID `qr_token`. The encoded QR payload is:

```text
NOVA:V1:<qr_token>
```

Mutable information such as price, cost, stock and product name is never encoded into the QR.

## Security model

- `anon` has no catalog/inventory table access.
- authenticated users are restricted by business membership through RLS.
- catalog/inventory mutation requires manager authority.
- QR token updates are not granted to the regular authenticated application role.
- inventory movement history is append-only from the application.
- both exposed views use `security_invoker = true` so underlying RLS is respected.

Never place a Supabase secret/service-role key in a `NEXT_PUBLIC_` environment variable.

## Database tests

The initial pgTAP structural security suite is in:

```text
supabase/tests/catalog_inventory_security.test.sql
```

Behavioral tests for owner/manager/cashier/non-member access will expand as staff management is implemented.
