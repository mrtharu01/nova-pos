"use client";

import * as React from "react";

import {
  Check,
  FileText,
  Loader2,
  TriangleAlert,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  fetchReportSettings,
  saveReportSettings,
} from "@/lib/data/report-settings";

import type {
  ReportSettings,
} from "@/lib/domain/report-settings";


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }


  return "Report settings could not be saved.";
}


export function ReportSettingsCard() {
  const {
    business,
  } =
    useCurrentBusiness();


  const businessId =
    business?.id ??
    "";


  const [
    settings,
    setSettings,
  ] =
    React.useState<
      ReportSettings | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    React.useState(false);


  const [
    saving,
    setSaving,
  ] =
    React.useState(false);


  const [
    saved,
    setSaved,
  ] =
    React.useState(false);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  React.useEffect(() => {
    if (
      !businessId
    ) {
      return;
    }


    let cancelled =
      false;


    async function load() {
      setLoading(
        true,
      );

      setError(
        null,
      );


      try {
        const result =
          await fetchReportSettings(
            businessId,
          );


        if (
          !cancelled
        ) {
          setSettings(
            result,
          );
        }
      } catch (cause) {
        if (
          !cancelled
        ) {
          setError(
            getErrorMessage(
              cause,
            ),
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }


    void load();


    return () => {
      cancelled =
        true;
    };
  }, [
    businessId,
  ]);


  function update<K extends keyof ReportSettings>(
    key:
      K,

    value:
      ReportSettings[K],
  ) {
    setSaved(
      false,
    );


    setSettings(
      (current) =>
        current
          ? {
              ...current,
              [key]:
                value,
            }
          : current,
    );
  }


  async function handleSave() {
    if (
      !settings ||
      saving
    ) {
      return;
    }


    setSaving(
      true,
    );

    setSaved(
      false,
    );

    setError(
      null,
    );


    try {
      const result =
        await saveReportSettings(
          settings,
        );


      setSettings(
        result,
      );

      setSaved(
        true,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  if (
    loading ||
    !settings
  ) {
    return (
      <Card className="rounded-[24px]">

        <CardContent className="flex min-h-[300px] items-center justify-center">

          <Loader2 className="h-7 w-7 animate-spin text-primary" />

        </CardContent>

      </Card>
    );
  }


  return (
    <Card className="rounded-[24px]">

      <CardHeader>

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary/10 text-primary">

            <FileText className="h-5 w-5" />

          </div>


          <div>

            <CardTitle>
              Printed Reports
            </CardTitle>


            <p className="mt-1 text-sm text-muted-foreground">
              Customize NOVA's printable sales reports and PDF layout.
            </p>

          </div>

        </div>

      </CardHeader>


      <CardContent className="space-y-7">

        {/* BUSINESS INFORMATION */}

        <section>

          <h3 className="font-semibold">
            Report Identity
          </h3>


          <div className="mt-4 grid gap-4 sm:grid-cols-2">

            <Field
              label="Display name"
            >
              <Input
                value={
                  settings.displayName
                }
                placeholder={
                  business?.name ??
                  "Business name"
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "displayName",
                    event.target.value,
                  )
                }
              />
            </Field>


            <Field
              label="Report title"
            >
              <Input
                value={
                  settings.reportTitle
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "reportTitle",
                    event.target.value,
                  )
                }
              />
            </Field>


            <Field
              label="Address line 1"
            >
              <Input
                value={
                  settings.addressLine1
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "addressLine1",
                    event.target.value,
                  )
                }
              />
            </Field>


            <Field
              label="Address line 2"
            >
              <Input
                value={
                  settings.addressLine2
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "addressLine2",
                    event.target.value,
                  )
                }
              />
            </Field>


            <Field
              label="Phone"
            >
              <Input
                value={
                  settings.phone
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "phone",
                    event.target.value,
                  )
                }
              />
            </Field>


            <Field
              label="Email"
            >
              <Input
                value={
                  settings.email
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "email",
                    event.target.value,
                  )
                }
              />
            </Field>


            <div className="sm:col-span-2">

              <Field
                label="Registration / tax number"
              >
                <Input
                  value={
                    settings.registrationNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    update(
                      "registrationNumber",
                      event.target.value,
                    )
                  }
                />
              </Field>

            </div>

          </div>

        </section>


        <div className="border-t" />


        {/* PAGE */}

        <section>

          <h3 className="font-semibold">
            Page Layout
          </h3>


          <div className="mt-4 grid gap-4 sm:grid-cols-2">

            <Field
              label="Paper size"
            >

              <select
                value={
                  settings.paperSize
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "paperSize",
                    event.target.value as
                      ReportSettings[
                        "paperSize"
                      ],
                  )
                }
                className="h-10 w-full rounded-[12px] border bg-background px-3 text-sm outline-none focus:border-primary"
              >

                <option value="a4">
                  A4
                </option>

                <option value="letter">
                  Letter
                </option>

              </select>

            </Field>


            <Field
              label="Orientation"
            >

              <select
                value={
                  settings.orientation
                }
                onChange={(
                  event,
                ) =>
                  update(
                    "orientation",
                    event.target.value as
                      ReportSettings[
                        "orientation"
                      ],
                  )
                }
                className="h-10 w-full rounded-[12px] border bg-background px-3 text-sm outline-none focus:border-primary"
              >

                <option value="portrait">
                  Portrait
                </option>

                <option value="landscape">
                  Landscape
                </option>

              </select>

            </Field>

          </div>

        </section>


        <div className="border-t" />


        {/* CONTENT */}

        <section>

          <h3 className="font-semibold">
            Report Sections
          </h3>


          <div className="mt-4 space-y-2">

            <SettingToggle
              label="Gross revenue"
              description="Show sales before refunds."
              checked={
                settings.showGrossRevenue
              }
              onChange={(
                value,
              ) =>
                update(
                  "showGrossRevenue",
                  value,
                )
              }
            />


            <SettingToggle
              label="Refunds"
              description="Show refunded value separately."
              checked={
                settings.showRefunds
              }
              onChange={(
                value,
              ) =>
                update(
                  "showRefunds",
                  value,
                )
              }
            />


            <SettingToggle
              label="Cost of goods"
              description="Include COGS in the financial summary."
              checked={
                settings.showCogs
              }
              onChange={(
                value,
              ) =>
                update(
                  "showCogs",
                  value,
                )
              }
            />


            <SettingToggle
              label="Gross profit"
              description="Show current gross profit."
              checked={
                settings.showProfit
              }
              onChange={(
                value,
              ) =>
                update(
                  "showProfit",
                  value,
                )
              }
            />


            <SettingToggle
              label="Sales charts"
              description="Show net-sales line and bar charts."
              checked={
                settings.showSalesTrend
              }
              onChange={(
                value,
              ) =>
                update(
                  "showSalesTrend",
                  value,
                )
              }
            />


            <SettingToggle
              label="Payment methods"
              description="Show cash, card and bank payment breakdown."
              checked={
                settings.showPaymentBreakdown
              }
              onChange={(
                value,
              ) =>
                update(
                  "showPaymentBreakdown",
                  value,
                )
              }
            />


            <SettingToggle
              label="Top products"
              description="Show product quantity and revenue summary."
              checked={
                settings.showTopProducts
              }
              onChange={(
                value,
              ) =>
                update(
                  "showTopProducts",
                  value,
                )
              }
            />


            <SettingToggle
              label="Recent transactions"
              description="Include the recent transaction table."
              checked={
                settings.showTransactions
              }
              onChange={(
                value,
              ) =>
                update(
                  "showTransactions",
                  value,
                )
              }
            />


            <SettingToggle
              label="NOVA branding"
              description="Show Generated by NOVA POS in the footer."
              checked={
                settings.showGeneratedByNova
              }
              onChange={(
                value,
              ) =>
                update(
                  "showGeneratedByNova",
                  value,
                )
              }
            />

          </div>

        </section>


        <div className="border-t" />


        <Field
          label="Footer message"
        >
          <Input
            value={
              settings.footerMessage
            }
            onChange={(
              event,
            ) =>
              update(
                "footerMessage",
                event.target.value,
              )
            }
          />
        </Field>


        {error && (

          <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">

            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

            {
              error
            }

          </div>

        )}


        {saved && (

          <div className="flex items-center gap-2 rounded-[16px] border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400">

            <Check className="h-4 w-4" />

            Report settings saved.

          </div>

        )}


        <Button
          type="button"
          className="h-11 w-full rounded-[14px]"
          disabled={
            saving
          }
          onClick={() =>
            void handleSave()
          }
        >

          {saving ? (

            <Loader2 className="mr-2 h-4 w-4 animate-spin" />

          ) : (

            <Check className="mr-2 h-4 w-4" />

          )}


          {saving
            ? "Saving…"
            : "Save Report Settings"}

        </Button>

      </CardContent>

    </Card>
  );
}


function Field({
  label,
  children,
}: {
  label:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div className="space-y-2">

      <label className="text-sm font-medium">
        {
          label
        }
      </label>

      {
        children
      }

    </div>
  );
}


function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label:
    string;

  description:
    string;

  checked:
    boolean;

  onChange:
    (
      value:
        boolean,
    ) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] border p-4">

      <div>

        <p className="text-sm font-semibold">
          {
            label
          }
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {
            description
          }
        </p>

      </div>


      <button
        type="button"
        role="switch"
        aria-checked={
          checked
        }
        onClick={() =>
          onChange(
            !checked,
          )
        }
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked
            ? "bg-primary"
            : "bg-muted"
        }`}
      >

        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            checked
              ? "left-6"
              : "left-1"
          }`}
        />

      </button>

    </div>
  );
}