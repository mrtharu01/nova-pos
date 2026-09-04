import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


type StaffRole =
  | "manager"
  | "cashier";


type InvitationResult = {
  status:
    | "pending"
    | "existing_user_added";

  invitationId?:
    string;

  businessId?:
    string;

  businessName?:
    string;

  email?:
    string;

  role?:
    StaffRole;

  userId?:
    string;

  existingAuthUserId?:
    string | null;

  existingAuthUserWasInvited?:
    boolean;
};


function roleLabel(
  role: StaffRole,
) {
  return role ===
    "manager"
    ? "Manager"
    : "Cashier";
}


function errorMessage(
  cause: unknown,
) {
  return cause instanceof Error
    ? cause.message
    : "Staff invitation failed.";
}


/* ============================================================
   REVOKE DATABASE INVITATION
============================================================ */

async function revokeInvitation(
  supabase:
    Awaited<
      ReturnType<
        typeof createClient
      >
    >,

  invitationId:
    string,
) {
  await supabase.rpc(
    "revoke_staff_invitation",
    {
      p_invitation_id:
        invitationId,
    },
  );
}


/* ============================================================
   POST
============================================================ */

export async function POST(
  request: NextRequest,
) {
  try {
    const body =
      (await request.json()) as {
        businessId?:
          string;

        email?:
          string;

        role?:
          StaffRole;
      };


    const businessId =
      body.businessId
        ?.trim();


    const email =
      body.email
        ?.trim()
        .toLowerCase();


    const role =
      body.role;


    /* ========================================================
       REQUEST VALIDATION
    ======================================================== */

    if (
      !businessId ||
      !email ||
      !role
    ) {
      return NextResponse.json(
        {
          error:
            "Business, email and role are required.",
        },
        {
          status:
            400,
        },
      );
    }


    if (
      !email.includes(
        "@",
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid staff email address.",
        },
        {
          status:
            400,
        },
      );
    }


    if (
      role !==
        "cashier" &&
      role !==
        "manager"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid staff role.",
        },
        {
          status:
            400,
        },
      );
    }


    /* ========================================================
       AUTHENTICATED SUPABASE CLIENT
    ======================================================== */

    const supabase =
      await createClient();


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
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status:
            401,
        },
      );
    }


    /* ========================================================
       CREATE DATABASE INVITATION
       
       Database performs authorization:
       
       Owner:
         Manager + Cashier
       
       Manager:
         Cashier only
    ======================================================== */

    const {
      data,
      error:
        invitationError,
    } =
      await supabase.rpc(
        "create_staff_invitation",
        {
          p_business_id:
            businessId,

          p_email:
            email,

          p_role:
            role,
        },
      );


    if (
      invitationError
    ) {
      return NextResponse.json(
        {
          error:
            invitationError.message,
        },
        {
          status:
            invitationError.code ===
              "42501"
              ? 403
              : 400,
        },
      );
    }


    const result =
      data as
        InvitationResult;


    /* ========================================================
       CONFIRMED EXISTING NOVA USER
       
       No setup email is necessary.
       
       Their existing NOVA password remains unchanged.
    ======================================================== */

    if (
      result.status ===
        "existing_user_added"
    ) {
      return NextResponse.json({
        ok:
          true,

        status:
          "existing_user_added",

        message:
          "Existing NOVA account added to this business.",
      });
    }


    /* ========================================================
       PENDING INVITATION
    ======================================================== */

    const invitationId =
      result.invitationId;


    if (!invitationId) {
      return NextResponse.json(
        {
          error:
            "Invitation ID was not returned.",
        },
        {
          status:
            500,
        },
      );
    }


    const admin =
      createAdminClient();


    /* ========================================================
       EXISTING UNCONFIRMED AUTH USER
       
       There are two different cases:
       
       1. Previous Supabase staff invitation account
          → safe to remove and recreate the invitation user.
       
       2. Normal NOVA signup waiting for email verification
          → DO NOT delete.
    ======================================================== */

    const existingAuthUserId =
      result.existingAuthUserId ??
      null;


    if (
      existingAuthUserId
    ) {
      const {
        data:
          existingUserData,

        error:
          existingUserError,
      } =
        await admin.auth.admin
          .getUserById(
            existingAuthUserId,
          );


      if (
        existingUserError ||
        !existingUserData.user
      ) {
        await revokeInvitation(
          supabase,
          invitationId,
        );


        return NextResponse.json(
          {
            error:
              existingUserError?.message ??
              "Existing NOVA account could not be inspected.",
          },
          {
            status:
              400,
          },
        );
      }


      const existingUser =
        existingUserData.user;


      /*
       * Race protection:
       *
       * The user may have verified their
       * account after create_staff_invitation()
       * initially inspected auth.users.
       */

      if (
        existingUser.email_confirmed_at
      ) {
        const {
          data:
            retryData,

          error:
            retryError,
        } =
          await supabase.rpc(
            "create_staff_invitation",
            {
              p_business_id:
                businessId,

              p_email:
                email,

              p_role:
                role,
            },
          );


        if (
          retryError
        ) {
          await revokeInvitation(
            supabase,
            invitationId,
          );


          return NextResponse.json(
            {
              error:
                retryError.message,
            },
            {
              status:
                400,
            },
          );
        }


        const retryResult =
          retryData as
            InvitationResult;


        if (
          retryResult.status ===
            "existing_user_added"
        ) {
          return NextResponse.json({
            ok:
              true,

            status:
              "existing_user_added",

            message:
              "Existing NOVA account added to this business.",
          });
        }


        await revokeInvitation(
          supabase,
          invitationId,
        );


        return NextResponse.json(
          {
            error:
              "The account changed while the invitation was being created. Try again.",
          },
          {
            status:
              409,
          },
        );
      }


      /*
       * A normal unconfirmed signup must
       * never be deleted by the staff
       * invitation system.
       */

      if (
        !existingUser.invited_at
      ) {
        await revokeInvitation(
          supabase,
          invitationId,
        );


        return NextResponse.json(
          {
            error:
              "This email already has an unverified NOVA account. Ask the user to verify that account first, then send the staff invitation again.",
          },
          {
            status:
              409,
          },
        );
      }


      /*
       * Previous Supabase invitation user.
       *
       * It is still unconfirmed and was
       * created through the invitation
       * system, so it is safe to remove
       * before issuing a fresh invite.
       */

      const {
        error:
          deleteError,
      } =
        await admin.auth.admin
          .deleteUser(
            existingAuthUserId,
          );


      if (
        deleteError
      ) {
        await revokeInvitation(
          supabase,
          invitationId,
        );


        return NextResponse.json(
          {
            error:
              `Previous invitation could not be refreshed: ${deleteError.message}`,
          },
          {
            status:
              400,
          },
        );
      }
    }


    /* ========================================================
       INVITATION REDIRECT
    ======================================================== */

    const origin =
      request.nextUrl.origin;


    const redirectTo =
      `${origin}/auth/setup-password?invitation=${encodeURIComponent(
        invitationId,
      )}`;


    /* ========================================================
       SEND SUPABASE AUTH INVITATION
    ======================================================== */

    const {
      error:
        inviteError,
    } =
      await admin.auth.admin
        .inviteUserByEmail(
          email,
          {
            redirectTo,

            data: {
              nova_invitation_id:
                invitationId,

              nova_business_id:
                businessId,

              nova_business_name:
                result.businessName ??
                "NOVA Business",

              nova_role:
                role,

              nova_role_label:
                roleLabel(
                  role,
                ),
            },
          },
        );


    if (
      inviteError
    ) {
      /*
       * Never leave a database invitation
       * active if Supabase failed to issue
       * the corresponding Auth invitation.
       */

      await revokeInvitation(
        supabase,
        invitationId,
      );


      return NextResponse.json(
        {
          error:
            inviteError.message,
        },
        {
          status:
            400,
        },
      );
    }


    /* ========================================================
       SUCCESS
    ======================================================== */

    return NextResponse.json({
      ok:
        true,

      status:
        "invited",

      invitationId,

      message:
        `Invitation sent to ${email}.`,
    });
  } catch (cause) {
    return NextResponse.json(
      {
        error:
          errorMessage(
            cause,
          ),
      },
      {
        status:
          500,
      },
    );
  }
}