import {
  PlatformBackupsClient,
} from "@/components/platform/PlatformBackupsClient";


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


  return (
    <PlatformBackupsClient
      basePath={
        `/internal/${key}`
      }
    />
  );
}
