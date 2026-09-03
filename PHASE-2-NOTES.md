# NOVA POS — Phase 2 Notes

## Added

- Supabase client utilities using `@supabase/ssr`
- Demo/live catalog switch
- shared `useCatalog()` hook
- dynamic categories from database data
- permanent QR token format: `NOVA:V1:<uuid>`
- Supabase SQL foundation for businesses, staff, catalog and inventory
- RLS + explicit grants
- security-invoker catalog view
- `bootstrap_business()` onboarding helper
- atomic `adjust_inventory()` RPC
- database-backed read path for POS, Products, Inventory, Scan, Dashboard low-stock alerts and QR page

## Intentionally not activated yet

The only connected Supabase project currently available is the Nenasala project. NOVA POS must not share that database, so this phase does not apply the schema remotely.

Demo Mode remains on until a dedicated NOVA Supabase project and owner authentication are created.

## Dependency note

The stale AI Studio `bun.lock` was removed because it still referenced deleted Gemini/Firebase dependencies and did not contain Supabase. Run `npm install` locally to generate a fresh `package-lock.json` before deployment.

## Next phase

Owner authentication + business bootstrap, followed by real Product CRUD and stock adjustment UI.
