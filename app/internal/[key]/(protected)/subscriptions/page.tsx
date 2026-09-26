import {
  PlatformSubscriptionsClient,
} from "@/components/platform/PlatformSubscriptionsClient";

import {
  requirePlatformAdmin,
} from "@/lib/platform/auth";


export default async function PlatformSubscriptionsPage() {
  const {
    access,
  } =
    await requirePlatformAdmin();


  return (
    <PlatformSubscriptionsClient
      currentRole={
        access.role!
      }
    />
  );
}
