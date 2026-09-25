-- ============================================================
-- ARC
-- Brand data cleanup
-- ============================================================
--
-- Forward-only cleanup for user-visible values that were stored
-- in the database before the NOVA -> ARC product rename.
-- Internal schema / enum / function identifiers intentionally
-- remain unchanged to avoid unnecessary production risk.
-- ============================================================


-- Commercial plan descriptions are rendered directly in the
-- tenant and platform plan UIs.
update public.subscription_plans

set
  description =
    replace(
      description,
      'NOVA',
      'ARC'
    )

where
  description like
    '%NOVA%';


-- Printable report defaults are persisted per tenant.
alter table
public.report_settings

alter column
footer_message

set default
  'Thank you for using ARC.';


update public.report_settings

set
  footer_message =
    'Thank you for using ARC.'

where
  footer_message =
    'Thank you for using NOVA POS.';


notify pgrst,
'reload schema';
