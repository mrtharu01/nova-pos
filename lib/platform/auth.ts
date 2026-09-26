import "server-only";

import {
  cache,
} from "react";

import {
  notFound,
} from "next/navigation";

import {
  createPlatformServerClient,
} from "@/lib/supabase/platform-server";

import type {
  PlatformAdminAccess,
} from "@/lib/domain/platform-admin";


export const requirePlatformAdmin =
  cache(
    async () => {
      const supabase =
        await createPlatformServerClient();


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
        notFound();
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


      return {
        user,
        access,
      };
    },
  );
