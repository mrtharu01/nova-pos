# ARC

ARC is a production-oriented, mobile-first Point of Sale and retail operations system built with Next.js, TypeScript, Tailwind CSS, Zustand and Supabase.

The repository is currently in **pre-handoff / production-readiness**. Development work is performed on `development`; `main` should only receive reviewed, accepted releases.

## Core capabilities

ARC currently includes:

- POS checkout with cash, card and bank-transfer tender flows
- physical card-terminal confirmation workflow with optional terminal reference
- real product, category and variant management
- Excel/CSV bulk catalog import
- manufacturer barcode + ARC-generated Code 128 support
- permanent ARC QR identity per variant
- local camera scan + remote phone scanner
- FIFO inventory cost and selling-price batches
- cashier-selectable price batches
- optional pack / loose-unit inventory conversion
- supplier bonus/free-stock receiving support
- stock adjustments with movement history
- customer accounts, permanent discounts and loyalty
- refunds, restocking and voids
- receipts and configurable receipt branding
- financial reporting and expenses
- staff roles and permissions
- account profile/avatar management
- multi-tenant database guardrails
- subscription/package surfaces
- ARC Control platform administration
- backup/recovery tracking and tenant exports
- production-readiness / handoff gates

Historical database identifiers using the old `nova_*` naming and the legacy `NOVA:V1:` QR prefix are intentionally retained for compatibility. User-facing branding is ARC.

## Local development

Use **Node.js 24+**.

Install dependencies:

```bash
npm install
```

Copy `.env.example` to `.env.local` and configure the environment.

Production/live catalog mode must use:

```text
NEXT_PUBLIC_ARC_DEMO_MODE=false
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Production-like local validation:

```bash
npm run clean
npm run build
npm run start
```

Quality checks:

```bash
npm run lint
npm run build
```

## Environment variables

Browser-safe:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_ARC_DEMO_MODE=false
NEXT_PUBLIC_ARC_PUBLIC_URL=
```

Server-only:

```text
SUPABASE_SECRET_KEY=
ARC_PLATFORM_PORTAL_KEY=
```

Never prefix a secret/service-role key or the ARC platform portal key with `NEXT_PUBLIC_`.

`NEXT_PUBLIC_ARC_PUBLIC_URL` should be the canonical HTTPS ARC URL when the remote phone scanner must work across devices. When blank, ARC uses the current browser origin.

## Branch / release workflow

- `development` is the working and validation branch.
- CI runs lint + production build on `development` and `main`.
- Review and acceptance happen before any merge to `main`.
- Never make destructive production database changes without a verified backup.
- After permanent production data begins, database changes are forward-only migrations.

## Database

All Supabase migrations, verification scripts and final audit helpers are in `supabase/`.

For an **existing ARC database**, do not blindly replay the entire migration history. Apply only migrations that have not already been installed, then run their matching verification scripts.

For the current pre-handoff workflow see:

- `supabase/preproduction_test_data_reset.sql`
- `supabase/preproduction_test_data_reset_verify.sql`
- `supabase/pre_handoff_integrity_audit.sql`
- `supabase/pre_handoff_security_audit.sql`
- `docs/HANDOFF.md`
- `docs/PRODUCT_IMPORT.md`
- `docs/PRODUCTION_BACKUP_RECOVERY.md`

## Inventory safety

Existing stock is never silently overwritten from Product Edit. Stock changes are handled through Inventory so ARC preserves quantity-before/after, actor, reason and FIFO history.

Incoming deliveries create FIFO batches. Old stock retains its original cost and selling price until consumed.

Pack/loose conversions transform stock between configured variants while preserving FIFO-derived cost.

Supplier bonus stock such as **buy 12 + 1 free** is received as 13 physical units using the real invoice cost spread across the entire batch, while the original paid/free quantities remain auditable.

## Product removal

Products with no meaningful history may be deleted. Products with stock/history are normally archived rather than destructively removed so sales, inventory movements, refunds and audit records remain valid.

Before first production import, test data can instead be removed using the dedicated business-scoped pre-production reset helper documented in `docs/HANDOFF.md`.

## Security model

ARC fails closed when Supabase configuration is missing.

Tenant data is protected by RLS and database-resolved business membership. Manager/owner-only mutations are enforced in database RPCs rather than trusted solely to the browser.

The hidden ARC Control portal uses a separate platform-admin auth cookie plus the server-only portal key.

Remote scanner access is intentionally limited to its pairing/session contracts.

## Backup and recovery

Read `docs/PRODUCTION_BACKUP_RECOVERY.md` before handoff. A backup is not considered usable until a restore has been tested in an isolated environment.

## Handoff

The definitive pre-handoff procedure is in:

```text
docs/HANDOFF.md
```

Do not merge `development` into `main` or begin permanent production transactions until that checklist has been completed.
