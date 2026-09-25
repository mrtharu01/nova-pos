import {
  notFound,
  redirect,
} from "next/navigation";

import {
  createPlatformServerClient,
} from "@/lib/supabase/platform-server";

import type {
  PlatformAdminAccess,
} from "@/lib/domain/platform-admin";


export default async function InternalEntryPage({
  params,
}: {
  params:
    Promise<{
      key:
        string;
    }>;
}) {
  const {
    key,
  } =
    await params;


  const supabase =
    await createPlatformServerClient();


  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();


  if (
    !user
  ) {
    redirect(
      `/internal/${key}/login`,
    );
  }


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
    notFound();
  }


  const access =
    data as
      PlatformAdminAccess;


  if (
    !access.isPlatformAdmin ||
    !access.role
  ) {
    notFound();
  }


  redirect(
    `/internal/${key}/dashboard`,
  );
}
