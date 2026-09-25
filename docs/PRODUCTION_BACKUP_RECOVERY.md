# ARC Production Backup & Recovery Runbook

This runbook is the operational companion to the ARC Control **Backups** page.

## Recovery layers

ARC uses four separate recovery layers:

1. **Supabase managed database backup**
2. **Independent logical database dump**
3. **Supabase Storage object backup**
4. **Tenant-scoped ARC export**

A backup is not considered production-ready until a restore has been tested in an isolated environment.

## 1. Supabase managed database backup

For paid Supabase projects, confirm the project has a current managed backup in **Supabase Dashboard → Database → Backups**.

Point-in-Time Recovery can be considered later when the production risk / transaction volume justifies the additional cost.

Do not treat the managed database backup as a Storage backup. Database backups contain Storage metadata but not the actual object bytes.

## 2. Independent logical database dump

Use the Supabase CLI with the project connection string:

    supabase db dump --db-url "[CONNECTION_STRING]" -f roles.sql --role-only
    supabase db dump --db-url "[CONNECTION_STRING]" -f schema.sql
    supabase db dump --db-url "[CONNECTION_STRING]" -f data.sql --use-copy --data-only

Store the resulting files outside the Supabase project.

Before calling the dump production-ready:

- encrypt the backup archive using a strong unique passphrase
- store at least one copy off-site
- calculate / retain a checksum
- record the completed database dump in **ARC Control → Backups**

Never commit database connection strings, database passwords, secret keys, backup passwords, or dump files to Git.

## 3. Storage backup

ARC private application Storage currently includes `product-images`, `receipt-assets`, and `profile-avatars`.

Storage object bytes must be copied separately from the database backup. Keep the original bucket name and object path. After completing the copy, record a **Storage snapshot** event in ARC Control.

## 4. Tenant export

From **ARC Control → Backups → Tenant exports**, download a JSON export for the business.

`ARC_TENANT_EXPORT_V1` contains business data, tenant-owned tables, owner/staff account IDs and emails, subscription metadata, and a product/receipt Storage object manifest.

It deliberately excludes passwords, API keys, secret keys, and Storage object bytes.

## Restore test

Perform the test in a disposable / isolated environment, never directly against the live ARC project.

Minimum validation after restore:

- expected public tables exist
- Auth users / account relationships are present as expected
- business and staff relationships are intact
- products, variants, inventory and customers match
- sales, payments, refunds, voids and expenses match
- receipt/report settings and subscription assignment match
- private Storage buckets and object paths are restored
- RLS, functions and triggers remain active
- cross-tenant isolation still passes
- one test POS checkout succeeds

When the test passes, record a **Restore test — Success** event in ARC Control.

## Production migration policy

After the first permanent production data is entered:

- migrations are forward-only
- do not edit an already-applied production migration to change its meaning
- create a new migration for every correction
- take / verify a backup before destructive or high-risk database changes
- test recovery before depending on a new backup strategy

## Handoff gate

Do not hand ARC to the first permanent production tenant until all of these are true:

- managed database backup available
- independent logical database dump completed
- dump encrypted and copied off-site
- Storage snapshot completed
- tenant JSON export downloaded
- isolated restore test passed
- recovery events recorded in ARC Control
