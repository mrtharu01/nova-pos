import {
  redirect,
} from "next/navigation";


export default async function PlatformSettingsPage({
  params,
}: {
  params:
    Promise<{
      key: string;
    }>;
}) {
  const {
    key,
  } =
    await params;


  redirect(
    `/internal/${key}/dashboard`,
  );
}
