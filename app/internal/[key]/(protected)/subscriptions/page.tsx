import {
  PlatformSectionPlaceholder,
} from "@/components/platform/PlatformSectionPlaceholder";


export default function PlatformSubscriptionsPage() {
  return (
    <PlatformSectionPlaceholder
      eyebrow="Billing Controls"
      title="Subscriptions"
      description="Manage tenant subscriptions, billing state and complimentary access."
      next="Phase 4B connects plan assignment and Phase 4C adds complimentary until-date / lifetime billing overrides."
    />
  );
}
