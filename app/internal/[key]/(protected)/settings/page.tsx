import {
  PlatformSectionPlaceholder,
} from "@/components/platform/PlatformSectionPlaceholder";


export default function PlatformSettingsPage() {
  return (
    <PlatformSectionPlaceholder
      eyebrow="Platform"
      title="Settings"
      description="NOVA-wide operational settings belong here, separate from individual shop settings."
      next="Only platform-level settings will be added here; business settings remain inside each tenant."
    />
  );
}
