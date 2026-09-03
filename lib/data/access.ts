"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  BusinessAccess,
  BusinessStaffMember,
  StaffRole,
  StaffStatus,
} from "@/lib/domain/access";


type AccessRow = {
  businessId: string;

  userId: string;

  isOwner: boolean;

  role:
    "owner"
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
    "owner"
    | "manager"
    | "cashier";

  status:
    StaffStatus;

  is_owner: boolean;

  created_at: string;
};


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


  return data as
    AccessRow;
}


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


export async function addBusinessStaff({
  businessId,
  email,
  role,
}: {
  businessId: string;

  email: string;

  role: StaffRole;
}) {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "add_business_staff",
      {
        p_business_id:
          businessId,

        p_email:
          email,

        p_role:
          role,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data as string;
}


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