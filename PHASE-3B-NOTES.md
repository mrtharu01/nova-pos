# NOVA POS — Phase 3B

## Goal
Move catalog and inventory management from read-only Supabase data to real business CRUD without bypassing inventory audit history.

## Added
- Real **Add Product** route: `/products/new`.
- Real **Edit Product** route: `/products/[id]`.
- Product fields: name, description, category, status, optional image URL.
- Inline category creation.
- Multi-variant editor with SKU, price, cost, active state and low-stock threshold.
- Initial stock for newly created variants only.
- Existing stock is intentionally read-only in Product Edit; stock changes must go through Inventory so every change is audited.
- Permanent QR identity remains database-generated per new variant.
- Product list now links to edit screens and searches product/category/SKU.
- Real inventory-adjustment dialog with Stock In, Stock Out, Return, Damage, Loss and Manual Correction flows.
- Inventory history page at `/inventory/history`.
- `create_category()` RPC.
- `save_product()` RPC that atomically creates/updates products + variants and creates initial inventory records/movements for new variants.
- `inventory_movement_details` security-invoker view for readable audit history.
- `phase3b_verify.sql` helper.

## Why products are archived instead of hard-deleted
Once a variant has inventory history and later sales history, destructive deletion becomes dangerous. NOVA uses product status (`Active`, `Draft`, `Archived`) as the normal removal path. This preserves historical receipts, stock movements and QR identity.

## Required Supabase step
Run this after Phase 2 and Phase 3A are already installed:

`supabase/phase3b_product_inventory_crud.sql`

Then optionally run:

`supabase/phase3b_verify.sql`

Expected first verification row:
- `create_category_exists = true`
- `save_product_exists = true`
- `inventory_history_view_exists = true`

## First real product test
1. Sign into NOVA.
2. Open **Products**.
3. Click **Add Product**.
4. Create a category if needed.
5. Enter one or more variants, each with a unique SKU.
6. Give a new variant some initial stock.
7. Save.
8. Confirm it appears in **Products**, **Inventory**, **POS**, **QR Codes** and **Scan** lookup.
9. Open **Inventory**, adjust the stock, then verify the movement in **Inventory History**.

## Not included yet
- Supabase Storage product-image uploads.
- Hard-delete products/variants (intentionally avoided).
- Sales/checkout database tables and transactional stock deduction.
- Refunds/returns tied to actual sales.
- Thermal receipt output.

Those belong to the next sales/checkout phase.
