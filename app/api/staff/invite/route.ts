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
};


function roleLabel(
  role:
    StaffRole,
) {
  return role ===
    "manager"
    ? "Manager"
    : "Cashier";
}


export async function POST(
  request:
    NextRequest,
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


    const supabase =
      await createClient();


    const {
      data: {
        user,
      },
      error:
        userError,
    } =
      await supabase.auth.getUser();


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


    /*
     * Database performs all actual
     * authorization:
     *
     * Owner → Manager/Cashier
     * Manager → Cashier only
     */
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
            403,
        },
      );
    }


    const result =
      data as
        InvitationResult;


    /*
     * Existing NOVA account:
     * no invitation email is necessary.
     */
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


    const origin =
      request.nextUrl.origin;


    const redirectTo =
      `${origin}/auth/setup-password?invitation=${encodeURIComponent(
        invitationId,
      )}`;


    const admin =
      createAdminClient();


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


    if (inviteError) {
      /*
       * Race case:
       *
       * Another process may have created
       * the Auth user between our DB check
       * and Supabase invite call.
       */
      if (
        inviteError.message
          .toLowerCase()
          .includes(
            "already",
          )
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
          !retryError &&
          (
            retryData as
              InvitationResult
          )?.status ===
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
      }


      /*
       * Email could not be sent.
       * Remove pending invite state.
       */
      await supabase.rpc(
        "revoke_staff_invitation",
        {
          p_invitation_id:
            invitationId,
        },
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
          cause instanceof
          Error
            ? cause.message
            : "Staff invitation failed.",
      },
      {
        status:
          500,
      },
    );
  }
}