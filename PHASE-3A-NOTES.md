# NOVA POS — Phase 3A

## Added
- Cookie-based Supabase Auth foundation for Next.js 15 + `@supabase/ssr`.
- `middleware.ts` session refresh + route protection using `auth.getClaims()`.
- Demo Mode bypass: mock mode still works without authentication.
- Owner email/password login and signup screens.
- SSR-compatible email confirmation route using `token_hash` + `verifyOtp()`.
- Server-side sign-out endpoint.
- First-business onboarding UI for business name, currency, and timezone.
- `phase3a_auth_onboarding.sql` patch.
- Onboarding RPC now atomically creates:
  1. business,
  2. explicit owner manager staff record,
  3. default Main inventory location.
- Prevents one owner account from accidentally bootstrapping multiple NOVA businesses.
- Fixed missing `is_active` field in the Supabase catalog row TypeScript type.

## Required Supabase dashboard setup
1. Run `supabase/phase3a_auth_onboarding.sql` in SQL Editor.
2. Authentication > URL Configuration:
   - Site URL during local development: `http://localhost:3000`
   - Add `http://localhost:3000/**` as a development redirect URL if needed.
3. Authentication > Email Templates > Confirm signup:
   Replace the confirmation link target with:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/onboarding`
4. Add `.env.local` with the project URL and publishable key.
5. Keep `NEXT_PUBLIC_NOVA_DEMO_MODE="true"` until Auth is configured, then change to `false`.

## Phase 3B target
Real product/category/variant CRUD + inventory adjustment UI against Supabase.
