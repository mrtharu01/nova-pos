# ARC Supabase

ARC uses Supabase for PostgreSQL, Auth, Storage and Realtime.

## Existing database rule

Do **not** rerun the entire migration folder against an existing ARC database.

Migrations in this repository are historical, forward-only steps. For a database that has already followed the project development, apply only the new/unapplied SQL files and run their matching verification helpers.

The current newest feature / handoff migrations are:

```text
phase8b_supplier_bonus_stock.sql
phase8b_supplier_bonus_stock_verify.sql

pre_handoff_tenant_export_current_model.sql
pre_handoff_tenant_export_current_model_verify.sql
```

The final pre-handoff helpers are:

```text
preproduction_test_data_reset.sql
preproduction_test_data_reset_verify.sql
pre_handoff_integrity_audit.sql
pre_handoff_security_audit.sql
```

## Current database areas

ARC currently stores and protects:

- businesses, staff and staff invitations
- categories, products and variants
- inventory locations, levels and movements
- FIFO inventory price/cost batches
- pack/loose conversion audit events
- supplier bonus/free-stock audit events
- sales, sale items and payments
- refunds, refund items and void audit records
- customers and loyalty ledger/settings
- receipt/report settings
- expenses
- remote scanner sessions
- subscription/package state
- platform backup/recovery events
- production-handoff state

Storage includes tenant-scoped product images, receipt assets and private profile avatars.

## Compatibility identifiers

Some database objects retain legacy `nova_*` names and the original permanent QR payload prefix:

```text
NOVA:V1:<qr_token>
```

These are internal compatibility contracts and must not be renamed casually. ARC-generated Code 128 identities use the current ARC formats.

## Security rules

- `anon` does not receive general tenant-table access.
- authenticated users are restricted by RLS and database-resolved tenant membership.
- owner/manager mutations are checked inside security-definer RPCs.
- security-definer functions use a fixed empty `search_path`.
- ordinary application users cannot execute the pre-production destructive reset helper.
- inventory movement history and sales history are not edited directly from the application.
- private Storage assets are resolved through signed URLs or deliberately scoped policies.

Never expose a Supabase secret/service-role key through a `NEXT_PUBLIC_` environment variable.

## Test-data reset

Before importing the permanent first catalog, use:

```text
preproduction_test_data_reset.sql
```

The script only **defines** a protected SQL-editor helper. It does not reset anything automatically.

It requires the target business UUID, the exact business name and the confirmation phrase:

```text
RESET ARC TEST DATA
```

This prevents an accidental cross-tenant/global cleanup. The reset also fails closed if the target business has already been approved for production handoff.

Product-image bytes are intentionally not deleted directly with SQL. Remove the target business folder through Supabase Storage so physical objects are deleted correctly.

## Final audits

After real products/opening stock are loaded, run:

```text
pre_handoff_integrity_audit.sql
pre_handoff_security_audit.sql
```

Exception result sets should be empty before handoff.

Also run all verification scripts associated with newly applied migrations.

## Backup policy

After permanent production data begins:

- use forward-only migrations
- verify a database backup before destructive/high-risk changes
- back up Storage object bytes separately from the database
- keep an independent encrypted logical dump
- test restoration in an isolated environment

See `docs/PRODUCTION_BACKUP_RECOVERY.md`.
