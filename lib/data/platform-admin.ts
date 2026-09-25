"use client";

import {
  createPlatformClient,
} from "@/lib/supabase/platform-client";

import type {
  PlatformAdminMember,
  PlatformAdminOverview,
  PlatformAdminRole,
  PlatformAuditEntry,
  PlatformBusiness,
} from "@/lib/domain/platform-admin";


export async function fetchPlatformOverview():
Promise<PlatformAdminOverview> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_platform_admin_overview",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data as
    PlatformAdminOverview;
}


export async function fetchPlatformBusinesses(
  search = "",
): Promise<PlatformBusiness[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_businesses",
      {
        p_search:
          search,

        p_limit:
          250,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformBusiness[];
}


export async function fetchPlatformAudit():
Promise<PlatformAuditEntry[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_admin_audit",
      {
        p_limit:
          100,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformAuditEntry[];
}


export async function fetchPlatformAdmins():
Promise<PlatformAdminMember[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_admins",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformAdminMember[];
}


export async function addPlatformAdmin(
  email: string,
  role: PlatformAdminRole,
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "add_platform_admin",
      {
        p_email:
          email.trim(),

        p_role:
          role,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function setPlatformAdminRole(
  userId: string,
  role: PlatformAdminRole,
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "set_platform_admin_role",
      {
        p_user_id:
          userId,

        p_role:
          role,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function removePlatformAdmin(
  userId: string,
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "remove_platform_admin",
      {
        p_user_id:
          userId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}
