# ARC Product Import Guide

ARC accepts `.xlsx`, `.csv` and `.tsv` files from **Products → Import**.

For XLSX files ARC reads the first worksheet.

Maximum import size per file: **2,000 product/variant rows**.

## Recommended columns

Use these headers:

| Column | Required | Notes |
| --- | --- | --- |
| `product_key` | No | Use the same value to group several rows as variants of one product. |
| `product_name` | Yes | Customer-facing product name. |
| `category` | No | ARC creates missing categories during import. |
| `description` | No | Product description. |
| `variant_name` | No | Defaults to `Standard`. |
| `sku` | SKU or barcode | Unique inside the business. |
| `barcode` | SKU or barcode | Manufacturer/printed barcode. Optional when a SKU exists. |
| `price` | Yes | Selling price. Must be zero or greater. |
| `cost` | No | Buying/unit cost. Defaults to 0. |
| `stock` | No | Opening stock. Whole number. Defaults to 0. |
| `low_stock_threshold` | No | Whole number. Defaults to 5. |
| `status` | No | `active` or `draft`. Defaults to `active`. |

ARC also recognizes common aliases such as `product`, `name`, `size`, `item_code`, `ean`, `upc`, `selling_price`, `buying_price`, `quantity` and `reorder_level`.

## SKU and barcode rules

Each row needs at least one identity:

- a SKU, or
- a manufacturer barcode.

If a row has a barcode but no SKU, ARC generates an internal SKU using the barcode.

Manufacturer barcodes are optional. ARC can still generate its own permanent QR and Code 128 identity for the variant.

Do not place ARC-generated QR/barcode values into the manufacturer barcode column.

SKUs and manufacturer barcodes must be unique inside the same business.

## Multiple variants

To create multiple variants under one product, repeat the same `product_key`.

Example:

| product_key | product_name | variant_name | sku | price |
| --- | --- | --- | --- | ---: |
| MILK | Fresh Milk | 500ml | MILK-500 | 220 |
| MILK | Fresh Milk | 1L | MILK-1L | 390 |

Without a shared `product_key`, ARC may treat rows as separate products.

## Opening stock

Use the `stock` column only for the real opening quantity that should exist when the catalog goes live.

After the real opening stock is established, future deliveries should be received through **Inventory → Stock In** so FIFO batch history remains accurate.

Do not use spreadsheet re-imports as a way to overwrite existing production stock.

## Pack / loose products

Bulk import currently creates normal variants and opening stock.

For products that are sold both sealed and loose:

1. import/create the parent and child variants
2. open Product Edit
3. enable **Sell in multiple units**
4. mark the loose/smaller unit
5. select the sealed parent
6. enter the conversion quantity

Example: one `Standard Pack` → 18 `Single` units.

## Supplier bonus stock

Do not include future supplier bonuses such as **buy 12 + 1 free** as ordinary opening-stock math.

After the product exists, use **Inventory → Stock In → Supplier bonus / free stock** so ARC records paid quantity, free quantity, invoice cost and effective FIFO cost correctly.

## Before importing the real sheet

Check the spreadsheet for:

- duplicate SKUs
- duplicate manufacturer barcodes
- spelling/case differences in categories
- incorrect selling prices or costs
- non-whole stock quantities
- accidental sample/test rows
- duplicate product rows
- wrong variant grouping

ARC shows a preview and row-level validation before the database import. Fix invalid rows before continuing.

## After import

Spot-check representative items in:

- Products
- Inventory
- POS
- Barcodes
- QR
- Scan

Then run `supabase/pre_handoff_integrity_audit.sql` before final handoff.
