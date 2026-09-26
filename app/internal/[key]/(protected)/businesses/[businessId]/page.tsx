import {
  PlatformBusinessDetailClient,
} from "@/components/platform/PlatformBusinessDetailClient";

import {
  requirePlatformAdmin,
} from "@/lib/platform/auth";


export default async function PlatformBusinessDetailPage({
  params,
}: {
  params:
    Promise<{
      key:
        string;

      businessId:
        string;
    }>;
}) {
  const {
    key,
    businessId,
  } =
    await params;


  const {
    access,
  } =
    await requirePlatformAdmin();


  return (
    <PlatformBusinessDetailClient
      businessId={
        businessId
      }
      basePath={
        `/internal/${key}`
      }
      currentRole={
        access.role!
      }
    />
  );
}
