import {
  createServerClient,
} from "@supabase/ssr";

import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  PLATFORM_AUTH_COOKIE,
} from "@/lib/supabase/platform-auth-config";


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
    value.startsWith("/onboarding") ||
    value.startsWith("/internal/")
  ) {
    return "/";
  }


  return value;
}


function createCookieBackedClient({
  request,
  responseRef,
  url,
  key,
  cookieName,
}: {
  request:
    NextRequest;

  responseRef: {
    current:
      NextResponse;
  };

  url:
    string;

  key:
    string;

  cookieName?:
    string;
}) {
  return createServerClient(
    url,
    key,
    {
      ...(cookieName
        ? {
            cookieOptions: {
              name:
                cookieName,
            },
          }
        : {}),

      cookies: {
        getAll() {
          return request.cookies
            .getAll();
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


          responseRef.current =
            NextResponse.next({
              request,
            });


          cookiesToSet.forEach(
            ({
              name,
              value,
              options,
            }) => {
              responseRef.current
                .cookies.set(
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
}


export async function updateSession(
  request: NextRequest,
) {
  /* ==========================================================
     EXPLICIT DEMO MODE ONLY
  ========================================================== */

  if (
    (
      process.env
        .NEXT_PUBLIC_ARC_DEMO_MODE ??
      process.env
        .NEXT_PUBLIC_NOVA_DEMO_MODE
    ) ===
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
      "ARC configuration error. Supabase environment variables are missing.",
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


  const pathname =
    request.nextUrl.pathname;


  const responseRef = {
    current:
      NextResponse.next({
        request,
      }),
  };


  /* ==========================================================
     ARC PLATFORM ADMIN

     Platform administration has its own Supabase auth cookie.
     A user can therefore stay signed into the POS as one
     account while signing into ARC Internal as a completely
     different platform-admin account.

     Hidden-key validation + platform role authorization remain
     inside the /internal/[key] route tree.
  ========================================================== */

  if (
    pathname ===
      "/internal" ||
    pathname.startsWith(
      "/internal/",
    )
  ) {
    const platformSupabase =
      createCookieBackedClient({
        request,
        responseRef,
        url,
        key,
        cookieName:
          PLATFORM_AUTH_COOKIE,
      });


    /*
     * Refresh the isolated admin session when one exists.
     * No redirect occurs here: the hidden internal route itself
     * decides whether to render login, 404, or the admin panel.
     */

    await platformSupabase.auth
      .getClaims();


    responseRef.current
      .headers.set(
        "Cache-Control",
        "private, no-store",
      );


    return responseRef.current;
  }


  const supabase =
    createCookieBackedClient({
      request,
      responseRef,
      url,
      key,
    });


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
    responseRef.current
      .headers.set(
        "Cache-Control",
        "private, no-store",
      );


    return responseRef.current;
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
      return responseRef.current;
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


  if (
    businessError
  ) {
    return new NextResponse(
      "ARC could not verify business access.",
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


  responseRef.current
    .headers.set(
      "Cache-Control",
      "private, no-store",
    );


  return responseRef.current;
}
