import {
  PlatformAdminLayout,
} from "@/components/platform/PlatformAdminLayout";

import {
  requirePlatformAdmin,
} from "@/lib/platform/auth";


export default async function ProtectedPlatformLayout({
  children,
  params,
}: {
  children:
    React.ReactNode;

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


  const {
    user,
    access,
  } =
    await requirePlatformAdmin();


  return (
    <PlatformAdminLayout
      basePath={
        `/internal/${key}`
      }
      email={
        user.email ??
        "Platform administrator"
      }
      access={
        access
      }
    >
      {children}
    </PlatformAdminLayout>
  );
}
