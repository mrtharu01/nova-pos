import {
  PlatformBusinessesClient,
} from "@/components/platform/PlatformBusinessesClient";


export default async function PlatformBusinessesPage({
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
    <PlatformBusinessesClient
      basePath={
        `/internal/${key}`
      }
    />
  );
}
