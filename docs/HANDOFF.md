# ARC Final Handoff Runbook

This is the final operational checklist for moving ARC from development/test data to a real store.

It is intentionally written as one continuous handoff procedure rather than as development phases.

## 1. Freeze the source

Use `development` as the source of truth until acceptance is complete.

Before final validation:

```bash
git checkout development
git pull origin development
npm install
npm run clean
npm run lint
npm run build
```

Do not merge to `main` yet.

## 2. Confirm production environment

Required public variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_ARC_DEMO_MODE=false
NEXT_PUBLIC_ARC_PUBLIC_URL=https://YOUR-ARC-DOMAIN
```

Required server-only variables:

```text
SUPABASE_SECRET_KEY=
ARC_PLATFORM_PORTAL_KEY=
```

Confirm that no secret key is stored in a `NEXT_PUBLIC_` variable.

Use a long random ARC platform portal key.

## 3. Apply only pending database migrations

Do not replay historical migrations on the existing database.

At the current branch, check whether the following newest migrations have already been installed:

```text
supabase/phase8b_supplier_bonus_stock.sql
supabase/phase8b_supplier_bonus_stock_verify.sql

supabase/pre_handoff_tenant_export_current_model.sql
supabase/pre_handoff_tenant_export_current_model_verify.sql
```

Run only the migrations that are still pending, followed by their matching verify files. The tenant-export update is required even if supplier bonus receiving remains unused, because it adds the current FIFO / pack-loose inventory history to ARC Control exports.

The application already expects all earlier accepted migrations through pack/loose inventory (Phase 8A).

## 4. Remove test operational data before the real import

Run:

```text
supabase/preproduction_test_data_reset.sql
supabase/preproduction_test_data_reset_verify.sql
```

The reset file defines SQL-editor-only functions; it does not delete data automatically.

Find the exact target business:

```sql
select id, name
from public.businesses
order by created_at;
```

Preview what exists:

```sql
select private.arc_preproduction_reset_snapshot(
  'BUSINESS_UUID_HERE'::uuid
);
```

Then run the reset with the exact business UUID/name:

```sql
select private.arc_preproduction_reset_business(
  'BUSINESS_UUID_HERE'::uuid,
  'EXACT BUSINESS NAME HERE',
  'RESET ARC TEST DATA',
  true,
  true,
  true,
  true
);
```

This preserves business identity, owner/auth, staff members, inventory locations, receipt/report/loyalty settings, subscription/package state, backup history and profile avatars.

The reset is deliberately blocked if the business is already approved for production handoff. Reopen handoff first if a reset is genuinely required before the store goes live.

It removes test catalog, stock/FIFO history, sales/refunds/voids/payments, customers/loyalty ledger, expenses, remote scanner sessions and pending staff invitations for that business.

Afterward, delete that business UUID folder from **Supabase Storage → product-images** using the Storage UI. Do not delete `storage.objects` rows directly with SQL.

## 5. Import the real catalog

Use **Products → Import** with the completed spreadsheet.

Before importing, check:

- each SKU is unique
- manufacturer barcodes are unique where provided
- product/variant names are correct
- costs and selling prices are correct
- opening stock quantities are real
- categories are consistently named
- pack/loose products are configured intentionally
- blank manufacturer barcode is acceptable when ARC-generated barcode/QR will be used

After import, spot-check several products in Products, Inventory, POS, Barcodes and Scan.

## 6. Validate FIFO and inventory

For ordinary deliveries, confirm Stock In creates a new FIFO batch without changing older stock.

For a two-batch product:

1. receive an older batch at price/cost A
2. receive a newer batch at price/cost B
3. sell through the old batch boundary
4. confirm ARC changes to the newer batch only after the old quantity is consumed

For pack/loose inventory:

1. verify sealed parent and loose child are configured in the correct direction
2. break one parent
3. confirm parent decreases by one
4. confirm child increases by the configured conversion quantity
5. sell one loose unit and verify child stock decreases by one

For supplier bonus stock, when enabled:

1. receive a test such as 12 paid + 1 free
2. confirm physical stock increases by 13
3. confirm invoice cost is based on 12 paid units
4. confirm effective FIFO unit cost is invoice cost / 13
5. confirm the supplier bonus audit row exists

Remove any temporary validation stock before permanent operation.

## 7. Validate checkout

Test each relevant tender:

- cash with exact amount
- cash with change
- physical card terminal manual approval flow
- bank transfer/reference
- registered customer checkout
- customer discount
- loyalty earn
- loyalty redeem

For physical card terminal mode, ARC must not complete a card sale until the cashier confirms the external terminal shows **APPROVED**.

ARC stores only the payment method/reference. Card number, PIN and CVV must never be entered into ARC.

## 8. Validate refunds and voids

Use a disposable test sale and verify:

- partial refund
- full refund
- restock where appropriate
- refund loyalty reversal
- void
- FIFO stock restoration
- original transaction remains auditable

Then clean up only if still operating in test data. Do not erase permanent production transactions.

## 9. Validate receipts, reports and expenses

Confirm:

- receipt business identity
- receipt logo
- 58mm / 80mm output as required
- reprint
- sales/refund/void status display
- report date ranges
- refund-aware totals
- expense entry and report inclusion
- inventory worth reflects FIFO cost

## 10. Validate scanner and barcodes

Confirm:

- SKU search
- manufacturer barcode
- ARC variant barcode
- ARC exact batch barcode
- ARC QR
- local camera scanner
- remote phone scanner over the final HTTPS deployment

The remote phone scanner requires a reachable HTTPS ARC URL; laptop `localhost` cannot be opened from a separate phone.

## 11. Staff and permissions

Verify the real owner/manager/cashier accounts.

Confirm each role can access only the intended screens/actions.

Remove stale invitations and disable test staff accounts rather than sharing production credentials.

## 12. Run final database audits

Run:

```text
supabase/pre_handoff_integrity_audit.sql
supabase/pre_handoff_security_audit.sql
```

Review every result set.

All sections labelled **Expected: zero rows** must be empty.

Also run the verify file for every newly applied migration.

Do not hand over while FIFO quantity differs from inventory quantity, duplicate SKUs/barcodes exist, receipt/refund counters are behind, tenant settings are missing, or security exceptions remain.

## 13. Backup and restore

Follow:

```text
docs/PRODUCTION_BACKUP_RECOVERY.md
```

Before handoff confirm:

- Supabase managed database backup
- independent logical database dump
- encrypted off-site copy
- Storage object backup
- tenant JSON export
- isolated restore test
- recovery events recorded in ARC Control

A backup that has never been restored is not considered verified.

## 14. Final application acceptance

On desktop and phone, test:

- login / logout
- profile
- dashboard
- POS
- products
- product import
- inventory
- inventory history
- barcodes
- QR
- scanner
- customers
- sales details
- refunds/voids
- reports
- expenses
- settings
- staff
- ARC Control

Pay particular attention to long dialogs: there should be one scroll owner, with important action buttons/footers remaining reachable.

## 15. Release

Only after all acceptance work passes:

1. create the final release/PR from `development`
2. review the diff
3. merge to `main`
4. deploy the production branch
5. smoke-test the final production URL
6. record the handoff/backup status in ARC Control

After the first permanent transaction, do not use the pre-production reset against that tenant.
