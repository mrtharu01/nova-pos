import {
  PlatformAdminsClient,
} from "@/components/platform/PlatformAdminsClient";

import {
  requirePlatformAdmin,
} from "@/lib/platform/auth";


export default async function PlatformAdminsPage() {
  const {
    user,
    access,
  } =
    await requirePlatformAdmin();


  return (
    <PlatformAdminsClient
      currentUserId={
        user.id
      }
      currentRole={
        access.role!
      }
    />
  );
}
