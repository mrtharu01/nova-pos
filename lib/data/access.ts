"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  BusinessAccess,
  BusinessStaffMember,
  StaffInvitation,
  StaffInvitationActionResult,
  StaffInvitationStatus,
  StaffRole,
  StaffStatus,
} from "@/lib/domain/access";


type AccessRow = {
  businessId: string;

  userId: string;

  isOwner: boolean;

  role:
    | "owner"
    | "manager"
    | "cashier";

  status:
    "active";

  permissions: {
    checkout: boolean;

    viewSales: boolean;

    manageCatalog: boolean;

    manageInventory: boolean;

    viewReports: boolean;

    manageSettings: boolean;

    manageStaff: boolean;

    manageManagers: boolean;

    refundSales: boolean;
  };
};


type StaffRow = {
  staff_id:
    | string
    | null;

  user_id: string;

  email: string;

  role:
    | "owner"
    | "manager"
    | "cashier";

  status:
    StaffStatus;

  is_owner: boolean;

  created_at: string;
};


type InvitationRow = {
  id: string;

  email: string;

  role:
    StaffRole;

  status:
    StaffInvitationStatus;

  expires_at: string;

  created_at: string;
};


type InviteApiResponse = {
  ok?: boolean;

  status?:
    | "invited"
    | "existing_user_added";

  message?: string;

  invitationId?: string;

  error?: string;
};


/* ============================================================
   BUSINESS ACCESS
============================================================ */

export async function fetchBusinessAccess(
  businessId: string,
): Promise<BusinessAccess> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_business_access",
      {
        p_business_id:
          businessId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  if (!data) {
    throw new Error(
      "Business access information was not returned.",
    );
  }


  return data as
    AccessRow;
}


/* ============================================================
   BUSINESS STAFF
============================================================ */

export async function fetchBusinessStaff(
  businessId: string,
): Promise<
  BusinessStaffMember[]
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_business_staff",
      {
        p_business_id:
          businessId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const rows =
    (
      data ??
      []
    ) as StaffRow[];


  return rows.map(
    (row) => ({
      staffId:
        row.staff_id,

      userId:
        row.user_id,

      email:
        row.email,

      role:
        row.role,

      status:
        row.status,

      isOwner:
        row.is_owner,

      createdAt:
        row.created_at,
    }),
  );
}


/* ============================================================
   STAFF INVITATIONS
============================================================ */

export async function fetchStaffInvitations(
  businessId: string,
): Promise<
  StaffInvitation[]
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_staff_invitations",
      {
        p_business_id:
          businessId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const rows =
    (
      data ??
      []
    ) as InvitationRow[];


  return rows.map(
    (row) => ({
      id:
        row.id,

      email:
        row.email,

      role:
        row.role,

      status:
        row.status,

      expiresAt:
        row.expires_at,

      createdAt:
        row.created_at,
    }),
  );
}


/* ============================================================
   SEND STAFF INVITATION

   This deliberately goes through the Next.js API route.

   The API route:
   - calls the authorization RPC
   - uses the Supabase Admin client
   - sends the secure invitation email

   The service-role / secret key never reaches the browser.
============================================================ */

export async function sendStaffInvitation({
  businessId,
  email,
  role,
}: {
  businessId: string;

  email: string;

  role: StaffRole;
}): Promise<
  StaffInvitationActionResult
> {
  const response =
    await fetch(
      "/api/staff/invite",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            businessId,

            email,

            role,
          }),
      },
    );


  let body:
    InviteApiResponse;


  try {
    body =
      (await response.json()) as
        InviteApiResponse;
  } catch {
    throw new Error(
      "NOVA could not read the staff invitation response.",
    );
  }


  if (
    !response.ok ||
    !body.ok
  ) {
    throw new Error(
      body.error ??
        "Staff invitation could not be sent.",
    );
  }


  if (
    body.status !==
      "invited" &&
    body.status !==
      "existing_user_added"
  ) {
    throw new Error(
      "NOVA received an unexpected invitation response.",
    );
  }


  return {
    ok:
      true,

    status:
      body.status,

    message:
      body.message ??
      (
        body.status ===
        "existing_user_added"
          ? "Existing NOVA account added."
          : "Staff invitation sent."
      ),

    invitationId:
      body.invitationId,
  };
}


/* ============================================================
   REVOKE INVITATION
============================================================ */

export async function revokeStaffInvitation(
  invitationId: string,
) {
  const supabase =
    createClient();


  const {
    error,
  } =
    await supabase.rpc(
      "revoke_staff_invitation",
      {
        p_invitation_id:
          invitationId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }
}


/* ============================================================
   UPDATE EXISTING STAFF
============================================================ */

export async function updateBusinessStaff({
  businessId,
  staffId,
  role,
  status,
}: {
  businessId: string;

  staffId: string;

  role: StaffRole;

  status: StaffStatus;
}) {
  const supabase =
    createClient();


  const {
    error,
  } =
    await supabase.rpc(
      "update_business_staff",
      {
        p_business_id:
          businessId,

        p_staff_id:
          staffId,

        p_role:
          role,

        p_status:
          status,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }
}