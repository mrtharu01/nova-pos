"use client";

import * as React from "react";

import {
  CreditCard,
  Gift,
  RefreshCw,
  Search,
  Settings2,
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
  Select,
} from "@/components/ui/select";

import {
  fetchPlatformBusinessSubscriptions,
  fetchPlatformSubscriptionPlans,
  savePlatformBusinessSubscription,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminRole,
  PlatformBillingInterval,
  PlatformBusinessSubscription,
  PlatformComplimentaryMode,
  PlatformSubscriptionPlan,
  PlatformSubscriptionPlanCode,
  PlatformSubscriptionStatus,
} from "@/lib/domain/platform-admin";


const STATUS_OPTIONS: {
  value: PlatformSubscriptionStatus;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "trialing", label: "Trialing" },
  { value: "incomplete", label: "Incomplete" },
  { value: "past_due", label: "Past Due" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];


function humanize(
  value: string,
) {
  return value
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


function accessLabel(
  row:
    PlatformBusinessSubscription,
) {
  if (
    row.complimentaryMode ===
      "lifetime"
  ) {
    return "Complimentary · Lifetime";
  }


  if (
    row.complimentaryMode ===
      "until_date"
  ) {
    return row.complimentaryUntil
      ? `Complimentary · Until ${row.complimentaryUntil}`
      : "Complimentary · Until date";
  }


  return "Normal billing";
}


export function PlatformSubscriptionsClient({
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
    subscriptions,
    setSubscriptions,
  ] =
    React.useState<
      PlatformBusinessSubscription[]
    >(
      [],
    );


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
    search,
    setSearch,
  ] =
    React.useState(
      "",
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
      PlatformBusinessSubscription |
      null
    >(
      null,
    );


  const [
    planCode,
    setPlanCode,
  ] =
    React.useState<
      PlatformSubscriptionPlanCode
    >(
      "starter",
    );


  const [
    status,
    setStatus,
  ] =
    React.useState<
      PlatformSubscriptionStatus
    >(
      "active",
    );


  const [
    billingInterval,
    setBillingInterval,
  ] =
    React.useState<
      PlatformBillingInterval
    >(
      "monthly",
    );


  const [
    complimentaryMode,
    setComplimentaryMode,
  ] =
    React.useState<
      PlatformComplimentaryMode
    >(
      "none",
    );


  const [
    complimentaryUntil,
    setComplimentaryUntil,
  ] =
    React.useState(
      "",
    );


  const [
    cancelAtPeriodEnd,
    setCancelAtPeriodEnd,
  ] =
    React.useState(
      false,
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
      async (
        query =
          "",
      ) => {
        setError(
          null,
        );


        try {
          const [
            nextSubscriptions,
            nextPlans,
          ] =
            await Promise.all([
              fetchPlatformBusinessSubscriptions(
                query,
              ),

              fetchPlatformSubscriptionPlans(),
            ]);


          setSubscriptions(
            nextSubscriptions,
          );

          setPlans(
            nextPlans,
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Subscriptions could not be loaded.",
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
    row:
      PlatformBusinessSubscription,
  ) {
    const firstActivePlan =
      plans.find(
        (
          plan,
        ) =>
          plan.isActive,
      ) ??
      plans[0];


    setEditing(
      row,
    );

    setPlanCode(
      row.planCode ??
      firstActivePlan?.code ??
      "starter",
    );

    setStatus(
      row.status ??
      "active",
    );

    setBillingInterval(
      row.billingInterval ??
      "monthly",
    );

    setComplimentaryMode(
      row.complimentaryMode ??
      "none",
    );

    setComplimentaryUntil(
      row.complimentaryUntil ??
      "",
    );

    setCancelAtPeriodEnd(
      Boolean(
        row.cancelAtPeriodEnd,
      ),
    );

    setError(
      null,
    );

    setNotice(
      null,
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


    if (
      complimentaryMode ===
        "until_date" &&
      !complimentaryUntil
    ) {
      setError(
        "Choose the date complimentary access should end.",
      );

      return;
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
      await savePlatformBusinessSubscription({
        businessId:
          editing.businessId,

        planCode,

        status,

        billingInterval,

        complimentaryMode,

        complimentaryUntil:
          complimentaryMode ===
            "until_date"
            ? complimentaryUntil
            : null,

        cancelAtPeriodEnd,
      });


      setEditing(
        null,
      );

      setNotice(
        `${editing.businessName} subscription saved.`,
      );


      await load(
        search.trim(),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Subscription could not be saved.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  async function submitSearch(
    event:
      React.FormEvent,
  ) {
    event.preventDefault();


    setLoading(
      true,
    );


    await load(
      search.trim(),
    );


    setLoading(
      false,
    );
  }


  const configuredCount =
    subscriptions.filter(
      (
        row,
      ) =>
        Boolean(
          row.subscriptionId,
        ),
    ).length;


  const complimentaryCount =
    subscriptions.filter(
      (
        row,
      ) =>
        row.complimentaryActive,
    ).length;


  return (
    <div className="space-y-6">

      <div>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Billing Controls
        </p>


        <h1 className="mt-1 text-2xl font-bold">
          Subscriptions
        </h1>


        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Assign Starter, Pro or Business to each tenant and manage complimentary access separately from the commercial plan.
        </p>

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


      <div className="grid gap-3 sm:grid-cols-3">

        <Card>

          <CardContent className="p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Businesses
            </p>


            <p className="mt-3 text-3xl font-bold">
              {subscriptions.length}
            </p>

          </CardContent>

        </Card>


        <Card>

          <CardContent className="p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configured
            </p>


            <p className="mt-3 text-3xl font-bold">
              {configuredCount}
            </p>

          </CardContent>

        </Card>


        <Card>

          <CardContent className="p-5">

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Complimentary
            </p>


            <p className="mt-3 text-3xl font-bold">
              {complimentaryCount}
            </p>

          </CardContent>

        </Card>

      </div>


      {!canManage ? (

        <div className="rounded-[18px] border bg-muted/20 p-4 text-sm text-muted-foreground">
          Support accounts can view subscriptions. Platform Owners and Admins can change package and billing state.
        </div>

      ) : null}


      <Card>

        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <CardTitle>
              Tenant subscriptions
            </CardTitle>


            <p className="mt-2 text-sm text-muted-foreground">
              Payment-provider fields are reserved for the future gateway but are not connected yet.
            </p>

          </div>


          <form
            onSubmit={
              submitSearch
            }
            className="flex w-full gap-2 sm:max-w-md"
          >

            <Input
              value={
                search
              }
              onChange={
                (
                  event,
                ) =>
                  setSearch(
                    event.target.value,
                  )
              }
              placeholder="Search business or owner"
            />


            <Button
              type="submit"
              size="icon"
              variant="outline"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>


            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Refresh"
              onClick={() => {
                setLoading(
                  true,
                );

                void load(
                  search.trim(),
                ).finally(
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
                    ? "h-4 w-4 animate-spin"
                    : "h-4 w-4"
                }
              />
            </Button>

          </form>

        </CardHeader>


        <CardContent>

          {loading ? (

            <div className="rounded-[18px] border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Loading subscriptions…
            </div>

          ) : subscriptions.length ===
            0 ? (

            <div className="rounded-[18px] border border-dashed p-8 text-center text-sm text-muted-foreground">
              No businesses matched this search.
            </div>

          ) : (

            <div className="space-y-3">

              {subscriptions.map(
                (
                  row,
                ) => (

                  <div
                    key={
                      row.businessId
                    }
                    className="grid gap-4 rounded-[18px] border bg-muted/10 p-4 xl:grid-cols-[minmax(0,1.4fr)_0.8fr_0.75fr_1fr_auto]"
                  >

                    <div className="min-w-0">

                      <p className="truncate font-semibold">
                        {row.businessName}
                      </p>


                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {row.ownerEmail}
                      </p>

                    </div>


                    <div>

                      <p className="text-xs font-medium text-muted-foreground">
                        Plan
                      </p>


                      <p className="mt-1 text-sm font-semibold">
                        {row.planName ??
                          "Not assigned"}
                      </p>

                    </div>


                    <div>

                      <p className="text-xs font-medium text-muted-foreground">
                        Status
                      </p>


                      <p className="mt-1 text-sm font-semibold">
                        {row.status
                          ? humanize(
                              row.status,
                            )
                          : "—"}
                      </p>

                    </div>


                    <div>

                      <p className="text-xs font-medium text-muted-foreground">
                        Billing
                      </p>


                      <div className="mt-1 flex items-center gap-2 text-sm font-semibold">

                        {row.complimentaryMode &&
                        row.complimentaryMode !==
                          "none" ? (
                          <Gift className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}


                        <span>
                          {row.subscriptionId
                            ? accessLabel(
                                row,
                              )
                            : "Not configured"}
                        </span>

                      </div>

                    </div>


                    <div className="flex items-center justify-end">

                      {canManage ? (

                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            openEditor(
                              row,
                            )
                          }
                        >
                          <Settings2 className="mr-2 h-4 w-4" />

                          {row.subscriptionId
                            ? "Manage"
                            : "Assign"}
                        </Button>

                      ) : null}

                    </div>

                  </div>

                ),
              )}

            </div>

          )}

        </CardContent>

      </Card>


      <Dialog
        isOpen={
          Boolean(
            editing,
          )
        }
        onClose={() => {
          if (
            !saving
          ) {
            setEditing(
              null,
            );
          }
        }}
        title={
          editing
            ? `${editing.businessName} Subscription`
            : "Subscription"
        }
        description={
          editing
            ? editing.ownerEmail
            : undefined
        }
        className="max-w-2xl"
      >

        <form
          onSubmit={
            save
          }
          className="space-y-6"
        >

          <div className="grid gap-4 sm:grid-cols-2">

            <div>

              <label className="text-xs font-semibold text-muted-foreground">
                Plan
              </label>


              <Select
                value={
                  planCode
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPlanCode(
                      event.target.value as PlatformSubscriptionPlanCode,
                    )
                }
                disabled={
                  saving
                }
                className="mt-2"
              >

                {plans.map(
                  (
                    plan,
                  ) => (
                    <option
                      key={
                        plan.code
                      }
                      value={
                        plan.code
                      }
                      disabled={
                        !plan.isActive &&
                        plan.code !==
                          planCode
                      }
                    >
                      {plan.name}
                      {!plan.isActive
                        ? " — Disabled"
                        : ""}
                    </option>
                  ),
                )}

              </Select>

            </div>


            <div>

              <label className="text-xs font-semibold text-muted-foreground">
                Subscription status
              </label>


              <Select
                value={
                  status
                }
                onChange={
                  (
                    event,
                  ) =>
                    setStatus(
                      event.target.value as PlatformSubscriptionStatus,
                    )
                }
                disabled={
                  saving
                }
                className="mt-2"
              >

                {STATUS_OPTIONS.map(
                  (
                    option,
                  ) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  ),
                )}

              </Select>

            </div>


            <div>

              <label className="text-xs font-semibold text-muted-foreground">
                Billing interval
              </label>


              <Select
                value={
                  billingInterval
                }
                onChange={
                  (
                    event,
                  ) =>
                    setBillingInterval(
                      event.target.value as PlatformBillingInterval,
                    )
                }
                disabled={
                  saving
                }
                className="mt-2"
              >
                <option value="monthly">
                  Monthly
                </option>

                <option value="yearly">
                  Yearly
                </option>
              </Select>

            </div>


            <div>

              <label className="text-xs font-semibold text-muted-foreground">
                Complimentary access
              </label>


              <Select
                value={
                  complimentaryMode
                }
                onChange={
                  (
                    event,
                  ) => {
                    const next =
                      event.target.value as PlatformComplimentaryMode;


                    setComplimentaryMode(
                      next,
                    );


                    if (
                      next !==
                        "until_date"
                    ) {
                      setComplimentaryUntil(
                        "",
                      );
                    }
                  }
                }
                disabled={
                  saving
                }
                className="mt-2"
              >
                <option value="none">
                  None — normal billing
                </option>

                <option value="until_date">
                  Complimentary until date
                </option>

                <option value="lifetime">
                  Complimentary lifetime
                </option>
              </Select>

            </div>


            {complimentaryMode ===
            "until_date" ? (

              <div className="sm:col-span-2">

                <label className="text-xs font-semibold text-muted-foreground">
                  Complimentary until
                </label>


                <Input
                  type="date"
                  value={
                    complimentaryUntil
                  }
                  onChange={
                    (
                      event,
                    ) =>
                      setComplimentaryUntil(
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

            ) : null}

          </div>


          <label className="flex cursor-pointer items-center justify-between rounded-[16px] border bg-muted/10 p-4">

            <div>

              <p className="text-sm font-semibold">
                Cancel at period end
              </p>


              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Reserved for future recurring billing. It does not trigger any payment gateway action yet.
              </p>

            </div>


            <input
              type="checkbox"
              checked={
                cancelAtPeriodEnd
              }
              onChange={
                (
                  event,
                ) =>
                  setCancelAtPeriodEnd(
                    event.target.checked,
                  )
              }
              disabled={
                saving
              }
              className="h-4 w-4"
            />

          </label>


          {complimentaryMode ===
          "lifetime" ? (

            <div className="rounded-[16px] border bg-muted/20 p-4">

              <div className="flex items-start gap-3">

                <Gift className="mt-0.5 h-4 w-4 shrink-0" />


                <div>

                  <p className="text-sm font-semibold">
                    Lifetime complimentary billing
                  </p>


                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    The tenant still belongs to the selected commercial plan. ARC simply treats billing as permanently complimentary for this business.
                  </p>

                </div>

              </div>

            </div>

          ) : null}


          <div className="flex justify-end gap-2 border-t pt-5">

            <Button
              type="button"
              variant="outline"
              disabled={
                saving
              }
              onClick={() =>
                setEditing(
                  null,
                )
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
                : "Save Subscription"}
            </Button>

          </div>

        </form>

      </Dialog>

    </div>
  );
}
