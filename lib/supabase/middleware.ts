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

  /*
   * Phase 3D
   *
   * The remote scanner must be
   * accessible from a phone without
   * requiring the entire phone to
   * sign into NOVA.
   */
  "/remote-scanner",
];

function isPublicPath(
  pathname: string,
) {
  return PUBLIC_PATHS.some(
    (path) =>
      pathname === path ||
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
    value.startsWith("/signup")
  ) {
    return "/";
  }

  return value;
}

export async function updateSession(
  request: NextRequest,
) {
  /*
   * Keep Demo Mode behaviour
   * available.
   */

  if (
    process.env
      .NEXT_PUBLIC_NOVA_DEMO_MODE !==
    "false"
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

  if (!url || !key) {
    return NextResponse.next({
      request,
    });
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

  /*
   * Remote scanner pairing pages
   * intentionally support anonymous
   * visitors.
   *
   * Their UUID pairing token acts as
   * the temporary session secret.
   */

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

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const isAuthenticated =
    !claimsError &&
    Boolean(
      claimsData?.claims?.sub,
    );

  if (!isAuthenticated) {
    if (publicPath) {
      return response;
    }

    const redirectUrl =
      request.nextUrl.clone();

    redirectUrl.pathname =
      "/login";

    redirectUrl.search = "";

    redirectUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );

    return NextResponse.redirect(
      redirectUrl,
    );
  }

  /*
   * RLS means only businesses
   * belonging to the authenticated
   * user are returned.
   */

  const {
    data: businessRows,
  } =
    await supabase
      .from("businesses")
      .select("id")
      .limit(1);

  const hasBusiness =
    Boolean(
      businessRows?.length,
    );

  if (
    !hasBusiness &&
    pathname !==
      "/onboarding" &&
    !pathname.startsWith(
      "/auth/",
    )
  ) {
    const redirectUrl =
      request.nextUrl.clone();

    redirectUrl.pathname =
      "/onboarding";

    redirectUrl.search = "";

    return NextResponse.redirect(
      redirectUrl,
    );
  }

  if (
    hasBusiness &&
    pathname === "/onboarding"
  ) {
    return NextResponse.redirect(
      new URL(
        "/",
        request.url,
      ),
    );
  }

  if (
    publicPath &&
    !pathname.startsWith(
      "/auth/",
    )
  ) {
    const next =
      safeNextPath(
        request.nextUrl.searchParams.get(
          "next",
        ),
      );

    return NextResponse.redirect(
      new URL(
        next,
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
