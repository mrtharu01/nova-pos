"use client";

import * as React from "react";

import {
  CheckCircle2,
  Crown,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { useCurrentBusiness } from "@/hooks/use-current-business";

import { useBusinessAccess } from "@/hooks/use-business-access";

import {
  addBusinessStaff,
  fetchBusinessStaff,
  updateBusinessStaff,
} from "@/lib/data/access";

import type { BusinessStaffMember, StaffRole } from "@/lib/domain/access";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Staff could not be updated.";
}

export function StaffSettingsCard() {
  const { business } = useCurrentBusiness();

  const { access, loading: accessLoading } = useBusinessAccess(business?.id);

  const [staff, setStaff] = React.useState<BusinessStaffMember[]>([]);

  const [loading, setLoading] = React.useState(true);

  const [email, setEmail] = React.useState("");

  const [role, setRole] = React.useState<StaffRole>("cashier");

  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [adding, setAdding] = React.useState(false);

  const [error, setError] = React.useState<string | null>(null);

  const [success, setSuccess] = React.useState<string | null>(null);

  async function loadStaff() {
    if (!business?.id) {
      return;
    }

    setLoading(true);

    setError(null);

    try {
      const result = await fetchBusinessStaff(business.id);

      setStaff(result);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    if (!business?.id || !access?.permissions.manageStaff) {
      return;
    }

    void loadStaff();
  }, [business?.id, access?.permissions.manageStaff]);

  async function handleAdd() {
    if (!business?.id || adding) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid staff email.");

      return;
    }

    setAdding(true);

    setError(null);

    setSuccess(null);

    try {
      await addBusinessStaff({
        businessId: business.id,

        email: normalizedEmail,

        role,
      });

      setEmail("");

      setSuccess("Staff access added successfully.");

      await loadStaff();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setAdding(false);
    }
  }

  async function updateMember(
    member: BusinessStaffMember,

    changes: {
      role?: StaffRole;

      disabled?: boolean;
    },
  ) {
    if (!business?.id || !member.staffId) {
      return;
    }

    setBusyId(member.staffId);

    setError(null);

    setSuccess(null);

    try {
      await updateBusinessStaff({
        businessId: business.id,

        staffId: member.staffId,

        role:
          changes.role ?? (member.role === "manager" ? "manager" : "cashier"),

        status: changes.disabled ? "disabled" : "active",
      });

      setSuccess("Staff access updated.");

      await loadStaff();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  }

  if (accessLoading) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!access?.permissions.manageStaff) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-4 font-semibold">Manager access required</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Cashier accounts cannot manage business staff.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* =========================================
          ADD STAFF
      ========================================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>Add Staff Member</CardTitle>

          <p className="text-sm text-muted-foreground">
            The staff member must already have a NOVA account using this email.
          </p>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_auto]">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@example.com"
              className="h-11 rounded-[14px]"
            />

            <select
              value={role}
              onChange={(event) => setRole(event.target.value as StaffRole)}
              className="h-11 rounded-[14px] border bg-background px-3 text-sm outline-none"
            >
              <option value="cashier">Cashier</option>

              {access.permissions.manageManagers && (
                <option value="manager">Manager</option>
              )}
            </select>

            <Button
              type="button"
              className="h-11 rounded-[14px]"
              disabled={adding}
              onClick={() => void handleAdd()}
            >
              {adding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Staff
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* =========================================
          STATUS
      ========================================== */}

      {error && (
        <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

          {error}
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-[16px] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          {success}
        </div>
      )}

      {/* =========================================
          STAFF LIST
      ========================================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Business Staff</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Control who can access this NOVA business.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[12px]"
              disabled={loading}
              onClick={() => void loadStaff()}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map((member) => {
                const busy = busyId === member.staffId;

                const canEdit =
                  !member.isOwner &&
                  (access.permissions.manageManagers ||
                    member.role === "cashier");

                return (
                 <div
  key={
    member.isOwner
      ? `owner-${member.userId}`
      : member.staffId ?? `staff-${member.userId}`
  } className="flex flex-col gap-4 rounded-[18px] border bg-muted/15 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-muted">
                        {member.isOwner ? (
                          <Crown className="h-5 w-5" />
                        ) : member.role === "manager" ? (
                          <ShieldCheck className="h-5 w-5" />
                        ) : (
                          <UserRound className="h-5 w-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold">{member.email}</p>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{member.role}</span>

                          <span>·</span>

                          <span
                            className={
                              member.status === "active"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-destructive"
                            }
                          >
                            {member.status === "active" ? "Active" : "Disabled"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {member.isOwner ? (
                      <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                        Business Owner
                      </span>
                    ) : canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        {access.permissions.manageManagers && (
                          <select
                            value={
                              member.role === "manager" ? "manager" : "cashier"
                            }
                            disabled={busy}
                            onChange={(event) =>
                              void updateMember(member, {
                                role: event.target.value as StaffRole,

                                disabled: member.status === "disabled",
                              })
                            }
                            className="h-9 rounded-[12px] border bg-background px-3 text-xs outline-none"
                          >
                            <option value="cashier">Cashier</option>

                            <option value="manager">Manager</option>
                          </select>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          variant={
                            member.status === "active" ? "outline" : "default"
                          }
                          className="rounded-[12px]"
                          disabled={busy}
                          onClick={() =>
                            void updateMember(member, {
                              disabled: member.status === "active",
                            })
                          }
                        >
                          {busy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : member.status === "active" ? (
                            <UserRoundX className="mr-2 h-4 w-4" />
                          ) : (
                            <UserRoundCheck className="mr-2 h-4 w-4" />
                          )}

                          {member.status === "active"
                            ? "Disable"
                            : "Reactivate"}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Owner managed
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
