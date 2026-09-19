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
  PackageSearch,
  QrCode,
  ShoppingCart,
} from "lucide-react";


const SECTIONS = [
  "General",
  "POS & Checkout",
  "Receipts",
  "Inventory",
  "QR Codes",
  "Loyalty",
  "Reports",
  "Staff",
] as const;


type Section =
  (typeof SECTIONS)[number];


/* ============================================================
   PLACEHOLDER SETTING SECTION

   These are intentionally honest placeholders.

   There are currently no persistent settings behind these
   areas, so NOVA must not pretend values are being saved.
============================================================ */

function FutureSettingsCard({
  title,
  description,
  icon,
}: {
  title: string;

  description: string;

  icon:
    React.ReactNode;
}) {
  return (
    <Card className="rounded-[24px]">

      <CardHeader>

        <CardTitle>
          {title}
        </CardTitle>

      </CardHeader>


      <CardContent>

        <div className="rounded-[18px] border border-dashed bg-muted/20 p-8">

          <div className="flex items-start gap-4">

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-muted text-muted-foreground">
              {icon}
            </div>


            <div>

              <p className="font-semibold">
                No additional settings required
              </p>


              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>

            </div>

          </div>

        </div>

      </CardContent>

    </Card>
  );
}


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
                    Current NOVA workspace information.
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
                      No active NOVA business workspace was found.
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

            /* ================================================
               RECEIPTS
            ================================================= */

            <ReceiptSettingsClient
              embedded
            />

          ) : active ===
          "Loyalty" ? (

            /* ================================================
               LOYALTY
            ================================================= */

            <LoyaltySettingsCard />

          ) : active ===
          "Reports" ? (

            /* ================================================
               REPORTS
            ================================================= */

            <ReportSettingsCard />

          ) : active ===
          "Staff" ? (

            /* ================================================
               STAFF
            ================================================= */

            <StaffSettingsCard />

          ) : active ===
          "POS & Checkout" ? (

            /* ================================================
               POS
            ================================================= */

            <FutureSettingsCard
              title="POS & Checkout"
              icon={
                <ShoppingCart className="h-5 w-5" />
              }
              description="Checkout behaviour currently uses NOVA's production defaults. Additional business-level checkout preferences can be added later without changing the existing checkout engine."
            />

          ) : active ===
          "Inventory" ? (

            /* ================================================
               INVENTORY
            ================================================= */

            <FutureSettingsCard
              title="Inventory"
              icon={
                <PackageSearch className="h-5 w-5" />
              }
              description="Inventory tracking is already handled by NOVA's stock movement and inventory system. There are currently no extra workspace preferences to configure here."
            />

          ) : (

            /* ================================================
               QR
            ================================================= */

            <FutureSettingsCard
              title="QR Codes"
              icon={
                <QrCode className="h-5 w-5" />
              }
              description="Product QR identifiers are generated and stored permanently by NOVA. Additional QR formatting preferences can be introduced later if required."
            />

          )}

        </div>

      </div>

    </AppLayout>
  );
}