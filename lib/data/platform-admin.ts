"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  PlatformAdminOverview,
  PlatformAuditEntry,
  PlatformBusiness,
} from "@/lib/domain/platform-admin";


export async function fetchPlatformOverview():
Promise<PlatformAdminOverview> {
  const supabase =
    createClient();


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
    createClient();


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
    createClient();


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
