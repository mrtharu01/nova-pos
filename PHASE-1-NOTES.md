# Nova POS — Phase 1 Foundation

This build is intentionally still using mock data. Real Supabase tables, authentication, sales transactions, inventory movements, receipts, expenses, QR generation and camera decoding are not connected yet.

## Foundation fixes applied

- Real light / dark / system theme state.
- Fixed mobile `/scan` and `/more` routes.
- QR scanner mock no longer auto-adds the same SKU repeatedly.
- Added manual/demo scan controls and duplicate-scan debounce.
- POS search now supports SKU as well as product name.
- Multi-variant products require variant selection instead of silently choosing the first variant.
- Cart quantity is constrained by available mock stock.
- Updated application metadata for Nova POS.

## Next phase

Design and implement the Supabase schema and replace mock product/inventory reads first. Do not connect checkout writes until the product, variant and inventory model is stable.
