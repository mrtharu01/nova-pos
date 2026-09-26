"use client";

import * as React from "react";

import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  RefreshCw,
  ShieldCheck,
  Store,
} from "lucide-react";

import Link from "next/link";

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
  Textarea,
} from "@/components/ui/textarea";

import {
  fetchPlatformBusinessProductionReadiness,
  savePlatformBusinessHandoffChecklist,
  setPlatformBusinessHandoffApproval,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminRole,
  PlatformBusinessProductionReadiness,
} from "@/lib/domain/platform-admin";


type ManualKey =
  | "businessDetailsVerified"
  | "staffAccessVerified"
  | "scannerVerified"
  | "receiptPrintVerified"
  | "backupFilesVerified"
  | "trainingCompleted";


const MANUAL_CHECKS: {
  key: ManualKey;
  label: string;
  description: string;
}[] = [
  {
    key: "businessDetailsVerified",
    label: "Business details verified",
    description: "Name, timezone, currency and real shop details are correct.",
  },
  {
    key: "staffAccessVerified",
    label: "Owner / staff access verified",
    description: "Permanent owner and staff can sign in with the correct roles.",
  },
  {
    key: "scannerVerified",
    label: "Scanner verified",
    description: "Phone scanner pairing and product scanning were tested on the real setup.",
  },
  {
    key: "receiptPrintVerified",
    label: "Receipt print verified",
    description: "Receipt logo/details and the physical print result were checked.",
  },
  {
    key: "backupFilesVerified",
    label: "Backup files verified",
    description: "Logical dump, off-site encrypted copy and Storage snapshot were checked.",
  },
  {
    key: "trainingCompleted",
    label: "Handoff training completed",
    description: "The permanent user knows checkout, scanner, sales, refunds and daily operations.",
  },
];


const AUTOMATIC_LABELS: {
  key:
    keyof PlatformBusinessProductionReadiness["automaticChecks"];
  label: string;
  description: string;
}[] = [
  {
    key: "ownerConfirmed",
    label: "Owner account confirmed",
    description: "The business owner has a confirmed ARC account.",
  },
  {
    key: "catalogConfigured",
    label: "Catalog configured",
    description: "At least one active product and variant exist.",
  },
  {
    key: "inventoryConfigured",
    label: "Inventory configured",
    description: "An active location and inventory rows exist.",
  },
  {
    key: "receiptConfigured",
    label: "Receipt details configured",
    description: "Receipt settings include a real display name.",
  },
  {
    key: "subscriptionActive",
    label: "Subscription active",
    description: "The tenant has an active commercial plan.",
  },
  {
    key: "lifetimeComplimentary",
    label: "Lifetime complimentary",
    description: "Expected for the cousin production tenant.",
  },
  {
    key: "realTransactionCompleted",
    label: "Real transaction completed",
    description: "At least one non-voided sale exists for this tenant.",
  },
  {
    key: "tenantExportCompleted",
    label: "Tenant export completed",
    description: "A successful tenant export was recorded.",
  },
  {
    key: "databaseBackupRecorded",
    label: "Database backup recorded",
    description: "A successful independent database dump is recorded.",
  },
  {
    key: "storageSnapshotRecorded",
    label: "Storage snapshot recorded",
    description: "A successful Storage snapshot is recorded.",
  },
  {
    key: "restoreTestRecorded",
    label: "Restore test recorded",
    description: "An isolated restore test has passed.",
  },
];


function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "—";
  }

  try {
    return new Intl.DateTimeFormat(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short",
      },
    ).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}


