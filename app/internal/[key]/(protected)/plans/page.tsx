import {
  PlatformPlansClient,
} from "@/components/platform/PlatformPlansClient";

import {
  requirePlatformAdmin,
} from "@/lib/platform/auth";


export default async function PlatformPlansPage() {
  const {
    access,
  } =
    await requirePlatformAdmin();


  return (
    <PlatformPlansClient
      currentRole={
        access.role!
      }
    />
  );
}
