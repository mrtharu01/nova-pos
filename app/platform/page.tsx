import {
  redirect,
} from "next/navigation";

import {
  PlatformAdminClient,
} from "@/components/platform/PlatformAdminClient";

import {
  createClient,
} from "@/lib/supabase/server";

import type {
  PlatformAdminAccess,
} from "@/lib/domain/platform-admin";


export default async function PlatformPage() {
  const supabase =
    await createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_platform_admin_access",
    );


  if (
    error ||
    !data
  ) {
    redirect(
      "/pos",
    );
  }


  const access =
    data as
      PlatformAdminAccess;


  if (
    !access.isPlatformAdmin ||
    !access.role
  ) {
    redirect(
      "/pos",
    );
  }


  return (
    <PlatformAdminClient
      access={
        access
      }
    />
  );
}
