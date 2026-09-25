"use client";

import {
  createBrowserClient,
} from "@supabase/ssr";

import {
  isSupabaseConfigured,
} from "@/lib/supabase/config";

import {
  PLATFORM_AUTH_COOKIE,
} from "@/lib/supabase/platform-auth-config";


export function createPlatformClient() {
  if (
    !isSupabaseConfigured()
  ) {
    throw new Error(
      "Supabase is not configured. Check the NOVA environment variables.",
    );
  }


  return createBrowserClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        name:
          PLATFORM_AUTH_COOKIE,
      },

      isSingleton:
        false,
    },
  );
}
