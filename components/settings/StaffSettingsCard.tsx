"use client";

import * as React from "react";

import {
  CheckCircle2,
  Clock3,
  Crown,
  Loader2,
  MailPlus,
  RefreshCw,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  X,
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
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  useBusinessAccess,
} from "@/hooks/use-business-access";

import {
  fetchBusinessStaff,
  fetchStaffInvitations,
  revokeStaffInvitation,
  sendStaffInvitation,
  updateBusinessStaff,
} from "@/lib/data/access";

import type {
  BusinessStaffMember,
  StaffInvitation,
  StaffRole,
} from "@/lib/domain/access";


/* ============================================================
   HELPERS
============================================================ */

function errorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : "Staff could not be updated.";
}


function formatDateTime(
  value: string,
) {
  const date =
    new Date(
      value,
    );


  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }


  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    },
  ).format(
    date,
  );
}


function roleLabel(
  role: StaffRole,
) {
  return role ===
    "manager"
    ? "Manager"
    : "Cashier";
}


/* ============================================================
   COMPONENT
============================================================ */

export function StaffSettingsCard() {
  const {
    business,
  } =
    useCurrentBusiness();


  const {
    access,

    loading:
      accessLoading,
  } =
    useBusinessAccess(
      business?.id,
    );


  const [
    staff,
    setStaff,
  ] =
    React.useState<
      BusinessStaffMember[]
    >([]);


  const [
    invitations,
    setInvitations,
  ] =
    React.useState<
      StaffInvitation[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );


  const [
    email,
    setEmail,
  ] =
    React.useState(
      "",
    );


  const [
    role,
    setRole,
  ] =
    React.useState<
      StaffRole
    >(
      "cashier",
    );


  const [
    busyId,
    setBusyId,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const [
    inviting,
    setInviting,
  ] =
    React.useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const [
    success,
    setSuccess,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  /* ==========================================================
     LOAD STAFF + INVITATIONS
  ========================================================== */

  const loadStaff =
    React.useCallback(
      async () => {
        if (
          !business?.id ||
          !access?.permissions
            .manageStaff
        ) {
          setLoading(
            false,
          );

          return;
        }


        setLoading(
          true,
        );

        setError(
          null,
        );


        try {
          const [
            staffResult,
            invitationResult,
          ] =
            await Promise.all([
              fetchBusinessStaff(
                business.id,
              ),

              fetchStaffInvitations(
                business.id,
              ),
            ]);


          setStaff(
            staffResult,
          );


          setInvitations(
            invitationResult,
          );
        } catch (cause) {
          setError(
            errorMessage(
              cause,
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        business?.id,
        access?.permissions
          .manageStaff,
      ],
    );


  React.useEffect(() => {
    void loadStaff();
  }, [
    loadStaff,
  ]);


  /* ==========================================================
     SEND INVITATION
  ========================================================== */

  async function handleInvite() {
    if (
      !business?.id ||
      inviting
    ) {
      return;
    }


    const normalizedEmail =
      email
        .trim()
        .toLowerCase();


    if (
      !normalizedEmail ||
      !normalizedEmail.includes(
        "@",
      )
    ) {
      setError(
        "Enter a valid staff email.",
      );

      return;
    }


    setInviting(
      true,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );


    try {
      const result =
        await sendStaffInvitation({
          businessId:
            business.id,

          email:
            normalizedEmail,

          role,
        });


      setEmail(
        "",
      );


      if (
        result.status ===
        "existing_user_added"
      ) {
        setSuccess(
          "This person already had a verified NOVA account, so access was added immediately.",
        );
      } else {
        setSuccess(
          `Invitation sent to ${normalizedEmail}.`,
        );
      }


      await loadStaff();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setInviting(
        false,
      );
    }
  }


  /* ==========================================================
     RESEND INVITATION
  ========================================================== */

  async function handleResend(
    invitation:
      StaffInvitation,
  ) {
    if (
      !business?.id
    ) {
      return;
    }


    const busyKey =
      `resend-${invitation.id}`;


    setBusyId(
      busyKey,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );


    try {
      const result =
        await sendStaffInvitation({
          businessId:
            business.id,

          email:
            invitation.email,

          role:
            invitation.role,
        });


      if (
        result.status ===
        "existing_user_added"
      ) {
        setSuccess(
          `${invitation.email} now has active NOVA access.`,
        );
      } else {
        setSuccess(
          `A fresh invitation was sent to ${invitation.email}.`,
        );
      }


      await loadStaff();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }


  /* ==========================================================
     REVOKE INVITATION
  ========================================================== */

  async function handleRevoke(
    invitation:
      StaffInvitation,
  ) {
    const busyKey =
      `revoke-${invitation.id}`;


    setBusyId(
      busyKey,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );


    try {
      await revokeStaffInvitation(
        invitation.id,
      );


      setSuccess(
        `Invitation for ${invitation.email} was revoked.`,
      );


      await loadStaff();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }


  /* ==========================================================
     UPDATE ACTIVE STAFF
  ========================================================== */

  async function updateMember(
    member:
      BusinessStaffMember,

    changes: {
      role?:
        StaffRole;

      disabled?:
        boolean;
    },
  ) {
    if (
      !business?.id ||
      !member.staffId
    ) {
      return;
    }


    setBusyId(
      member.staffId,
    );

    setError(
      null,
    );

    setSuccess(
      null,
    );


    try {
      await updateBusinessStaff({
        businessId:
          business.id,

        staffId:
          member.staffId,

        role:
          changes.role ??
          (
            member.role ===
            "manager"
              ? "manager"
              : "cashier"
          ),

        status:
          changes.disabled
            ? "disabled"
            : "active",
      });


      setSuccess(
        "Staff access updated.",
      );


      await loadStaff();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setBusyId(
        null,
      );
    }
  }


  /* ==========================================================
     ACCESS LOADING
  ========================================================== */

  if (
    accessLoading
  ) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }


  /* ==========================================================
     ACCESS DENIED
  ========================================================== */

  if (
    !access?.permissions
      .manageStaff
  ) {
    return (
      <Card className="rounded-[24px]">
        <CardContent className="p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-4 font-semibold">
            Manager access required
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Cashier accounts cannot manage business staff.
          </p>
        </CardContent>
      </Card>
    );
  }


  /*
   * We only need active/pending invitation records in the
   * management UI.
   *
   * Accepted invitations are represented by Business Staff.
   * Revoked invitations are historical records.
   */

  const visibleInvitations =
    invitations.filter(
      (invitation) =>
        invitation.status ===
          "pending" ||
        invitation.status ===
          "expired",
    );


  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="space-y-5">
      {/* =====================================================
          INVITE STAFF
      ====================================================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>
            Invite Staff Member
          </CardTitle>

          <p className="text-sm leading-6 text-muted-foreground">
            Invite a cashier or manager by email.
            New staff will receive a secure NOVA account setup link.
          </p>
        </CardHeader>


        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_auto]">
            <Input
              type="email"
              value={
                email
              }
              onChange={(
                event,
              ) =>
                setEmail(
                  event
                    .target
                    .value,
                )
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  event.preventDefault();

                  void handleInvite();
                }
              }}
              placeholder="staff@example.com"
              className="h-11 rounded-[14px]"
            />


            <select
              value={
                role
              }
              onChange={(
                event,
              ) =>
                setRole(
                  event
                    .target
                    .value as StaffRole,
                )
              }
              className="h-11 rounded-[14px] border bg-background px-3 text-sm outline-none"
            >
              <option value="cashier">
                Cashier
              </option>

              {access.permissions
                .manageManagers && (
                <option value="manager">
                  Manager
                </option>
              )}
            </select>


            <Button
              type="button"
              className="h-11 rounded-[14px]"
              disabled={
                inviting
              }
              onClick={() =>
                void handleInvite()
              }
            >
              {inviting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MailPlus className="mr-2 h-4 w-4" />
              )}

              {inviting
                ? "Sending…"
                : "Send Invitation"}
            </Button>
          </div>


          <div className="mt-4 rounded-[16px] border bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
            {access.permissions
              .manageManagers
              ? (
                <>
                  As the business owner, you can invite both
                  <span className="font-semibold text-foreground">
                    {" "}Managers{" "}
                  </span>
                  and
                  <span className="font-semibold text-foreground">
                    {" "}Cashiers
                  </span>.
                </>
              )
              : (
                <>
                  Managers can invite and manage
                  <span className="font-semibold text-foreground">
                    {" "}Cashiers only
                  </span>.
                </>
              )}
          </div>
        </CardContent>
      </Card>


      {/* =====================================================
          STATUS
      ====================================================== */}

      {error && (
        <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            {error}
          </span>
        </div>
      )}


      {success && (
        <div className="flex items-start gap-2 rounded-[16px] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            {success}
          </span>
        </div>
      )}


      {/* =====================================================
          PENDING INVITATIONS
      ====================================================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>
                Pending Invitations
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Invitations waiting for the staff member to finish account setup.
              </p>
            </div>


            {visibleInvitations.length >
              0 && (
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                {visibleInvitations.length}
              </span>
            )}
          </div>
        </CardHeader>


        <CardContent>
          {loading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : visibleInvitations.length ===
            0 ? (
            <div className="rounded-[18px] border border-dashed p-7 text-center">
              <MailPlus className="mx-auto h-7 w-7 text-muted-foreground" />

              <p className="mt-3 text-sm font-semibold">
                No pending invitations
              </p>

              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                New invitations will appear here until they are accepted.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleInvitations.map(
                (
                  invitation,
                ) => {
                  const resendBusy =
                    busyId ===
                    `resend-${invitation.id}`;


                  const revokeBusy =
                    busyId ===
                    `revoke-${invitation.id}`;


                  const busy =
                    resendBusy ||
                    revokeBusy;


                  const expired =
                    invitation.status ===
                    "expired";


                  return (
                    <div
                      key={
                        invitation.id
                      }
                      className="flex flex-col gap-4 rounded-[18px] border bg-muted/15 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-muted">
                          <Clock3 className="h-5 w-5" />
                        </div>


                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {invitation.email}
                          </p>


                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>
                              {roleLabel(
                                invitation.role,
                              )}
                            </span>

                            <span>
                              ·
                            </span>

                            <span
                              className={
                                expired
                                  ? "font-medium text-destructive"
                                  : "font-medium text-amber-600 dark:text-amber-400"
                              }
                            >
                              {expired
                                ? "Expired"
                                : "Invitation pending"}
                            </span>
                          </div>


                          <p className="mt-2 text-xs text-muted-foreground">
                            {expired
                              ? "Expired "
                              : "Expires "}

                            {formatDateTime(
                              invitation.expiresAt,
                            )}
                          </p>
                        </div>
                      </div>


                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-[12px]"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void handleResend(
                              invitation,
                            )
                          }
                        >
                          {resendBusy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCw className="mr-2 h-4 w-4" />
                          )}

                          Resend
                        </Button>


                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-[12px] text-destructive hover:text-destructive"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void handleRevoke(
                              invitation,
                            )
                          }
                        >
                          {revokeBusy ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <X className="mr-2 h-4 w-4" />
                          )}

                          Revoke
                        </Button>
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          )}
        </CardContent>
      </Card>


      {/* =====================================================
          BUSINESS STAFF
      ====================================================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>
                Business Staff
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Control active NOVA access and staff roles.
              </p>
            </div>


            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[12px]"
              disabled={
                loading
              }
              onClick={() =>
                void loadStaff()
              }
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
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
          ) : staff.length ===
            0 ? (
            <div className="rounded-[18px] border border-dashed p-7 text-center">
              <UserRound className="mx-auto h-7 w-7 text-muted-foreground" />

              <p className="mt-3 text-sm font-semibold">
                No staff found
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map(
                (
                  member,
                ) => {
                  const busy =
                    busyId ===
                    member.staffId;


                  /*
                   * Owner:
                   *   can edit Manager + Cashier.
                   *
                   * Manager:
                   *   can edit Cashier only.
                   */
                  const canEdit =
                    !member.isOwner &&
                    (
                      access.permissions
                        .manageManagers ||
                      member.role ===
                        "cashier"
                    );


                  return (
                    <div
                      key={
                        member.isOwner
                          ? `owner-${member.userId}`
                          : member.staffId ??
                            `staff-${member.userId}`
                      }
                      className="flex flex-col gap-4 rounded-[18px] border bg-muted/15 p-4 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-muted">
                          {member.isOwner ? (
                            <Crown className="h-5 w-5" />
                          ) : member.role ===
                            "manager" ? (
                            <ShieldCheck className="h-5 w-5" />
                          ) : (
                            <UserRound className="h-5 w-5" />
                          )}
                        </div>


                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {member.email}
                          </p>


                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">
                              {member.role}
                            </span>

                            <span>
                              ·
                            </span>

                            <span
                              className={
                                member.status ===
                                "active"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-destructive"
                              }
                            >
                              {member.status ===
                              "active"
                                ? "Active"
                                : "Disabled"}
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
                          {access.permissions
                            .manageManagers && (
                            <select
                              value={
                                member.role ===
                                "manager"
                                  ? "manager"
                                  : "cashier"
                              }
                              disabled={
                                busy
                              }
                              onChange={(
                                event,
                              ) =>
                                void updateMember(
                                  member,
                                  {
                                    role:
                                      event
                                        .target
                                        .value as StaffRole,

                                    disabled:
                                      member.status ===
                                      "disabled",
                                  },
                                )
                              }
                              className="h-9 rounded-[12px] border bg-background px-3 text-xs outline-none"
                            >
                              <option value="cashier">
                                Cashier
                              </option>

                              <option value="manager">
                                Manager
                              </option>
                            </select>
                          )}


                          <Button
                            type="button"
                            size="sm"
                            variant={
                              member.status ===
                              "active"
                                ? "outline"
                                : "default"
                            }
                            className="rounded-[12px]"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void updateMember(
                                member,
                                {
                                  disabled:
                                    member.status ===
                                    "active",
                                },
                              )
                            }
                          >
                            {busy ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : member.status ===
                              "active" ? (
                              <UserRoundX className="mr-2 h-4 w-4" />
                            ) : (
                              <UserRoundCheck className="mr-2 h-4 w-4" />
                            )}

                            {member.status ===
                            "active"
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
                },
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}