export function PlatformBusinessDetailClient({
  businessId,
  basePath,
  currentRole,
}: {
  businessId: string;
  basePath: string;
  currentRole: PlatformAdminRole;
}) {
  const canManage =
    currentRole === "owner" ||
    currentRole === "admin";

  const [
    readiness,
    setReadiness,
  ] =
    React.useState<
      PlatformBusinessProductionReadiness |
      null
    >(null);

  const [
    manual,
    setManual,
  ] =
    React.useState<
      PlatformBusinessProductionReadiness["manualChecks"] |
      null
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
      string |
      null
    >(null);

  const [
    notice,
    setNotice,
  ] =
    React.useState<
      string |
      null
    >(null);


  const load =
    React.useCallback(
      async () => {
        setError(null);

        try {
          const next =
            await fetchPlatformBusinessProductionReadiness(
              businessId,
            );

          setReadiness(next);
          setManual(next.manualChecks);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Production readiness could not be loaded.",
          );
        } finally {
          setLoading(false);
        }
      },
      [
        businessId,
      ],
    );


  React.useEffect(() => {
    void load();
  }, [load]);


  async function saveChecklist() {
    if (
      !canManage ||
      !manual ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const next =
        await savePlatformBusinessHandoffChecklist({
          businessId,
          businessDetailsVerified:
            manual.businessDetailsVerified,
          staffAccessVerified:
            manual.staffAccessVerified,
          scannerVerified:
            manual.scannerVerified,
          receiptPrintVerified:
            manual.receiptPrintVerified,
          backupFilesVerified:
            manual.backupFilesVerified,
          trainingCompleted:
            manual.trainingCompleted,
          notes:
            manual.notes,
        });

      setReadiness(next);
      setManual(next.manualChecks);
      setNotice("Production handoff checklist saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Checklist could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function changeApproval(
    approved: boolean,
  ) {
    if (
      !canManage ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const next =
        await setPlatformBusinessHandoffApproval(
          businessId,
          approved,
        );

      setReadiness(next);
      setManual(next.manualChecks);
      setNotice(
        approved
          ? "Production handoff approved."
          : "Production handoff reopened.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Handoff approval could not be changed.",
      );
    } finally {
      setSaving(false);
    }
  }


  if (
    loading &&
    !readiness
  ) {
    return (
      <div className="rounded-[24px] border bg-card p-10 text-center text-sm text-muted-foreground">
        Loading production readiness…
      </div>
    );
  }


  if (
    !readiness ||
    !manual
  ) {
    return (
      <div className="space-y-4">
        <Button
          asChild
          variant="outline"
        >
          <Link href={`${basePath}/businesses`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Businesses
          </Link>
        </Button>

        <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error ??
            "This business could not be loaded."}
        </div>
      </div>
    );
  }


  const automaticPassed =
    Object.values(
      readiness.automaticChecks,
    ).filter(Boolean).length;

  const automaticTotal =
    Object.keys(
      readiness.automaticChecks,
    ).length;

  const manualPassed =
    MANUAL_CHECKS.filter(
      (
        item,
      ) =>
        manual[item.key],
    ).length;


  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>

          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-3 mb-3"
          >
            <Link href={`${basePath}/businesses`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Businesses
            </Link>
          </Button>


          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-[14px] border bg-card">
              <Store className="h-5 w-5" />
            </div>


            <div>

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Production Readiness
              </p>


              <h1 className="mt-1 text-2xl font-bold">
                {readiness.business.name}
              </h1>

            </div>

          </div>


          <p className="mt-3 text-sm text-muted-foreground">
            {readiness.business.ownerEmail}
            {" · "}
            {readiness.business.currencyCode}
            {" · "}
            {readiness.business.timezone}
          </p>

        </div>


        <div className="flex flex-wrap gap-2">

          <Button
            type="button"
            variant="outline"
            disabled={
              loading ||
              saving
            }
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>


          {canManage &&
          !readiness.handoffApproved ? (
            <Button
              type="button"
              disabled={
                saving ||
                !readiness.readyToHandoff
              }
              onClick={() =>
                void changeApproval(true)
              }
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              Approve Handoff
            </Button>
          ) : null}


          {canManage &&
          readiness.handoffApproved ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() =>
                void changeApproval(false)
              }
            >
              Reopen Handoff
            </Button>
          ) : null}

        </div>

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


      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Automatic
            </p>
            <p className="mt-3 text-3xl font-bold">
              {automaticPassed}/{automaticTotal}
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Manual
            </p>
            <p className="mt-3 text-3xl font-bold">
              {manualPassed}/{MANUAL_CHECKS.length}
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sales
            </p>
            <p className="mt-3 text-3xl font-bold">
              {readiness.counts.completedSales}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest: {formatDate(readiness.latestSaleAt)}
            </p>
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Handoff
            </p>
            <p className="mt-3 text-lg font-bold">
              {readiness.handoffApproved
                ? "Approved"
                : readiness.readyToHandoff
                  ? "Ready"
                  : "Not ready"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {readiness.handoffApproved
                ? formatDate(readiness.approvedAt)
                : "Approval stays locked until every required check passes."}
            </p>
          </CardContent>
        </Card>

      </div>


      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">

        <Card>

          <CardHeader>
            <CardTitle>
              Automatic production gates
            </CardTitle>

            <p className="text-sm leading-6 text-muted-foreground">
              These are calculated from ARC&apos;s actual database state and recovery records.
            </p>
          </CardHeader>


          <CardContent className="space-y-3">

            {AUTOMATIC_LABELS.map(
              (
                item,
              ) => {
                const passed =
                  readiness.automaticChecks[
                    item.key
                  ];

                return (
                  <div
                    key={item.key}
                    className="flex gap-3 rounded-[16px] border bg-muted/10 p-4"
                  >
                    {passed ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}

                    <div>
                      <p className="text-sm font-semibold">
                        {item.label}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              },
            )}

          </CardContent>

        </Card>


        <div className="space-y-6">

          <Card>

            <CardHeader>
              <CardTitle>
                Subscription
              </CardTitle>
            </CardHeader>


            <CardContent>

              {readiness.subscription ? (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Plan
                    </span>
                    <span className="font-semibold">
                      {readiness.subscription.planName}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Status
                    </span>
                    <span className="font-semibold capitalize">
                      {readiness.subscription.status.replaceAll("_", " ")}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Billing
                    </span>
                    <span className="font-semibold capitalize">
                      {readiness.subscription.complimentaryMode === "lifetime"
                        ? "Complimentary lifetime"
                        : readiness.subscription.complimentaryMode.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No subscription assigned yet.
                </p>
              )}

            </CardContent>

          </Card>


          <Card>

            <CardHeader>
              <CardTitle>
                Tenant data
              </CardTitle>
            </CardHeader>


            <CardContent className="grid grid-cols-2 gap-3">

              {[
                ["Products", readiness.counts.activeProducts],
                ["Variants", readiness.counts.activeVariants],
                ["Locations", readiness.counts.activeLocations],
                ["Inventory rows", readiness.counts.inventoryLevels],
                ["Staff", readiness.counts.activeStaff],
                ["Sales", readiness.counts.completedSales],
              ].map(
                (
                  [
                    label,
                    value,
                  ],
                ) => (
                  <div
                    key={String(label)}
                    className="rounded-[14px] border bg-muted/10 p-3"
                  >
                    <p className="text-xs text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-bold">
                      {value}
                    </p>
                  </div>
                ),
              )}

            </CardContent>

          </Card>

        </div>

      </div>


      <Card>

        <CardHeader>
          <CardTitle>
            Manual handoff checklist
          </CardTitle>

          <p className="text-sm leading-6 text-muted-foreground">
            Confirm the things that require a real-world test rather than only a database check.
          </p>
        </CardHeader>


        <CardContent className="space-y-4">

          <div className="grid gap-3 lg:grid-cols-2">

            {MANUAL_CHECKS.map(
              (
                item,
              ) => (
                <label
                  key={item.key}
                  className="flex cursor-pointer gap-3 rounded-[16px] border bg-muted/10 p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={
                      manual[
                        item.key
                      ]
                    }
                    disabled={
                      !canManage ||
                      saving ||
                      readiness.handoffApproved
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setManual(
                          (
                            current,
                          ) => current
                            ? {
                                ...current,
                                [item.key]:
                                  event.target.checked,
                              }
                            : current,
                        )
                    }
                  />

                  <div>
                    <p className="text-sm font-semibold">
                      {item.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </label>
              ),
            )}

          </div>


          <div>

            <label className="text-xs font-semibold text-muted-foreground">
              Handoff notes
            </label>

            <Textarea
              value={
                manual.notes
              }
              disabled={
                !canManage ||
                saving ||
                readiness.handoffApproved
              }
              onChange={
                (
                  event,
                ) =>
                  setManual(
                    (
                      current,
                    ) => current
                      ? {
                          ...current,
                          notes:
                            event.target.value,
                        }
                      : current,
                  )
              }
              placeholder="Production setup notes, training notes, device details, anything to verify before handoff."
              className="mt-2 min-h-28"
            />

          </div>


          {canManage &&
          !readiness.handoffApproved ? (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={saving}
                onClick={() =>
                  void saveChecklist()
                }
              >
                {saving
                  ? "Saving..."
                  : "Save Checklist"}
              </Button>
            </div>
          ) : null}

        </CardContent>

      </Card>

    </div>
  );
}
