"use client";

import * as React from "react";

import {
  BadgePercent,
  Check,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
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
  fetchLoyaltySettings,
  updateLoyaltySettings,
  type LoyaltySettings,
} from "@/lib/data/loyalty";

import {
  formatSaleMoney,
} from "@/lib/domain/sales";


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message === "string"
    ) {
      return message;
    }
  }

  return "Loyalty settings could not be loaded.";
}


export function LoyaltySettingsCard() {
  const {
    business,
  } =
    useCurrentBusiness();


  /*
   * IMPORTANT:
   *
   * businessId is ALWAYS a string.
   *
   * If business has not loaded yet,
   * it becomes "" instead of null/undefined.
   *
   * This completely avoids the:
   *
   * 'business' is possibly 'null'
   *
   * TypeScript error.
   */

  const businessId =
    business?.id ??
    "";


  const currencyCode =
    business?.currency_code ??
    "LKR";


  const [
    settings,
    setSettings,
  ] =
    React.useState<
      LoyaltySettings | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    React.useState(true);


  const [
    saving,
    setSaving,
  ] =
    React.useState(false);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    saved,
    setSaved,
  ] =
    React.useState(false);


  /* ============================================================
     LOAD SETTINGS
  ============================================================ */

  React.useEffect(() => {
    if (!businessId) {
      setLoading(false);

      setSettings(null);

      return;
    }


    let cancelled =
      false;


    setLoading(true);

    setError(null);


    void fetchLoyaltySettings(
      businessId,
    )
      .then(
        (result) => {
          if (
            cancelled
          ) {
            return;
          }

          setSettings(
            result,
          );
        },
      )
      .catch(
        (cause: unknown) => {
          if (
            cancelled
          ) {
            return;
          }

          setSettings(null);

          setError(
            getErrorMessage(
              cause,
            ),
          );
        },
      )
      .finally(
        () => {
          if (
            cancelled
          ) {
            return;
          }

          setLoading(false);
        },
      );


    return () => {
      cancelled =
        true;
    };
  }, [
    businessId,
  ]);


  /* ============================================================
     UPDATE LOCAL FIELD
  ============================================================ */

  function change<
    Key extends keyof LoyaltySettings,
  >(
    key: Key,
    value:
      LoyaltySettings[Key],
  ) {
    setSettings(
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,

          [key]:
            value,
        };
      },
    );


    setSaved(false);

    setError(null);
  }


  /* ============================================================
     SAVE SETTINGS
  ============================================================ */

  async function handleSave() {
    if (
      !businessId ||
      !settings ||
      saving
    ) {
      return;
    }


    /* ==========================================================
       VALIDATION
    ========================================================== */

    if (
      settings.spendAmountPerEarn <=
      0
    ) {
      setError(
        "Spend amount must be greater than zero.",
      );

      return;
    }


    if (
      settings.pointsEarned <=
      0
    ) {
      setError(
        "Points earned must be greater than zero.",
      );

      return;
    }


    if (
      settings.redeemPoints <=
      0
    ) {
      setError(
        "Redeem point block must be greater than zero.",
      );

      return;
    }


    if (
      settings.redeemValue <=
      0
    ) {
      setError(
        "Redemption value must be greater than zero.",
      );

      return;
    }


    if (
      settings.minimumRedeemPoints <
      0
    ) {
      setError(
        "Minimum redemption cannot be negative.",
      );

      return;
    }


    if (
      settings.minimumRedeemPoints >
        0 &&
      settings.minimumRedeemPoints %
        settings.redeemPoints !==
        0
    ) {
      setError(
        "Minimum redemption must be a multiple of the redemption point block.",
      );

      return;
    }


    if (
      settings.maximumDiscountPercent <
        0 ||
      settings.maximumDiscountPercent >
        100
    ) {
      setError(
        "Maximum loyalty discount must be between 0% and 100%.",
      );

      return;
    }


    setSaving(true);

    setSaved(false);

    setError(null);


    try {
      const result =
        await updateLoyaltySettings({
          businessId,

          enabled:
            settings.enabled,

          spendAmountPerEarn:
            settings.spendAmountPerEarn,

          pointsEarned:
            settings.pointsEarned,

          redeemPoints:
            settings.redeemPoints,

          redeemValue:
            settings.redeemValue,

          minimumRedeemPoints:
            settings.minimumRedeemPoints,

          maximumDiscountPercent:
            settings.maximumDiscountPercent,

          allowCashierRedeem:
            settings.allowCashierRedeem,

          /*
           * SMS OTP provider is not connected yet.
           *
           * Keep verification requirement OFF.
           */
          requireVerifiedPhoneForRedemption:
            false,
        });


      setSettings(
        result,
      );


      setSaved(true);
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }


  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <Card className="rounded-[24px]">

        <CardContent className="flex min-h-[260px] items-center justify-center">

          <Loader2 className="h-7 w-7 animate-spin text-primary" />

        </CardContent>

      </Card>
    );
  }


  /* ============================================================
     BUSINESS NOT AVAILABLE
  ============================================================ */

  if (!businessId) {
    return (
      <Card className="rounded-[24px]">

        <CardContent className="p-6">

          <div className="flex items-start gap-3">

            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />


            <div>

              <p className="font-medium">
                Business unavailable
              </p>


              <p className="mt-1 text-sm text-muted-foreground">
                NOVA could not determine the current business.
              </p>

            </div>

          </div>

        </CardContent>

      </Card>
    );
  }


  /* ============================================================
     SETTINGS FAILED TO LOAD
  ============================================================ */

  if (!settings) {
    return (
      <Card className="rounded-[24px]">

        <CardContent className="p-6">

          <div className="flex items-start gap-3 text-destructive">

            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />


            <div>

              <p className="font-medium">
                Loyalty settings could not be loaded
              </p>


              <p className="mt-1 text-sm">
                {
                  error ??
                  "Unknown error."
                }
              </p>

            </div>

          </div>

        </CardContent>

      </Card>
    );
  }


  /* ============================================================
     EXAMPLES
  ============================================================ */

  const earningExampleSpend =
    settings.spendAmountPerEarn *
    10;


  const earningExamplePoints =
    settings.pointsEarned *
    10;


  return (
    <div className="space-y-5">

      {/* ========================================================
          PROGRAM
      ========================================================= */}

      <Card className="rounded-[24px]">

        <CardHeader>

          <div className="flex items-start justify-between gap-4">

            <div>

              <CardTitle className="flex items-center gap-2">

                <Sparkles className="h-5 w-5 text-primary" />

                Loyalty Program

              </CardTitle>


              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Reward registered customers with loyalty points and let them redeem those points during checkout.
              </p>

            </div>


            <Toggle
              checked={
                settings.enabled
              }
              disabled={
                saving
              }
              onChange={(
                value,
              ) =>
                change(
                  "enabled",
                  value,
                )
              }
            />

          </div>

        </CardHeader>


        <CardContent className="space-y-6">

          {!settings.enabled && (

            <div className="rounded-[16px] border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
              Loyalty is currently disabled. Registered customers and permanent customer discounts still work normally.
            </div>

          )}


          {/* ====================================================
              EARNING
          ===================================================== */}

          <SettingSection
            icon={
              <Sparkles className="h-5 w-5" />
            }
            title="Earning rule"
            description="Configure how customers earn points from the final amount they pay."
          >

            <div className="grid gap-4 sm:grid-cols-2">

              <NumberField
                label={`Spend amount (${currencyCode})`}
                value={
                  settings.spendAmountPerEarn
                }
                min={
                  0.01
                }
                step={
                  0.01
                }
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "spendAmountPerEarn",
                    value,
                  )
                }
              />


              <NumberField
                label="Points earned"
                value={
                  settings.pointsEarned
                }
                min={
                  1
                }
                step={
                  1
                }
                integer
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "pointsEarned",
                    value,
                  )
                }
              />

            </div>


            <div className="mt-4 rounded-[14px] bg-muted/40 p-3 text-sm">

              Example: spending{" "}

              <strong>
                {formatSaleMoney(
                  earningExampleSpend,
                  currencyCode,
                )}
              </strong>

              {" "}earns{" "}

              <strong>
                {
                  earningExamplePoints
                }{" "}
                points
              </strong>.

            </div>

          </SettingSection>


          {/* ====================================================
              REDEMPTION
          ===================================================== */}

          <SettingSection
            icon={
              <BadgePercent className="h-5 w-5" />
            }
            title="Redemption"
            description="Configure how accumulated points become a checkout discount."
          >

            <div className="grid gap-4 sm:grid-cols-2">

              <NumberField
                label="Point block"
                value={
                  settings.redeemPoints
                }
                min={
                  1
                }
                step={
                  1
                }
                integer
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "redeemPoints",
                    value,
                  )
                }
              />


              <NumberField
                label={`Value (${currencyCode})`}
                value={
                  settings.redeemValue
                }
                min={
                  0.01
                }
                step={
                  0.01
                }
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "redeemValue",
                    value,
                  )
                }
              />


              <NumberField
                label="Minimum points to redeem"
                value={
                  settings.minimumRedeemPoints
                }
                min={
                  0
                }
                step={
                  1
                }
                integer
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "minimumRedeemPoints",
                    value,
                  )
                }
              />


              <NumberField
                label="Maximum discount (%)"
                value={
                  settings.maximumDiscountPercent
                }
                min={
                  0
                }
                max={
                  100
                }
                step={
                  1
                }
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "maximumDiscountPercent",
                    value,
                  )
                }
              />

            </div>


            <div className="mt-4 rounded-[14px] bg-muted/40 p-3 text-sm">

              <strong>
                {
                  settings.redeemPoints
                }{" "}
                points
              </strong>

              {" "}gives a{" "}

              <strong>
                {formatSaleMoney(
                  settings.redeemValue,
                  currencyCode,
                )}
              </strong>

              {" "}checkout discount.

            </div>

          </SettingSection>


          {/* ====================================================
              CASHIER PERMISSION
          ===================================================== */}

          <SettingSection
            icon={
              <ShieldCheck className="h-5 w-5" />
            }
            title="Cashier permissions"
            description="Choose whether cashier accounts are allowed to redeem customer loyalty points."
          >

            <div className="flex items-center justify-between gap-4 rounded-[16px] border p-4">

              <div>

                <p className="text-sm font-semibold">
                  Allow cashiers to redeem points
                </p>


                <p className="mt-1 max-w-lg text-xs leading-5 text-muted-foreground">
                  When disabled, only owners and managers can apply loyalty point redemption during checkout.
                </p>

              </div>


              <Toggle
                checked={
                  settings.allowCashierRedeem
                }
                disabled={
                  saving
                }
                onChange={(
                  value,
                ) =>
                  change(
                    "allowCashierRedeem",
                    value,
                  )
                }
              />

            </div>

          </SettingSection>

        </CardContent>

      </Card>


      {/* ========================================================
          PHONE VERIFICATION
      ========================================================= */}

      <Card className="rounded-[24px]">

        <CardHeader>

          <CardTitle className="flex items-center gap-2">

            <MessageSquareText className="h-5 w-5" />

            Phone Verification

          </CardTitle>

        </CardHeader>


        <CardContent>

          <div className="flex flex-col gap-4 rounded-[18px] border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="font-semibold">
                SMS OTP verification
              </p>


              <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                The customer database is prepared for mobile verification, but an SMS provider has not been connected yet. Loyalty can operate without OTP for now.
              </p>

            </div>


            <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              Not configured
            </span>

          </div>

        </CardContent>

      </Card>


      {/* ========================================================
          ERROR
      ========================================================= */}

      {error && (

        <div className="flex items-start gap-3 rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            {
              error
            }
          </span>

        </div>

      )}


      {/* ========================================================
          SAVE
      ========================================================= */}

      <div className="flex items-center justify-end gap-3">

        {saved && (

          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">

            <Check className="h-4 w-4" />

            Saved

          </span>

        )}


        <Button
          type="button"
          className="rounded-[14px]"
          disabled={
            saving
          }
          onClick={() =>
            void handleSave()
          }
        >

          {saving && (

            <Loader2 className="mr-2 h-4 w-4 animate-spin" />

          )}


          {saving
            ? "Saving…"
            : "Save Loyalty Settings"}

        </Button>

      </div>

    </div>
  );
}


