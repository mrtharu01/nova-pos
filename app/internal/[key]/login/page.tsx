import {
  PlatformAdminLogin,
} from "@/components/platform/PlatformAdminLogin";


export default async function PlatformLoginPage({
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
    <PlatformAdminLogin
      basePath={
        `/internal/${key}`
      }
    />
  );
}
