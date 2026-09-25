import "server-only";

import {
  createClient,
} from "@supabase/supabase-js";


export function createAdminClient() {
  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.trim();


  const secret =
    (
      process.env
        .SUPABASE_SECRET_KEY ??
      process.env
        .SUPABASE_SERVICE_ROLE_KEY
    )
      ?.trim();


  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is missing.",
    );
  }


  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY is missing.",
    );
  }


  if (
    secret.startsWith(
      "sb_publishable_",
    )
  ) {
    throw new Error(
      "SUPABASE_SECRET_KEY contains a publishable key. Configure a Supabase Secret key instead.",
    );
  }


  return createClient(
    url,
    secret,
    {
      auth: {
        autoRefreshToken:
          false,

        persistSession:
          false,

        detectSessionInUrl:
          false,
      },
    },
  );
}
