export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_NOVA_DEMO_MODE !== "false";
}

export function getConfiguredBusinessId() {
  return process.env.NEXT_PUBLIC_NOVA_BUSINESS_ID?.trim() || null;
}