/* ==============================================================
   SETTING SECTION
============================================================== */

function SettingSection({
  icon,
  title,
  description,
  children,
}: {
  icon:
    React.ReactNode;

  title:
    string;

  description:
    string;

  children:
    React.ReactNode;
}) {
  return (
    <div className="border-t pt-6">

      <div className="flex items-start gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-muted">
          {
            icon
          }
        </div>


        <div>

          <h3 className="font-semibold">
            {
              title
            }
          </h3>


          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {
              description
            }
          </p>

        </div>

      </div>


      <div className="mt-4">
        {
          children
        }
      </div>

    </div>
  );
}


/* ==============================================================
   NUMBER FIELD
============================================================== */

function NumberField({
  label,
  value,
  min,
  max,
  step,
  integer = false,
  disabled = false,
  onChange,
}: {
  label:
    string;

  value:
    number;

  min?:
    number;

  max?:
    number;

  step?:
    number;

  integer?:
    boolean;

  disabled?:
    boolean;

  onChange:
    (
      value: number,
    ) => void;
}) {
  return (
    <div className="space-y-2">

      <label className="text-sm font-medium">
        {
          label
        }
      </label>


      <Input
        type="number"
        value={
          value
        }
        min={
          min
        }
        max={
          max
        }
        step={
          step
        }
        disabled={
          disabled
        }
        onChange={(
          event,
        ) => {
          const parsed =
            Number(
              event.target.value,
            );


          if (
            !Number.isFinite(
              parsed,
            )
          ) {
            onChange(0);

            return;
          }


          onChange(
            integer
              ? Math.floor(
                  parsed,
                )
              : parsed,
          );
        }}
        className="h-11 rounded-[14px]"
      />

    </div>
  );
}


/* ==============================================================
   TOGGLE
============================================================== */

function Toggle({
  checked,
  disabled = false,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (
    checked: boolean,
  ) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() =>
        onChange(
          !checked,
        )
      }
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? "border-primary bg-primary"
          : "border-border bg-muted"
      }`}
    >
      <span
        className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked
            ? "translate-x-5"
            : "translate-x-0"
        }`}
      />
    </button>
  );
}