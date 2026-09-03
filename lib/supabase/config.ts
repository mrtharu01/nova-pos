export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isDemoMode() {
  /*
   * Production-safe behaviour:
   *
   * Demo Mode is OFF by default.
   *
   * It can only be enabled intentionally with:
   *
   * NEXT_PUBLIC_NOVA_DEMO_MODE=true
   */
  return (
    process.env.NEXT_PUBLIC_NOVA_DEMO_MODE ===
    "true"
  );
}

export function getConfiguredBusinessId() {
  return (
    process.env.NEXT_PUBLIC_NOVA_BUSINESS_ID?.trim() ||
    null
  );
}