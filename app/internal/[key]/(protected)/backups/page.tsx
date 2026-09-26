import {
  PlatformBackupsClient,
} from "@/components/platform/PlatformBackupsClient";

import {
  requirePlatformAdmin,
} from "@/lib/platform/auth";


export default async function PlatformBackupsPage({
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


  const {
    access,
  } =
    await requirePlatformAdmin();


  return (
    <PlatformBackupsClient
      basePath={
        `/internal/${key}`
      }
      currentRole={
        access.role!
      }
    />
  );
}
