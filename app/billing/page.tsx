"use client";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  SubscriptionSettingsCard,
} from "@/components/settings/SubscriptionSettingsCard";


export default function BillingPage() {
  return (
    <AppLayout title="Plan & Billing">

      <SubscriptionSettingsCard />

    </AppLayout>
  );
}
