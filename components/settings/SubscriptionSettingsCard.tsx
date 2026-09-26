"use client";

import * as React from "react";

import {
  Check,
  Crown,
  Gift,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  useSubscription,
} from "@/hooks/use-subscription";

import {
  fetchAvailablePlans,
} from "@/lib/data/subscription";

import type {
  NovaAvailablePlan,
} from "@/lib/domain/subscription";


function formatPrice(
  value:
    number |
    null,
) {
  if (
    value ===
      null
  ) {
    return "Price not set";
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


export function SubscriptionSettingsCard() {
  const {
    business,
  } =
    useCurrentBusiness();


  const {
    subscription,
    loading:
      subscriptionLoading,
    error:
      subscriptionError,
  } =
    useSubscription();


  const [
    plans,
    setPlans,
  ] =
    React.useState<
      NovaAvailablePlan[]
    >(
      [],
    );


  const [
    plansLoading,
    setPlansLoading,
  ] =
    React.useState(
      true,
    );


  const [
    plansError,
    setPlansError,
  ] =
    React.useState<
      string |
      null
    >(
      null,
    );


  React.useEffect(() => {
    let cancelled =
      false;


    void fetchAvailablePlans()
      .then(
        (
          result,
        ) => {
          if (
            cancelled
          ) {
            return;
          }


          setPlans(
            result,
          );

          setPlansError(
            null,
          );
        },
      )
      .catch(
        (
          cause,
        ) => {
          if (
            cancelled
          ) {
            return;
          }


          setPlansError(
            cause instanceof Error
              ? cause.message
              : "Available plans could not be loaded.",
          );
        },
      )
      .finally(
        () => {
          if (
            !cancelled
          ) {
            setPlansLoading(
              false,
            );
          }
        },
      );


    return () => {
      cancelled =
        true;
    };
  }, []);


  const currentCode =
    subscription?.plan?.code;


  const currentSortOrder =
    plans.find(
      (
        plan,
      ) =>
        plan.code ===
          currentCode,
    )?.sortOrder;


  const complimentaryLabel =
    subscription?.complimentaryMode ===
      "lifetime"
      ? "Complimentary lifetime"
      : subscription?.complimentaryMode ===
          "until_date"
        ? subscription.complimentaryUntil
          ? `Complimentary until ${subscription.complimentaryUntil}`
          : "Complimentary"
        : "Normal billing";


  return (
    <div className="space-y-6">

      <Card className="rounded-[24px]">

        <CardHeader>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

            <div>

              <CardTitle>
                Current Plan
              </CardTitle>


              <p className="mt-2 text-sm text-muted-foreground">
                Your ARC package and billing status.
              </p>

            </div>


            {subscription?.configured &&
            subscription.plan ? (

              <span className="w-fit rounded-full border bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                {subscription.plan.name}
              </span>

            ) : null}

          </div>

        </CardHeader>


        <CardContent>

          {subscriptionLoading ? (

            <div className="rounded-[18px] border bg-muted/20 p-6 text-sm text-muted-foreground">
              Loading subscription…
            </div>

          ) : subscriptionError ? (

            <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              {subscriptionError}
            </div>

          ) : !subscription?.configured ||
            !subscription.plan ? (

            <div className="rounded-[18px] border border-dashed p-6">

              <p className="font-semibold">
                No package assigned yet
              </p>


              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                ARC Platform must assign a package before commercial billing begins.
              </p>

            </div>

          ) : (

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

              <div className="rounded-[18px] border bg-muted/20 p-5">

                <p className="text-xs font-medium text-muted-foreground">
                  Package
                </p>


                <p className="mt-2 text-lg font-bold">
                  {subscription.plan.name}
                </p>

              </div>


              <div className="rounded-[18px] border bg-muted/20 p-5">

                <p className="text-xs font-medium text-muted-foreground">
                  Status
                </p>


                <p className="mt-2 font-semibold">
                  {humanize(
                    subscription.status ??
                    "active",
                  )}
                </p>

              </div>


              <div className="rounded-[18px] border bg-muted/20 p-5">

                <p className="text-xs font-medium text-muted-foreground">
                  Billing interval
                </p>


                <p className="mt-2 font-semibold">
                  {humanize(
                    subscription.billingInterval ??
                    "monthly",
                  )}
                </p>

              </div>


              <div className="rounded-[18px] border bg-muted/20 p-5">

                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">

                  {subscription.complimentaryActive ? (
                    <Gift className="h-4 w-4" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}

                  Billing
                </div>


                <p className="mt-2 font-semibold">
                  {complimentaryLabel}
                </p>

              </div>

            </div>

          )}

        </CardContent>

      </Card>


      <Card className="rounded-[24px]">

        <CardHeader>

          <CardTitle>
            Compare Plans
          </CardTitle>


          <p className="text-sm leading-6 text-muted-foreground">
            Starter, Pro and Business are managed from the ARC package catalog. Self-service payments will be connected when the payment gateway goes live.
          </p>

        </CardHeader>


        <CardContent>

          {plansLoading ? (

            <div className="rounded-[18px] border bg-muted/20 p-6 text-sm text-muted-foreground">
              Loading plans…
            </div>

          ) : plansError ? (

            <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
              {plansError}
            </div>

          ) : (

            <div className="grid gap-4 xl:grid-cols-3">

              {plans.map(
                (
                  plan,
                ) => {
                  const current =
                    plan.code ===
                      currentCode;


                  const upgrade =
                    currentSortOrder !==
                      undefined &&
                    plan.sortOrder >
                      currentSortOrder;


                  const enabledFeatures =
                    Object.entries(
                      plan.entitlements ??
                        {},
                    )
                      .filter(
                        (
                          [
                            ,
                            enabled,
                          ],
                        ) =>
                          enabled,
                      )
                      .slice(
                        0,
                        5,
                      );


                  return (
                    <div
                      key={
                        plan.id
                      }
                      className={
                        current
                          ? "flex flex-col rounded-[20px] border border-primary/40 bg-primary/5 p-5"
                          : "flex flex-col rounded-[20px] border bg-muted/10 p-5"
                      }
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {plan.code}
                          </p>


                          <h3 className="mt-1 text-xl font-bold">
                            {plan.name}
                          </h3>

                        </div>


                        {current ? (

                          <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                            Current
                          </span>

                        ) : null}

                      </div>


                      <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                        {plan.description ||
                          "ARC commercial package."}
                      </p>


                      <div className="mt-4 rounded-[14px] border bg-background/70 p-4">

                        <p className="text-xs text-muted-foreground">
                          Monthly
                        </p>


                        <p className="mt-1 text-lg font-bold">
                          {formatPrice(
                            plan.monthlyPriceLkr,
                          )}
                        </p>


                        <p className="mt-3 text-xs text-muted-foreground">
                          Yearly
                        </p>


                        <p className="mt-1 font-semibold">
                          {formatPrice(
                            plan.yearlyPriceLkr,
                          )}
                        </p>

                      </div>


                      {enabledFeatures.length >
                      0 ? (

                        <div className="mt-4 space-y-2">

                          {enabledFeatures.map(
                            (
                              [
                                key,
                              ],
                            ) => (
                              <div
                                key={
                                  key
                                }
                                className="flex items-center gap-2 text-xs"
                              >
                                <Check className="h-3.5 w-3.5 shrink-0" />

                                {humanize(
                                  key,
                                )}
                              </div>
                            ),
                          )}

                        </div>

                      ) : (

                        <p className="mt-4 text-xs leading-5 text-muted-foreground">
                          Features and limits will appear here as you configure them in ARC Control.
                        </p>

                      )}


                      <div className="mt-auto pt-5">

                        <div
                          className={
                            current
                              ? "rounded-[12px] border bg-background px-3 py-2 text-center text-xs font-semibold"
                              : "rounded-[12px] border border-dashed bg-muted/20 px-3 py-2 text-center text-xs font-medium text-muted-foreground"
                          }
                        >
                          {current
                            ? "Current Plan"
                            : "Available via ARC Control"}
                        </div>


                        {!current ? (

                          <p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground">
                            Package changes are assigned by the platform administrator until self-service billing is connected.
                          </p>

                        ) : null}

                      </div>

                    </div>
                  );
                },
              )}

            </div>

          )}

        </CardContent>

      </Card>




    </div>
  );
}
