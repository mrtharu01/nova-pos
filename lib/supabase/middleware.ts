import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";


const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/check-email",

  "/auth/confirm",
  "/auth/error",

  "/remote-scanner",
];


function isPublicPath(
  pathname: string,
) {
  return PUBLIC_PATHS.some(
    (
      path,
    ) =>
      pathname ===
        path ||
      pathname.startsWith(
        `${path}/`,
      ),
  );
}


function safeNextPath(
  value: string | null,
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }


  if (
    value.startsWith("/login") ||
    value.startsWith("/signup") ||
    value.startsWith("/check-email") ||
    value.startsWith("/auth/") ||
    value.startsWith("/onboarding")
  ) {
    return "/";
  }


  return value;
}


export async function updateSession(
  request: NextRequest,
) {
  /* ==========================================================
     EXPLICIT DEMO MODE ONLY
  ========================================================== */

  if (
    process.env
      .NEXT_PUBLIC_NOVA_DEMO_MODE ===
    "true"
  ) {
    return NextResponse.next({
      request,
    });
  }


  const url =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const key =
    process.env
      .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;


  /* ==========================================================
     FAIL CLOSED
  ========================================================== */

  if (
    !url ||
    !key
  ) {
    return new NextResponse(
      "NOVA POS configuration error. Supabase environment variables are missing.",
      {
        status:
          503,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }


  let response =
    NextResponse.next({
      request,
    });


  const supabase =
    createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },


          setAll(
            cookiesToSet,
          ) {
            cookiesToSet.forEach(
              ({
                name,
                value,
              }) => {
                request.cookies.set(
                  name,
                  value,
                );
              },
            );


            response =
              NextResponse.next({
                request,
              });


            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                response.cookies.set(
                  name,
                  value,
                  options,
                );
              },
            );
          },
        },
      },
    );


  const pathname =
    request.nextUrl.pathname;


  const publicPath =
    isPublicPath(
      pathname,
    );


  /* ==========================================================
     REMOTE SCANNER

     Anonymous by design.
  ========================================================== */

  if (
    pathname ===
      "/remote-scanner" ||
    pathname.startsWith(
      "/remote-scanner/",
    )
  ) {
    response.headers.set(
      "Cache-Control",
      "private, no-store",
    );


    return response;
  }


  /* ==========================================================
     AUTH SESSION
  ========================================================== */

  const {
    data:
      claimsData,

    error:
      claimsError,
  } =
    await supabase.auth
      .getClaims();


  const isAuthenticated =
    !claimsError &&
    Boolean(
      claimsData?.claims
        ?.sub,
    );


  /* ==========================================================
     UNAUTHENTICATED
  ========================================================== */

  if (
    !isAuthenticated
  ) {
    if (
      publicPath
    ) {
      return response;
    }


    const redirectUrl =
      request.nextUrl.clone();


    redirectUrl.pathname =
      "/login";


    redirectUrl.search =
      "";


    redirectUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );


    return NextResponse.redirect(
      redirectUrl,
    );
  }


  /* ==========================================================
     AUTHENTICATED LOGIN/SIGNUP/CHECK-EMAIL

     Centralize routing through /auth/continue.
  ========================================================== */

  if (
    publicPath &&
    !pathname.startsWith(
      "/auth/",
    )
  ) {
    const next =
      safeNextPath(
        request.nextUrl
          .searchParams
          .get(
            "next",
          ),
      );


    const continueUrl =
      new URL(
        "/auth/continue",
        request.url,
      );


    if (
      next !== "/"
    ) {
      continueUrl.searchParams.set(
        "next",
        next,
      );
    }


    return NextResponse.redirect(
      continueUrl,
    );
  }


  /* ==========================================================
     CURRENT BUSINESS ACCESS
  ========================================================== */

  const {
    data:
      businessRows,

    error:
      businessError,
  } =
    await supabase
      .from(
        "businesses",
      )
      .select(
        "id",
      )
      .limit(
        1,
      );


  /*
   * Do not silently treat a database error as "no business".
   */

  if (
    businessError
  ) {
    return new NextResponse(
      "NOVA POS could not verify business access.",
      {
        status:
          503,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }


  const hasBusiness =
    Boolean(
      businessRows?.length,
    );


  /* ==========================================================
     AUTH ROUTES

     These need to remain reachable before business access exists:

     /auth/continue
     /auth/setup-password
     /auth/reset-password
     /auth/signout
  ========================================================== */

  const isAuthRoute =
    pathname.startsWith(
      "/auth/",
    );


  if (
    !hasBusiness &&
    pathname !==
      "/onboarding" &&
    !isAuthRoute
  ) {
    const continueUrl =
      new URL(
        "/auth/continue",
        request.url,
      );


    const requestedPath =
      `${pathname}${request.nextUrl.search}`;


    const next =
      safeNextPath(
        requestedPath,
      );


    if (
      next !== "/"
    ) {
      continueUrl.searchParams.set(
        "next",
        next,
      );
    }


    return NextResponse.redirect(
      continueUrl,
    );
  }


  /* ==========================================================
     BUSINESS MEMBER SHOULD NOT SEE OWNER ONBOARDING
  ========================================================== */

  if (
    hasBusiness &&
    pathname ===
      "/onboarding"
  ) {
    return NextResponse.redirect(
      new URL(
        "/",
        request.url,
      ),
    );
  }


  response.headers.set(
    "Cache-Control",
    "private, no-store",
  );


  return response;
}