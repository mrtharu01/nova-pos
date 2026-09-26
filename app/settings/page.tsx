"use client";

import * as React from "react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  ThemeToggle,
} from "@/components/ui/theme-toggle";

import {
  LoyaltySettingsCard,
} from "@/components/settings/LoyaltySettingsCard";

import {
  ReceiptSettingsClient,
} from "@/components/settings/ReceiptSettingsClient";

import {
  ReportSettingsCard,
} from "@/components/settings/ReportSettingsCard";

import {
  StaffSettingsCard,
} from "@/components/settings/StaffSettingsCard";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  Building2,
  CircleDollarSign,
  Clock3,
} from "lucide-react";


const SECTIONS = [
  "General",
  "Receipts",
  "Loyalty",
  "Reports",
  "Staff",
] as const;


type Section =
  (typeof SECTIONS)[number];


/* ============================================================
   PAGE
============================================================ */

export default function SettingsPage() {
  const [
    active,
    setActive,
  ] =
    React.useState<Section>(
      "General",
    );


  const {
    business,
    email,
    loading:
      businessLoading,
    error:
      businessError,
  } =
    useCurrentBusiness();


  return (
    <AppLayout title="Settings">

      <div className="grid gap-6 md:grid-cols-4">

        {/* ====================================================
            NAVIGATION
        ===================================================== */}

        <div className="space-y-2 md:col-span-1">

          {SECTIONS.map(
            (
              section,
            ) => (
              <button
                key={
                  section
                }
                type="button"
                onClick={() =>
                  setActive(
                    section,
                  )
                }
                className={`w-full rounded-[12px] px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  active ===
                  section
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {section}
              </button>
            ),
          )}

        </div>


        {/* ====================================================
            CONTENT
        ===================================================== */}

        <div className="space-y-6 md:col-span-3">

          {/* ==================================================
              GENERAL
          =================================================== */}

          {active ===
          "General" ? (

            <>

              <Card className="rounded-[24px]">

                <CardHeader>

                  <CardTitle>
                    Business Information
                  </CardTitle>

                  <p className="text-sm text-muted-foreground">
                    Current ARC workspace information.
                  </p>

                </CardHeader>


                <CardContent>

                  {businessLoading ? (

                    <div className="rounded-[18px] border bg-muted/20 p-6 text-sm text-muted-foreground">
                      Loading business information…
                    </div>

                  ) : businessError ? (

                    <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
                      {businessError}
                    </div>

                  ) : !business ? (

                    <div className="rounded-[18px] border border-dashed p-6 text-sm text-muted-foreground">
                      No active ARC business workspace was found.
                    </div>

                  ) : (

                    <div className="grid gap-3 sm:grid-cols-2">

                      <div className="rounded-[18px] border bg-muted/20 p-5 sm:col-span-2">

                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">

                          <Building2 className="h-4 w-4" />

                          Business

                        </div>


                        <p className="mt-2 text-lg font-semibold">
                          {business.name}
                        </p>

                      </div>


                      <div className="rounded-[18px] border bg-muted/20 p-5">

                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">

                          <CircleDollarSign className="h-4 w-4" />

                          Currency

                        </div>


                        <p className="mt-2 font-semibold">
                          {business.currency_code}
                        </p>

                      </div>


                      <div className="rounded-[18px] border bg-muted/20 p-5">

                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">

                          <Clock3 className="h-4 w-4" />

                          Timezone

                        </div>


                        <p className="mt-2 font-semibold">
                          {business.timezone}
                        </p>

                      </div>


                      <div className="rounded-[18px] border bg-muted/20 p-5 sm:col-span-2">

                        <p className="text-xs font-medium text-muted-foreground">
                          Signed-in account
                        </p>


                        <p className="mt-2 break-all font-semibold">
                          {email}
                        </p>

                      </div>

                    </div>

                  )}

                </CardContent>

              </Card>


              <Card className="rounded-[24px]">

                <CardHeader>

                  <CardTitle>
                    Appearance
                  </CardTitle>

                </CardHeader>


                <CardContent>

                  <ThemeToggle />


                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Your theme preference is stored on this device.
                  </p>

                </CardContent>

              </Card>

            </>

          ) : active ===
          "Receipts" ? (

            <ReceiptSettingsClient
              embedded
            />

          ) : active ===
          "Loyalty" ? (

            <LoyaltySettingsCard />

          ) : active ===
          "Reports" ? (

            <ReportSettingsCard />

          ) : active ===
          "Staff" ? (

            <StaffSettingsCard />

          ) : null}

        </div>

      </div>

    </AppLayout>
  );
}