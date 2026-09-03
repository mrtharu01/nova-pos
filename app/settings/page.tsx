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
  EmailSettingsCard,
} from "@/components/settings/EmailSettingsCard";

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


/* ============================================================
   SETTINGS SECTIONS
============================================================ */

const SECTIONS = [
  "General",
  "POS & Checkout",
  "Receipts",
  "Emails",
  "Inventory",
  "QR Codes",
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


  return (
    <AppLayout title="Settings">

      <div className="grid gap-6 md:grid-cols-4">

        {/* ====================================================
            SETTINGS NAVIGATION
        ===================================================== */}

        <div className="space-y-2 md:col-span-1">

          {SECTIONS.map(
            (section) => (

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

                {
                  section
                }

              </button>

            ),
          )}

        </div>


        {/* ====================================================
            SETTINGS CONTENT
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

                </CardHeader>


                <CardContent className="space-y-4">

                  <div className="grid gap-4 sm:grid-cols-2">

                    <div className="space-y-2">

                      <label className="text-sm font-medium">
                        Business Name
                      </label>


                      <input
                        className="w-full rounded-[12px] border bg-muted/50 p-2.5 outline-none focus:border-primary"
                        defaultValue="Nova Cafe & Roastery"
                      />

                    </div>


                    <div className="space-y-2">

                      <label className="text-sm font-medium">
                        Phone
                      </label>


                      <input
                        className="w-full rounded-[12px] border bg-muted/50 p-2.5 outline-none focus:border-primary"
                        defaultValue="011-555-0199"
                      />

                    </div>


                    <div className="space-y-2 sm:col-span-2">

                      <label className="text-sm font-medium">
                        Address
                      </label>


                      <input
                        className="w-full rounded-[12px] border bg-muted/50 p-2.5 outline-none focus:border-primary"
                        defaultValue="42 Roasters Avenue, Colombo"
                      />

                    </div>

                  </div>

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


                  <p className="mt-3 text-xs text-muted-foreground">
                    Your appearance preference is stored on this device.
                  </p>

                </CardContent>

              </Card>

            </>

          ) : active ===
          "Receipts" ? (

            /* ================================================
               RECEIPT SETTINGS
            ================================================= */

            <ReceiptSettingsClient
              embedded
            />

          ) : active ===
          "Emails" ? (

            /* ================================================
               EMAIL SETTINGS
            ================================================= */

            <EmailSettingsCard />

          ) : active ===
          "Loyalty" ? (

            /* ================================================
               CUSTOMER + LOYALTY SETTINGS
            ================================================= */

            <LoyaltySettingsCard />

          ) : active ===
          "Reports" ? (

            /* ================================================
               PRINTED REPORT SETTINGS
            ================================================= */

            <ReportSettingsCard />

          ) : active ===
          "Staff" ? (

            /* ================================================
               STAFF SETTINGS
            ================================================= */

            <StaffSettingsCard />

          ) : (

            /* ================================================
               REMAINING SETTINGS
            ================================================= */

            <Card className="rounded-[24px]">

              <CardHeader>

                <CardTitle>
                  {
                    active
                  }
                </CardTitle>

              </CardHeader>


              <CardContent>

                <div className="rounded-[16px] border border-dashed bg-muted/20 p-8 text-center">

                  <p className="font-medium">
                    {
                      active
                    }{" "}
                    settings are prepared for the backend phase.
                  </p>


                  <p className="mt-1 text-sm text-muted-foreground">
                    We will connect these controls to persistent business settings instead of saving fake values.
                  </p>

                </div>

              </CardContent>

            </Card>

          )}

        </div>

      </div>

    </AppLayout>
  );
}