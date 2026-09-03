import {
  type EmailOtpType,
} from "@supabase/supabase-js";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";


function safeRedirect(
  request:
    NextRequest,

  destination:
    string | null,
) {
  const origin =
    request.nextUrl.origin;


  if (!destination) {
    return new URL(
      "/",
      origin,
    );
  }


  try {
    const target =
      new URL(
        destination,
        origin,
      );


    if (
      target.origin !==
      origin
    ) {
      return new URL(
        "/",
        origin,
      );
    }


    return target;
  } catch {
    return new URL(
      "/",
      origin,
    );
  }
}


export async function GET(
  request:
    NextRequest,
) {
  const tokenHash =
    request.nextUrl
      .searchParams
      .get(
        "token_hash",
      );


  const type =
    request.nextUrl
      .searchParams
      .get(
        "type",
      ) as
        EmailOtpType |
        null;


  const next =
    request.nextUrl
      .searchParams
      .get(
        "next",
      );


  if (
    tokenHash &&
    type
  ) {
    const supabase =
      await createClient();


    const {
      error,
    } =
      await supabase.auth
        .verifyOtp({
          type,

          token_hash:
            tokenHash,
        });


    if (!error) {
      return NextResponse.redirect(
        safeRedirect(
          request,
          next,
        ),
      );
    }
  }


  const errorUrl =
    new URL(
      "/auth/error",
      request.nextUrl.origin,
    );


  errorUrl.searchParams.set(
    "reason",
    "verification_failed",
  );


  return NextResponse.redirect(
    errorUrl,
  );
}