"use client";

import * as React from "react";
import { ArchiveRestore, Database, Download, HardDrive, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlatformBackupRecordDialog } from "@/components/platform/PlatformBackupRecordDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  fetchPlatformBackupEvents,
  fetchPlatformBackupOverview,
  fetchPlatformBusinesses,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminRole,
  PlatformBackupEvent,
  PlatformBackupOverview,
  PlatformBusiness,
} from "@/lib/domain/platform-admin";


function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}


function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}


export function PlatformBackupsClient({
  basePath,
  currentRole,
}: {
  basePath: string;
  currentRole: PlatformAdminRole;
}) {
  const canManage =
    currentRole === "owner" ||
    currentRole === "admin";

  const [recordOpen, setRecordOpen] =
    React.useState(false);
  const [overview, setOverview] =
    React.useState<PlatformBackupOverview | null>(null);

  const [events, setEvents] =
    React.useState<PlatformBackupEvent[]>([]);

  const [businesses, setBusinesses] =
    React.useState<PlatformBusiness[]>([]);

  const [loading, setLoading] =
    React.useState(true);

  const [error, setError] =
    React.useState<string | null>(null);


  const load = React.useCallback(async () => {
    setError(null);

    try {
      const [nextOverview, nextEvents, nextBusinesses] =
        await Promise.all([
          fetchPlatformBackupOverview(),
          fetchPlatformBackupEvents(),
          fetchPlatformBusinesses(),
        ]);

      setOverview(nextOverview);
      setEvents(nextEvents);
      setBusinesses(nextBusinesses);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Backup and recovery data could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);


  React.useEffect(() => {
    void load();
  }, [load]);


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recovery
          </p>

          <h1 className="mt-1 text-2xl font-bold">
            Backups
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Database backups, Storage snapshots, tenant exports and restore testing are tracked separately.
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>

          {canManage ? (
            <Button
              type="button"
              onClick={() => setRecordOpen(true)}
            >
              Record Event
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <Database className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest DB dump
            </p>
            <p className="mt-2 text-sm font-semibold">
              {loading ? "Loading…" : formatDate(overview?.latestDatabaseDumpAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest Storage snapshot
            </p>
            <p className="mt-2 text-sm font-semibold">
              {loading ? "Loading…" : formatDate(overview?.latestStorageSnapshotAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <ArchiveRestore className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Latest restore test
            </p>
            <p className="mt-2 text-sm font-semibold">
              {loading ? "Loading…" : formatDate(overview?.latestRestoreTestAt)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <Download className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tenant exports
            </p>
            <p className="mt-2 text-3xl font-bold">
              {loading ? "—" : overview?.tenantExportCount ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recovery model</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-[16px] border bg-muted/10 p-4">
              <p className="text-sm font-semibold">Database</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Keep provider-managed backups plus an independent logical dump before handoff and risky migrations.
              </p>
            </div>

            <div className="rounded-[16px] border bg-muted/10 p-4">
              <p className="text-sm font-semibold">Storage</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Database backups do not contain the actual Storage object bytes, so Storage requires its own backup.
              </p>
            </div>

            <div className="rounded-[16px] border bg-muted/10 p-4">
              <p className="text-sm font-semibold">Restore test</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Production readiness requires proving a backup can be restored in an isolated environment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tenant exports</CardTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Exports contain tenant data and a Storage manifest. Passwords and Storage file bytes are not included.
          </p>
        </CardHeader>

        <CardContent>
          {businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading businesses…" : "No businesses found."}
            </p>
          ) : (
            <div className="space-y-3">
              {businesses.map((business) => (
                <div
                  key={business.id}
                  className="flex flex-col gap-3 rounded-[16px] border bg-muted/10 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {business.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {business.ownerEmail}
                    </p>
                  </div>

                  <Button asChild variant="outline">
                    <a
                      href={`${basePath}/api/backups/business/${business.id}`}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Export
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recovery history</CardTitle>
        </CardHeader>

        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading recovery history…" : "No recovery events recorded yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[16px] border bg-muted/10 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold">
                      {humanize(event.kind)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.occurredAt)}
                    </p>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {event.status === "success" ? "Success" : "Failed"}
                    {event.businessName ? ` · ${event.businessName}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PlatformBackupRecordDialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onRecorded={() => {
          setLoading(true);
          void load();
        }}
      />
    </div>
  );
}
