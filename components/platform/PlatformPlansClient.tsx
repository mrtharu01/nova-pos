"use client";

import * as React from "react";

import {
  Check,
  Edit3,
  Infinity as InfinityIcon,
  Plus,
  RefreshCw,
  Trash2,
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
  Dialog,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Textarea,
} from "@/components/ui/textarea";

import {
  fetchPlatformSubscriptionPlans,
  savePlatformSubscriptionPlan,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminRole,
  PlatformSubscriptionPlan,
} from "@/lib/domain/platform-admin";


type FeatureRow = {
  id:
    string;

  key:
    string;

  enabled:
    boolean;
};


type LimitRow = {
  id:
    string;

  key:
    string;

  value:
    string;
};


function makeId() {
  return Math.random()
    .toString(36)
    .slice(2);
}


function formatPrice(
  value:
    number |
    null,
) {
  if (
    value ===
      null ||
    value ===
      undefined
  ) {
    return "Not set";
  }


  return new Intl.NumberFormat(
    "en-LK",
    {
      style:
        "currency",

      currency:
        "LKR",

      maximumFractionDigits:
        2,
    },
  ).format(
    value,
  );
}


function humanizeKey(
  key: string,
) {
  return key
    .replaceAll(
      "_",
      " ",
    )
    .replace(
      /\b\w/g,
      (
        letter,
      ) =>
        letter.toUpperCase(),
    );
}


