"use client";

import * as React from "react";

import {
  Activity,
  Building2,
  RefreshCw,
  Users,
  UserRoundCog,
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
  fetchPlatformAudit,
  fetchPlatformBusinesses,
  fetchPlatformOverview,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminOverview,
  PlatformAuditEntry,
  PlatformBusiness,
} from "@/lib/domain/platform-admin";


function formatDate(
  value: string,
) {
  try {
    return new Intl.DateTimeFormat(
      undefined,
      {
        dateStyle:
          "medium",

        timeStyle:
          "short",
      },
    ).format(
      new Date(
        value,
      ),
    );
  } catch {
    return value;
  }
}


export function PlatformDashboardClient() {
  const [
    overview,
    setOverview,
  ] =
    React.useState<
      PlatformAdminOverview |
      null
    >(
      null,
    );


  const [
    businesses,
    setBusinesses,
  ] =
    React.useState<
      PlatformBusiness[]
    >(
      [],
    );


  const [
    audit,
    setAudit,
  ] =
    React.useState<
      PlatformAuditEntry[]
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
    refreshing,
    setRefreshing,
  ] =
    React.useState(
      false,
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


  const load =
    React.useCallback(
      async () => {
        setError(
          null,
        );


        try {
          const [
            nextOverview,
            nextBusinesses,
            nextAudit,
          ] =
            await Promise.all([
              fetchPlatformOverview(),

              fetchPlatformBusinesses(),

              fetchPlatformAudit(),
            ]);


          setOverview(
            nextOverview,
          );

          setBusinesses(
            nextBusinesses
              .slice(
                0,
                6,
              ),
          );

          setAudit(
            nextAudit
              .slice(
                0,
                6,
              ),
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "ARC Platform dashboard could not load.",
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


  async function refresh() {
    setRefreshing(
      true,
    );


    await load();


    setRefreshing(
      false,
    );
  }


  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            ARC Platform
          </p>


          <h1 className="mt-1 text-2xl font-bold">
            Dashboard
          </h1>


          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Platform-wide businesses, staff, administration and recent activity.
          </p>

        </div>


        <Button
          type="button"
          variant="outline"
          onClick={() =>
            void refresh()
          }
          disabled={
            refreshing
          }
        >
          <RefreshCw
            className={
              refreshing
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


      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        {[
          {
            label:
              "Businesses",

            value:
              overview?.businessCount,

            icon:
              Building2,
          },
          {
            label:
              "Active staff",

            value:
              overview?.activeStaffCount,

            icon:
              Users,
          },
          {
            label:
              "Platform admins",

            value:
              overview?.platformAdminCount,

            icon:
              UserRoundCog,
          },
          {
            label:
              "New / 30 days",

            value:
              overview?.businessesLast30Days,

            icon:
              Activity,
          },
        ].map(
          (
            item,
          ) => {
            const Icon =
              item.icon;


            return (
              <Card
                key={
                  item.label
                }
              >

                <CardContent className="p-5">

                  <div className="flex items-center justify-between">

                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.label}
                    </p>


                    <Icon className="h-4 w-4 text-muted-foreground" />

                  </div>


                  <p className="mt-3 text-3xl font-bold">
                    {loading
                      ? "—"
                      : item.value ??
                        0}
                  </p>

                </CardContent>

              </Card>
            );
          },
        )}

      </div>


      <div className="grid gap-6 xl:grid-cols-2">

        <Card>

          <CardHeader>

            <CardTitle>
              Recent businesses
            </CardTitle>

          </CardHeader>


          <CardContent>

            {loading ? (

              <p className="text-sm text-muted-foreground">
                Loading businesses…
              </p>

            ) : businesses.length ===
              0 ? (

              <p className="text-sm text-muted-foreground">
                No businesses found.
              </p>

            ) : (

              <div className="space-y-3">

                {businesses.map(
                  (
                    business,
                  ) => (

                    <div
                      key={
                        business.id
                      }
                      className="rounded-[16px] border bg-muted/10 p-4"
                    >

                      <p className="font-semibold">
                        {business.name}
                      </p>


                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {business.ownerEmail}
                      </p>


                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">

                        <span>
                          {business.staffCount} staff
                        </span>


                        <span>
                          {formatDate(
                            business.createdAt,
                          )}
                        </span>

                      </div>

                    </div>

                  ),
                )}

              </div>

            )}

          </CardContent>

        </Card>


        <Card>

          <CardHeader>

            <CardTitle>
              Recent admin activity
            </CardTitle>

          </CardHeader>


          <CardContent>

            {loading ? (

              <p className="text-sm text-muted-foreground">
                Loading activity…
              </p>

            ) : audit.length ===
              0 ? (

              <p className="text-sm text-muted-foreground">
                No platform administration activity yet.
              </p>

            ) : (

              <div className="space-y-3">

                {audit.map(
                  (
                    entry,
                  ) => (

                    <div
                      key={
                        entry.id
                      }
                      className="rounded-[16px] border bg-muted/10 p-4"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div className="min-w-0">

                          <p className="font-semibold">
                            {entry.action}
                          </p>


                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {entry.actorEmail ??
                              "System"}

                            {entry.targetBusinessName
                              ? ` · ${entry.targetBusinessName}`
                              : ""}
                          </p>

                        </div>


                        <p className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDate(
                            entry.createdAt,
                          )}
                        </p>

                      </div>

                    </div>

                  ),
                )}

              </div>

            )}

          </CardContent>

        </Card>

      </div>

    </div>
  );
}
