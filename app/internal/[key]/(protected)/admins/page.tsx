import {
  PlatformSectionPlaceholder,
} from "@/components/platform/PlatformSectionPlaceholder";


export default function PlatformAdminsPage() {
  return (
    <PlatformSectionPlaceholder
      eyebrow="Security"
      title="Platform Admins"
      description="Control who can enter NOVA's platform administration system."
      next="Owner-only admin invitation, role management and removal controls will be connected here."
    />
  );
}