export function PlatformPlansClient({
  currentRole,
}: {
  currentRole:
    PlatformAdminRole;
}) {
  const canManage =
    currentRole ===
      "owner" ||
    currentRole ===
      "admin";


  const [
    plans,
    setPlans,
  ] =
    React.useState<
      PlatformSubscriptionPlan[]
    >(
      [],
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string |
      null
    >(
      null,
    );


  const [
    notice,
    setNotice,
  ] =
    React.useState<
      string |
      null
    >(
      null,
    );


  const [
    editing,
    setEditing,
  ] =
    React.useState<
      PlatformSubscriptionPlan |
      null
    >(
      null,
    );


  const [
    name,
    setName,
  ] =
    React.useState(
      "",
    );


  const [
    description,
    setDescription,
  ] =
    React.useState(
      "",
    );


  const [
    monthlyPrice,
    setMonthlyPrice,
  ] =
    React.useState(
      "",
    );


  const [
    yearlyPrice,
    setYearlyPrice,
  ] =
    React.useState(
      "",
    );


  const [
    isPublic,
    setIsPublic,
  ] =
    React.useState(
      true,
    );


  const [
    isActive,
    setIsActive,
  ] =
    React.useState(
      true,
    );


  const [
    features,
    setFeatures,
  ] =
    React.useState<
      FeatureRow[]
    >(
      [],
    );


  const [
    limits,
    setLimits,
  ] =
    React.useState<
      LimitRow[]
    >(
      [],
    );


  const [
    saving,
    setSaving,
  ] =
    React.useState(
      false,
    );


  const load =
    React.useCallback(
      async () => {
        setError(
          null,
        );


        try {
          setPlans(
            await fetchPlatformSubscriptionPlans(),
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Plans could not be loaded.",
          );
        }
      },
      [],
    );


  React.useEffect(() => {
    let cancelled =
      false;


    async function run() {
      await load();


      if (
        !cancelled
      ) {
        setLoading(
          false,
        );
      }
    }


    void run();


    return () => {
      cancelled =
        true;
    };
  }, [
    load,
  ]);


  function openEditor(
    plan:
      PlatformSubscriptionPlan,
  ) {
    setEditing(
      plan,
    );

    setName(
      plan.name,
    );

    setDescription(
      plan.description,
    );

    setMonthlyPrice(
      plan.monthlyPriceLkr ===
        null
        ? ""
        : String(
            plan.monthlyPriceLkr,
          ),
    );

    setYearlyPrice(
      plan.yearlyPriceLkr ===
        null
        ? ""
        : String(
            plan.yearlyPriceLkr,
          ),
    );

    setIsPublic(
      plan.isPublic,
    );

    setIsActive(
      plan.isActive,
    );

    setFeatures(
      Object.entries(
        plan.entitlements ??
          {},
      ).map(
        (
          [
            key,
            enabled,
          ],
        ) => ({
          id:
            makeId(),

          key,

          enabled:
            Boolean(
              enabled,
            ),
        }),
      ),
    );

    setLimits(
      Object.entries(
        plan.usageLimits ??
          {},
      ).map(
        (
          [
            key,
            value,
          ],
        ) => ({
          id:
            makeId(),

          key,

          value:
            value ===
              null
              ? ""
              : String(
                  value,
                ),
        }),
      ),
    );

    setError(
      null,
    );

    setNotice(
      null,
    );
  }


  function closeEditor() {
    if (
      saving
    ) {
      return;
    }


    setEditing(
      null,
    );
  }


  function normalizeKey(
    value: string,
  ) {
    return value
      .trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "_",
      )
      .replace(
        /^_+|_+$/g,
        "",
      );
  }


  async function save(
    event:
      React.FormEvent,
  ) {
    event.preventDefault();


    if (
      !editing ||
      !canManage ||
      saving
    ) {
      return;
    }


    const normalizedFeatures =
      features
        .map(
          (
            row,
          ) => ({
            ...row,

            key:
              normalizeKey(
                row.key,
              ),
          }),
        )
        .filter(
          (
            row,
          ) =>
            Boolean(
              row.key,
            ),
        );


    const normalizedLimits =
      limits
        .map(
          (
            row,
          ) => ({
            ...row,

            key:
              normalizeKey(
                row.key,
              ),
          }),
        )
        .filter(
          (
            row,
          ) =>
            Boolean(
              row.key,
            ),
        );


    const featureKeys =
      normalizedFeatures.map(
        (
          row,
        ) =>
          row.key,
      );


    const limitKeys =
      normalizedLimits.map(
        (
          row,
        ) =>
          row.key,
      );


    if (
      new Set(
        featureKeys,
      ).size !==
        featureKeys.length
    ) {
      setError(
        "Feature names must be unique.",
      );

      return;
    }


    if (
      new Set(
        limitKeys,
      ).size !==
        limitKeys.length
    ) {
      setError(
        "Limit names must be unique.",
      );

      return;
    }


    const parsedMonthly =
      monthlyPrice.trim() ===
        ""
        ? null
        : Number(
            monthlyPrice,
          );


    const parsedYearly =
      yearlyPrice.trim() ===
        ""
        ? null
        : Number(
            yearlyPrice,
          );


    if (
      parsedMonthly !==
        null &&
      (
        !Number.isFinite(
          parsedMonthly,
        ) ||
        parsedMonthly <
          0
      )
    ) {
      setError(
        "Monthly price must be zero or greater.",
      );

      return;
    }


    if (
      parsedYearly !==
        null &&
      (
        !Number.isFinite(
          parsedYearly,
        ) ||
        parsedYearly <
          0
      )
    ) {
      setError(
        "Yearly price must be zero or greater.",
      );

      return;
    }


    const entitlementObject:
      Record<
        string,
        boolean
      > = {};


    for (
      const row
      of normalizedFeatures
    ) {
      entitlementObject[
        row.key
      ] =
        row.enabled;
    }


    const limitObject:
      Record<
        string,
        number | null
      > = {};


    for (
      const row
      of normalizedLimits
    ) {
      if (
        row.value.trim() ===
          ""
      ) {
        limitObject[
          row.key
        ] =
          null;

        continue;
      }


      const parsed =
        Number(
          row.value,
        );


      if (
        !Number.isFinite(
          parsed,
        ) ||
        parsed <
          0
      ) {
        setError(
          `${humanizeKey(
            row.key,
          )} must be zero or greater, or left blank for unlimited.`,
        );

        return;
      }


      limitObject[
        row.key
      ] =
        parsed;
    }


    setSaving(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );


    try {
      await savePlatformSubscriptionPlan({
        code:
          editing.code,

        name,

        description,

        monthlyPriceLkr:
          parsedMonthly,

        yearlyPriceLkr:
          parsedYearly,

        isPublic,

        isActive,

        entitlements:
          entitlementObject,

        usageLimits:
          limitObject,
      });


      const editedName =
        name.trim();


      setEditing(
        null,
      );


      setNotice(
        `${editedName} plan saved.`,
      );


      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Plan could not be saved.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Commercial Controls
          </p>


          <h1 className="mt-1 text-2xl font-bold">
            Plans
          </h1>


          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Configure ARC&apos;s three customer-facing packages. Complimentary or lifetime-free access is handled separately per business and never appears here as a plan.
          </p>

        </div>


        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setLoading(
              true,
            );

            void load()
              .finally(
                () =>
                  setLoading(
                    false,
                  ),
              );
          }}
        >
          <RefreshCw
            className={
              loading
                ? "mr-2 h-4 w-4 animate-spin"
                : "mr-2 h-4 w-4"
            }
          />

          Refresh
        </Button>

      </div>


      {error ? (

        <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>

      ) : null}


      {notice ? (

        <div className="rounded-[18px] border bg-muted/20 p-4 text-sm">
          {notice}
        </div>

      ) : null}


      {!canManage ? (

        <div className="rounded-[18px] border bg-muted/20 p-4 text-sm text-muted-foreground">
          Support accounts can view plan configuration. Platform Owners and Admins can edit pricing, features and limits.
        </div>

      ) : null}


      {loading ? (

        <div className="rounded-[24px] border bg-card p-10 text-center text-sm text-muted-foreground">
          Loading commercial plans…
        </div>

      ) : (

        <div className="grid gap-5 xl:grid-cols-3">

          {plans.map(
            (
              plan,
            ) => {
              const enabledFeatures =
                Object.entries(
                  plan.entitlements ??
                    {},
                ).filter(
                  (
                    [
                      ,
                      enabled,
                    ],
                  ) =>
                    enabled,
                );


              const usageLimits =
                Object.entries(
                  plan.usageLimits ??
                    {},
                );


              return (
                <Card
                  key={
                    plan.id
                  }
                  className="flex flex-col"
                >

                  <CardHeader>

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {plan.code}
                        </p>


                        <CardTitle className="mt-2 text-xl">
                          {plan.name}
                        </CardTitle>

                      </div>


                      <div className="flex flex-wrap justify-end gap-1.5">

                        <span
                          className={
                            plan.isActive
                              ? "rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                              : "rounded-full border bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground"
                          }
                        >
                          {plan.isActive
                            ? "Active"
                            : "Disabled"}
                        </span>


                        <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                          {plan.isPublic
                            ? "Public"
                            : "Hidden"}
                        </span>

                      </div>

                    </div>


                    <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground">
                      {plan.description ||
                        "No description set."}
                    </p>

                  </CardHeader>


                  <CardContent className="flex flex-1 flex-col">

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">

                      <div className="rounded-[16px] border bg-muted/10 p-4">

                        <p className="text-xs font-medium text-muted-foreground">
                          Monthly
                        </p>


                        <p className="mt-2 text-lg font-bold">
                          {formatPrice(
                            plan.monthlyPriceLkr,
                          )}
                        </p>

                      </div>


                      <div className="rounded-[16px] border bg-muted/10 p-4">

                        <p className="text-xs font-medium text-muted-foreground">
                          Yearly
                        </p>


                        <p className="mt-2 text-lg font-bold">
                          {formatPrice(
                            plan.yearlyPriceLkr,
                          )}
                        </p>

                      </div>

                    </div>


                    <div className="mt-5">

                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Enabled features
                      </p>


                      {enabledFeatures.length >
                      0 ? (

                        <div className="mt-2 flex flex-wrap gap-2">

                          {enabledFeatures.map(
                            (
                              [
                                key,
                              ],
                            ) => (
                              <span
                                key={
                                  key
                                }
                                className="inline-flex items-center gap-1 rounded-full border bg-muted/20 px-2.5 py-1 text-[11px] font-medium"
                              >
                                <Check className="h-3 w-3" />

                                {humanizeKey(
                                  key,
                                )}
                              </span>
                            ),
                          )}

                        </div>

                      ) : (

                        <p className="mt-2 text-sm text-muted-foreground">
                          No feature rules configured yet.
                        </p>

                      )}

                    </div>


                    <div className="mt-5">

                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Usage limits
                      </p>


                      {usageLimits.length >
                      0 ? (

                        <div className="mt-2 space-y-2">

                          {usageLimits.map(
                            (
                              [
                                key,
                                value,
                              ],
                            ) => (
                              <div
                                key={
                                  key
                                }
                                className="flex items-center justify-between gap-4 rounded-[12px] border bg-muted/10 px-3 py-2 text-sm"
                              >
                                <span>
                                  {humanizeKey(
                                    key,
                                  )}
                                </span>


                                <span className="font-semibold">
                                  {value ===
                                  null ? (
                                    <span className="inline-flex items-center gap-1">
                                      <InfinityIcon className="h-3.5 w-3.5" />
                                      Unlimited
                                    </span>
                                  ) : (
                                    value
                                  )}
                                </span>

                              </div>
                            ),
                          )}

                        </div>

                      ) : (

                        <p className="mt-2 text-sm text-muted-foreground">
                          No usage limits configured yet.
                        </p>

                      )}

                    </div>


                    {canManage ? (

                      <Button
                        type="button"
                        variant="outline"
                        className="mt-6 w-full"
                        onClick={() =>
                          openEditor(
                            plan,
                          )
                        }
                      >
                        <Edit3 className="mr-2 h-4 w-4" />

                        Edit Plan
                      </Button>

                    ) : null}

                  </CardContent>

                </Card>
              );
            },
          )}

        </div>

      )}


      <Dialog
        isOpen={
          Boolean(
            editing,
          )
        }
        onClose={
          closeEditor
        }
        title={
          editing
            ? `Edit ${editing.name}`
            : "Edit Plan"
        }
        description="Pricing can stay blank until commercial pricing is finalized."
        className="max-h-[88dvh] max-w-3xl overflow-y-auto"
      >

        <form
          onSubmit={
            save
          }
          className="space-y-7"
        >

          <div className="grid gap-4 sm:grid-cols-2">

            <div className="sm:col-span-2">

              <label className="text-xs font-semibold text-muted-foreground">
                Plan name
              </label>


              <Input
                value={
                  name
                }
                onChange={
                  (
                    event,
                  ) =>
                    setName(
                      event.target.value,
                    )
                }
                required
                disabled={
                  saving
                }
                className="mt-2"
              />

            </div>


            <div className="sm:col-span-2">

              <label className="text-xs font-semibold text-muted-foreground">
                Description
              </label>


              <Textarea
                value={
                  description
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDescription(
                      event.target.value,
                    )
                }
                disabled={
                  saving
                }
                className="mt-2 min-h-24"
              />

            </div>


            <div>

              <label className="text-xs font-semibold text-muted-foreground">
                Monthly price (LKR)
              </label>


              <Input
                type="number"
                min="0"
                step="0.01"
                value={
                  monthlyPrice
                }
                onChange={
                  (
                    event,
                  ) =>
                    setMonthlyPrice(
                      event.target.value,
                    )
                }
                placeholder="Not set"
                disabled={
                  saving
                }
                className="mt-2"
              />

            </div>


            <div>

              <label className="text-xs font-semibold text-muted-foreground">
                Yearly price (LKR)
              </label>


              <Input
                type="number"
                min="0"
                step="0.01"
                value={
                  yearlyPrice
                }
                onChange={
                  (
                    event,
                  ) =>
                    setYearlyPrice(
                      event.target.value,
                    )
                }
                placeholder="Not set"
                disabled={
                  saving
                }
                className="mt-2"
              />

            </div>

          </div>


          <div className="grid gap-3 sm:grid-cols-2">

            <label className="flex cursor-pointer items-center justify-between rounded-[16px] border bg-muted/10 p-4">

              <div>

                <p className="text-sm font-semibold">
                  Active
                </p>


                <p className="mt-1 text-xs text-muted-foreground">
                  Can be assigned to businesses.
                </p>

              </div>


              <input
                type="checkbox"
                checked={
                  isActive
                }
                onChange={
                  (
                    event,
                  ) =>
                    setIsActive(
                      event.target.checked,
                    )
                }
                disabled={
                  saving
                }
                className="h-4 w-4"
              />

            </label>


            <label className="flex cursor-pointer items-center justify-between rounded-[16px] border bg-muted/10 p-4">

              <div>

                <p className="text-sm font-semibold">
                  Public
                </p>


                <p className="mt-1 text-xs text-muted-foreground">
                  Eligible for the future pricing page.
                </p>

              </div>


              <input
                type="checkbox"
                checked={
                  isPublic
                }
                onChange={
                  (
                    event,
                  ) =>
                    setIsPublic(
                      event.target.checked,
                    )
                }
                disabled={
                  saving
                }
                className="h-4 w-4"
              />

            </label>

          </div>


          <div>

            <div className="flex items-center justify-between gap-3">

              <div>

                <p className="text-sm font-semibold">
                  Feature entitlements
                </p>


                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Define feature keys that the app can enforce later, such as loyalty or advanced_reports.
                </p>

              </div>


              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  saving
                }
                onClick={() =>
                  setFeatures(
                    (
                      current,
                    ) => [
                      ...current,

                      {
                        id:
                          makeId(),

                        key:
                          "",

                        enabled:
                          true,
                      },
                    ],
                  )
                }
              >
                <Plus className="mr-2 h-3.5 w-3.5" />

                Add
              </Button>

            </div>


            <div className="mt-3 space-y-2">

              {features.length ===
              0 ? (

                <div className="rounded-[14px] border border-dashed p-4 text-sm text-muted-foreground">
                  No feature rules yet.
                </div>

              ) : features.map(
                (
                  row,
                ) => (

                  <div
                    key={
                      row.id
                    }
                    className="grid gap-2 rounded-[14px] border bg-muted/10 p-3 sm:grid-cols-[1fr_auto_auto]"
                  >

                    <Input
                      value={
                        row.key
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setFeatures(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  item,
                                ) =>
                                  item.id ===
                                    row.id
                                    ? {
                                        ...item,

                                        key:
                                          event.target.value,
                                      }
                                    : item,
                              ),
                          )
                      }
                      placeholder="Feature name"
                      disabled={
                        saving
                      }
                    />


                    <label className="flex items-center gap-2 rounded-[10px] border bg-background px-3 text-xs font-semibold">

                      <input
                        type="checkbox"
                        checked={
                          row.enabled
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setFeatures(
                              (
                                current,
                              ) =>
                                current.map(
                                  (
                                    item,
                                  ) =>
                                    item.id ===
                                      row.id
                                      ? {
                                          ...item,

                                          enabled:
                                            event.target.checked,
                                        }
                                      : item,
                                ),
                            )
                        }
                        disabled={
                          saving
                        }
                      />

                      Enabled

                    </label>


                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        setFeatures(
                          (
                            current,
                          ) =>
                            current.filter(
                              (
                                item,
                              ) =>
                                item.id !==
                                  row.id,
                            ),
                        )
                      }
                      aria-label="Remove feature"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                  </div>

                ),
              )}

            </div>

          </div>


          <div>

            <div className="flex items-center justify-between gap-3">

              <div>

                <p className="text-sm font-semibold">
                  Usage limits
                </p>


                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Add numeric limits such as staff or locations. Leave the value blank for unlimited.
                </p>

              </div>


              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                  saving
                }
                onClick={() =>
                  setLimits(
                    (
                      current,
                    ) => [
                      ...current,

                      {
                        id:
                          makeId(),

                        key:
                          "",

                        value:
                          "",
                      },
                    ],
                  )
                }
              >
                <Plus className="mr-2 h-3.5 w-3.5" />

                Add
              </Button>

            </div>


            <div className="mt-3 space-y-2">

              {limits.length ===
              0 ? (

                <div className="rounded-[14px] border border-dashed p-4 text-sm text-muted-foreground">
                  No usage limits yet.
                </div>

              ) : limits.map(
                (
                  row,
                ) => (

                  <div
                    key={
                      row.id
                    }
                    className="grid gap-2 rounded-[14px] border bg-muted/10 p-3 sm:grid-cols-[1fr_0.55fr_auto]"
                  >

                    <Input
                      value={
                        row.key
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setLimits(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  item,
                                ) =>
                                  item.id ===
                                    row.id
                                    ? {
                                        ...item,

                                        key:
                                          event.target.value,
                                      }
                                    : item,
                              ),
                          )
                      }
                      placeholder="Limit name"
                      disabled={
                        saving
                      }
                    />


                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        row.value
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setLimits(
                            (
                              current,
                            ) =>
                              current.map(
                                (
                                  item,
                                ) =>
                                  item.id ===
                                    row.id
                                    ? {
                                        ...item,

                                        value:
                                          event.target.value,
                                      }
                                    : item,
                              ),
                          )
                      }
                      placeholder="Unlimited"
                      disabled={
                        saving
                      }
                    />


                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        setLimits(
                          (
                            current,
                          ) =>
                            current.filter(
                              (
                                item,
                              ) =>
                                item.id !==
                                  row.id,
                            ),
                        )
                      }
                      aria-label="Remove limit"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                  </div>

                ),
              )}

            </div>

          </div>


          <div className="flex justify-end gap-2 border-t pt-5">

            <Button
              type="button"
              variant="outline"
              disabled={
                saving
              }
              onClick={
                closeEditor
              }
            >
              Cancel
            </Button>


            <Button
              type="submit"
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : "Save Plan"}
            </Button>

          </div>

        </form>

      </Dialog>

    </div>
  );
}
