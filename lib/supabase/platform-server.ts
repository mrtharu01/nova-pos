import "server-only";

import {
  createServerClient,
} from "@supabase/ssr";

import {
  cookies,
} from "next/headers";

import {
  isSupabaseConfigured,
} from "@/lib/supabase/config";

import {
  PLATFORM_AUTH_COOKIE,
} from "@/lib/supabase/platform-auth-config";


export async function createPlatformServerClient() {
  if (
    !isSupabaseConfigured()
  ) {
    throw new Error(
      "Supabase is not configured. Check the NOVA environment variables.",
    );
  }


  const cookieStore =
    await cookies();


  return createServerClient(
    process.env
      .NEXT_PUBLIC_SUPABASE_URL!,
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: {
        name:
          PLATFORM_AUTH_COOKIE,
      },

      cookies: {
        getAll() {
          return cookieStore
            .getAll();
        },

        setAll(
          cookiesToSet,
        ) {
          try {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                cookieStore.set(
                  name,
                  value,
                  options,
                );
              },
            );
          } catch {
            // Server Components cannot always write cookies.
            // The proxy refreshes the isolated platform session.
          }
        },
      },
    },
  );
}
