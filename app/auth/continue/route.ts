import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";


type PendingInvitationRow = {
  id: string;

  business_id: string;

  business_name: string;

  email: string;

  role:
    | "manager"
    | "cashier";

  expires_at: string;
};


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


export async function GET(
  request: NextRequest,
) {
  const supabase =
    await createClient();


  /* ==========================================================
     AUTHENTICATED USER
  ========================================================== */

  const {
    data: {
      user,
    },

    error:
      userError,
  } =
    await supabase.auth
      .getUser();


  if (
    userError ||
    !user
  ) {
    const loginUrl =
      new URL(
        "/login",
        request.url,
      );


    const next =
      safeNextPath(
        request.nextUrl
          .searchParams
          .get(
            "next",
          ),
      );


    if (
      next !== "/"
    ) {
      loginUrl.searchParams.set(
        "next",
        next,
      );
    }


    return NextResponse.redirect(
      loginUrl,
    );
  }


  /* ==========================================================
     EXISTING BUSINESS ACCESS

     RLS returns businesses the current user may access:

     Owner
     Manager
     Cashier
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
    const errorUrl =
      new URL(
        "/auth/error",
        request.url,
      );


    errorUrl.searchParams.set(
      "reason",
      "business_access_check_failed",
    );


    return NextResponse.redirect(
      errorUrl,
    );
  }


  if (
    businessRows &&
    businessRows.length >
      0
  ) {
    const next =
      safeNextPath(
        request.nextUrl
          .searchParams
          .get(
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


  /* ==========================================================
     PENDING STAFF INVITATION

     This is the important Auth V2 guard.

     An invited Manager/Cashier must NEVER be sent to owner
     onboarding just because they do not have active business
     access yet.
  ========================================================== */

  const {
    data:
      invitationRows,

    error:
      invitationError,
  } =
    await supabase.rpc(
      "get_my_pending_staff_invitations",
    );


  if (
    invitationError
  ) {
    const errorUrl =
      new URL(
        "/auth/error",
        request.url,
      );


    errorUrl.searchParams.set(
      "reason",
      "invitation_check_failed",
    );


    return NextResponse.redirect(
      errorUrl,
    );
  }


  const invitations =
    (
      invitationRows ??
      []
    ) as PendingInvitationRow[];


  const invitation =
    invitations[0];


  if (
    invitation
  ) {
    const setupUrl =
      new URL(
        "/auth/setup-password",
        request.url,
      );


    setupUrl.searchParams.set(
      "invitation",
      invitation.id,
    );


    return NextResponse.redirect(
      setupUrl,
    );
  }


  /* ==========================================================
     NO BUSINESS + NO STAFF INVITATION

     This is a genuine new NOVA account.

     Continue to owner/business onboarding.
  ========================================================== */

  return NextResponse.redirect(
    new URL(
      "/onboarding",
      request.url,
    ),
  );
}