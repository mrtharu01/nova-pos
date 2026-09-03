import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { sendNovaTestEmail } from "@/lib/email/send-test-email";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();

  const { data, error: claimsError } =
    await supabase.auth.getClaims();

  const claims = data?.claims;

  if (claimsError || !claims) {
    return NextResponse.json(
      {
        error: "You must be signed in.",
      },
      {
        status: 401,
      },
    );
  }

  const email =
    typeof claims.email === "string"
      ? claims.email.trim()
      : "";

  if (!email) {
    return NextResponse.json(
      {
        error:
          "Your signed-in account does not have an email address.",
      },
      {
        status: 400,
      },
    );
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      {
        error:
          "RESEND_API_KEY is not configured on the server.",
      },
      {
        status: 503,
      },
    );
  }

  try {
    const { data: sent, error } =
      await sendNovaTestEmail(email);

    if (error) {
      console.error(
        "Resend test email failed:",
        error,
      );

      return NextResponse.json(
        {
          error:
            error.message ||
            "Resend rejected the email.",
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json({
      ok: true,
      id: sent?.id ?? null,
      email,
    });
  } catch (error) {
    console.error(
      "Resend test email error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to send the test email.",
      },
      {
        status: 500,
      },
    );
  }
}