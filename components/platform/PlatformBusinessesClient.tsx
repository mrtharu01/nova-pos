"use client";

import * as React from "react";

import Link from "next/link";

import {
  RefreshCw,
  Search,
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
  fetchPlatformBusinesses,
} from "@/lib/data/platform-admin";

import type {
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


export function PlatformBusinessesClient({
  basePath,
}: {
  basePath: string;
}) {
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
          setBusinesses(
            await fetchPlatformBusinesses(
              query,
            ),
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Businesses could not be loaded.",
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


  async function submit(
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


  return (
    <div className="space-y-6">

      <div>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Tenants
        </p>


        <h1 className="mt-1 text-2xl font-bold">
          Businesses
        </h1>


        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          View every NOVA business and its owner. Subscription and package controls connect here next.
        </p>

      </div>


      {error ? (

        <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>

      ) : null}


      <Card>

        <CardHeader className="gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <CardTitle>
              Tenant directory
            </CardTitle>


            <p className="mt-2 text-sm text-muted-foreground">
              {businesses.length} business{businesses.length === 1 ? "" : "es"} shown.
            </p>

          </div>


          <form
            onSubmit={
              submit
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
              Loading businesses…
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
                    className="grid gap-4 rounded-[18px] border bg-muted/10 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_0.7fr_0.8fr_auto]"
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


                      <p className="mt-1 text-sm font-medium">
                        {formatDate(
                          business.createdAt,
                        )}
                      </p>

                    </div>


                    <div className="flex items-center justify-end">

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <Link
                          href={
                            `${basePath}/businesses/${business.id}`
                          }
                        >
                          Open
                        </Link>
                      </Button>

                    </div>

                  </div>

                ),
              )}

            </div>

          )}

        </CardContent>

      </Card>

    </div>
  );
}
