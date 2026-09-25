"use client";

import * as React from "react";

import Link from "next/link";

import {
  Activity,
  ArrowLeft,
  Building2,
  RefreshCw,
  Search,
  ShieldCheck,
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
  Input,
} from "@/components/ui/input";

import {
  fetchPlatformAudit,
  fetchPlatformBusinesses,
  fetchPlatformOverview,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminAccess,
  PlatformAdminOverview,
  PlatformAuditEntry,
  PlatformBusiness,
} from "@/lib/domain/platform-admin";


type Tab =
  | "businesses"
  | "audit";


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


function roleLabel(
  role:
    PlatformAdminAccess["role"],
) {
  if (
    role ===
    "owner"
  ) {
    return "Platform Owner";
  }


  if (
    role ===
    "admin"
  ) {
    return "Platform Admin";
  }


  return "Support";
}


export function PlatformAdminClient({
  access,
}: {
  access:
    PlatformAdminAccess;
}) {
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
    search,
    setSearch,
  ] =
    React.useState(
      "",
    );


  const [
    activeTab,
    setActiveTab,
  ] =
    React.useState<Tab>(
      "businesses",
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
      async (
        query =
          "",
      ) => {
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

              fetchPlatformBusinesses(
                query,
              ),

              fetchPlatformAudit(),
            ]);


          setOverview(
            nextOverview,
          );

          setBusinesses(
            nextBusinesses,
          );

          setAudit(
            nextAudit,
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "NOVA Platform could not load.",
          );
        }
      },
      [],
    );


  React.useEffect(() => {
    let cancelled =
      false;


    async function initialLoad() {
      setLoading(
        true,
      );


      await load();


      if (
        !cancelled
      ) {
        setLoading(
          false,
        );
      }
    }


    void initialLoad();


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


    await load(
      search.trim(),
    );


    setRefreshing(
      false,
    );
  }


  async function submitSearch(
    event:
      React.FormEvent,
  ) {
    event.preventDefault();


    setRefreshing(
      true,
    );


    await load(
      search.trim(),
    );


    setRefreshing(
      false,
    );
  }


  return (
    <div className="min-h-[100dvh] bg-background">

      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-xl">

        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">

          <div className="min-w-0">

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">

              <ShieldCheck className="h-4 w-4" />

              NOVA Platform

            </div>


            <h1 className="mt-1 truncate text-xl font-bold">
              Control Center
            </h1>

          </div>


          <div className="flex items-center gap-2">

            <div className="hidden rounded-[12px] border bg-muted/30 px-3 py-2 text-xs font-semibold text-muted-foreground sm:block">
              {roleLabel(
                access.role,
              )}
            </div>


            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <Link href="/pos">

                <ArrowLeft className="mr-2 h-4 w-4" />

                POS

              </Link>
            </Button>

          </div>

        </div>

      </header>


      <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">

        {error ? (

          <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>

        ) : null}


        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Businesses
                </p>

                <Building2 className="h-4 w-4 text-muted-foreground" />

              </div>


              <p className="mt-3 text-3xl font-bold">
                {loading
                  ? "—"
                  : overview?.businessCount ??
                    0}
              </p>

            </CardContent>

          </Card>


          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Active staff
                </p>

                <Users className="h-4 w-4 text-muted-foreground" />

              </div>


              <p className="mt-3 text-3xl font-bold">
                {loading
                  ? "—"
                  : overview?.activeStaffCount ??
                    0}
              </p>

            </CardContent>

          </Card>


          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Platform admins
                </p>

                <UserRoundCog className="h-4 w-4 text-muted-foreground" />

              </div>


              <p className="mt-3 text-3xl font-bold">
                {loading
                  ? "—"
                  : overview?.platformAdminCount ??
                    0}
              </p>

            </CardContent>

          </Card>


          <Card>

            <CardContent className="p-5">

              <div className="flex items-center justify-between">

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New / 30 days
                </p>

                <Activity className="h-4 w-4 text-muted-foreground" />

              </div>


              <p className="mt-3 text-3xl font-bold">
                {loading
                  ? "—"
                  : overview?.businessesLast30Days ??
                    0}
              </p>

            </CardContent>

          </Card>

        </div>


        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="inline-flex w-fit rounded-[14px] border bg-muted/30 p-1">

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "businesses",
                )
              }
              className={
                activeTab ===
                "businesses"
                  ? "rounded-[10px] bg-background px-4 py-2 text-sm font-semibold shadow-sm"
                  : "rounded-[10px] px-4 py-2 text-sm font-medium text-muted-foreground"
              }
            >
              Businesses
            </button>


            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "audit",
                )
              }
              className={
                activeTab ===
                "audit"
                  ? "rounded-[10px] bg-background px-4 py-2 text-sm font-semibold shadow-sm"
                  : "rounded-[10px] px-4 py-2 text-sm font-medium text-muted-foreground"
              }
            >
              Audit
            </button>

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


        {activeTab ===
        "businesses" ? (

          <Card>

            <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">

              <div>

                <CardTitle>
                  Tenant directory
                </CardTitle>


                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  NOVA businesses and their owners. Package and billing controls connect here in Phase 4B.
                </p>

              </div>


              <form
                onSubmit={
                  submitSearch
                }
                className="flex w-full gap-2 sm:max-w-sm"
              >

                <Input
                  value={
                    search
                  }
                  onChange={
                    (event) =>
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
                  aria-label="Search businesses"
                >
                  <Search className="h-4 w-4" />
                </Button>

              </form>

            </CardHeader>


            <CardContent>

              {loading ? (

                <div className="rounded-[18px] border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Loading platform businesses…
                </div>

              ) : businesses.length ===
                0 ? (

                <div className="rounded-[18px] border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No businesses matched this search.
                </div>

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
                        className="grid gap-4 rounded-[18px] border bg-muted/10 p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_0.6fr_0.8fr]"
                      >

                        <div className="min-w-0">

                          <p className="truncate font-semibold">
                            {business.name}
                          </p>


                          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                            {business.id}
                          </p>

                        </div>


                        <div className="min-w-0">

                          <p className="text-xs font-medium text-muted-foreground">
                            Owner
                          </p>


                          <p className="mt-1 truncate text-sm font-medium">
                            {business.ownerEmail}
                          </p>

                        </div>


                        <div>

                          <p className="text-xs font-medium text-muted-foreground">
                            Staff
                          </p>


                          <p className="mt-1 text-sm font-semibold">
                            {business.staffCount}
                          </p>

                        </div>


                        <div>

                          <p className="text-xs font-medium text-muted-foreground">
                            Created
                          </p>


                          <p className="mt-1 text-xs font-medium">
                            {formatDate(
                              business.createdAt,
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

        ) : (

          <Card>

            <CardHeader>

              <CardTitle>
                Platform audit log
              </CardTitle>


              <p className="text-sm leading-6 text-muted-foreground">
                Platform-level administrative activity is recorded here.
              </p>

            </CardHeader>


            <CardContent>

              {loading ? (

                <div className="rounded-[18px] border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                  Loading audit log…
                </div>

              ) : audit.length ===
                0 ? (

                <div className="rounded-[18px] border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No platform administration activity yet.
                </div>

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
                        className="rounded-[18px] border bg-muted/10 p-4"
                      >

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                          <p className="font-semibold">
                            {entry.action}
                          </p>


                          <p className="text-xs text-muted-foreground">
                            {formatDate(
                              entry.createdAt,
                            )}
                          </p>

                        </div>


                        <p className="mt-2 text-sm text-muted-foreground">
                          {entry.actorEmail ??
                            "System"}

                          {entry.targetBusinessName
                            ? ` · ${entry.targetBusinessName}`
                            : ""}
                        </p>

                      </div>

                    ),
                  )}

                </div>

              )}

            </CardContent>

          </Card>

        )}

      </main>

    </div>
  );
}
