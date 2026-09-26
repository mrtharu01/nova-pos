import {
  NextResponse,
} from "next/server";

import {
  createPlatformServerClient,
} from "@/lib/supabase/platform-server";

import type {
  PlatformAdminAccess,
} from "@/lib/domain/platform-admin";


function safeFilename(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(
      0,
      80,
    ) ||
    "business";
}


export async function GET(
  _request: Request,
  {
    params,
  }: {
    params:
      Promise<{
        key: string;
        businessId: string;
      }>;
  },
) {
  const {
    key,
    businessId,
  } =
    await params;


  const expectedKey =
    (
      process.env
        .ARC_PLATFORM_PORTAL_KEY ??
      process.env
        .NOVA_PLATFORM_PORTAL_KEY
    )
      ?.trim();


  if (
    !expectedKey ||
    key !==
      expectedKey
  ) {
    return new NextResponse(
      "Not Found",
      {
        status:
          404,
      },
    );
  }


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
    return new NextResponse(
      "Not Found",
      {
        status:
          404,
      },
    );
  }


  const {
    data:
      accessData,
    error:
      accessError,
  } =
    await supabase.rpc(
      "get_my_platform_admin_access",
    );


  const access =
    accessData as
      | PlatformAdminAccess
      | null;


  if (
    accessError ||
    !access?.isPlatformAdmin ||
    !access.role
  ) {
    return new NextResponse(
      "Not Found",
      {
        status:
          404,
      },
    );
  }


  const {
    data:
      snapshot,
    error:
      exportError,
  } =
    await supabase.rpc(
      "export_platform_business_snapshot",
      {
        p_target_business_id:
          businessId,
      },
    );


  if (
    exportError ||
    !snapshot
  ) {
    return NextResponse.json(
      {
        error:
          exportError?.message ??
          "Tenant export failed.",
      },
      {
        status:
          500,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }


  const {
    error:
      recordError,
  } =
    await supabase.rpc(
      "record_platform_backup_event",
      {
        p_kind:
          "tenant_export",

        p_status:
          "success",

        p_target_business_id:
          businessId,

        p_note:
          "Tenant export downloaded from ARC Control.",

        p_metadata:
          {
            format:
              "ARC_TENANT_EXPORT_V1",
          },

        p_occurred_at:
          new Date()
            .toISOString(),
      },
    );


  if (
    recordError
  ) {
    return NextResponse.json(
      {
        error:
          recordError.message,
      },
      {
        status:
          500,
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      },
    );
  }


  const brandedSnapshot =
    typeof snapshot === "object" &&
    snapshot !== null &&
    !Array.isArray(snapshot)
      ? {
          ...snapshot,
          format:
            "ARC_TENANT_EXPORT_V1",
        }
      : snapshot;


  const businessName =
    typeof snapshot ===
      "object" &&
    snapshot !==
      null &&
    "business" in
      snapshot &&
    typeof (
      snapshot as {
        business?:
          unknown;
      }
    ).business ===
      "object" &&
    (
      snapshot as {
        business?:
          {
            name?:
              unknown;
          };
      }
    ).business?.name &&
    typeof (
      snapshot as {
        business?:
          {
            name?:
              unknown;
          };
      }
    ).business?.name ===
      "string"
      ? (
          snapshot as {
            business: {
              name:
                string;
            };
          }
        ).business.name
      : businessId;


  const timestamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-",
      );


  return new NextResponse(
    JSON.stringify(
      brandedSnapshot,
      null,
      2,
    ),
    {
      status:
        200,

      headers: {
        "Content-Type":
          "application/json; charset=utf-8",

        "Content-Disposition":
          `attachment; filename="arc-${safeFilename(
            businessName,
          )}-export-${timestamp}.json"`,

        "Cache-Control":
          "private, no-store",
      },
    },
  );
}
