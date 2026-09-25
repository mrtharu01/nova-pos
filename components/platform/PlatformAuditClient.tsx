"use client";

import * as React from "react";

import {
  RefreshCw,
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
} from "@/lib/data/platform-admin";

import type {
  PlatformAuditEntry,
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


export function PlatformAuditClient() {
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
          setAudit(
            await fetchPlatformAudit(),
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Audit log could not be loaded.",
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


  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Security & Operations
          </p>


          <h1 className="mt-1 text-2xl font-bold">
            Audit Log
          </h1>


          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Platform-level administrative actions are recorded here.
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


      <Card>

        <CardHeader>

          <CardTitle>
            Platform activity
          </CardTitle>

        </CardHeader>


        <CardContent>

          {loading ? (

            <p className="text-sm text-muted-foreground">
              Loading audit log…
            </p>

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

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                      <div className="min-w-0">

                        <p className="font-semibold">
                          {entry.action}
                        </p>


                        <p className="mt-1 truncate text-sm text-muted-foreground">
                          {entry.actorEmail ??
                            "System"}

                          {entry.targetBusinessName
                            ? ` · ${entry.targetBusinessName}`
                            : ""}
                        </p>

                      </div>


                      <p className="shrink-0 text-xs text-muted-foreground">
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
  );
}
