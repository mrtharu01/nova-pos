"use client";

import * as React from "react";

import {
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
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
  Dialog,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Select,
} from "@/components/ui/select";

import {
  addPlatformAdmin,
  fetchPlatformAdmins,
  removePlatformAdmin,
  setPlatformAdminRole,
} from "@/lib/data/platform-admin";

import type {
  PlatformAdminMember,
  PlatformAdminRole,
} from "@/lib/domain/platform-admin";


const ROLES: {
  value:
    PlatformAdminRole;

  label:
    string;
}[] = [
  {
    value:
      "owner",

    label:
      "Owner",
  },
  {
    value:
      "admin",

    label:
      "Admin",
  },
  {
    value:
      "support",

    label:
      "Support",
  },
];


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


export function PlatformAdminsClient({
  currentUserId,
  currentRole,
}: {
  currentUserId:
    string;

  currentRole:
    PlatformAdminRole;
}) {
  const [
    admins,
    setAdmins,
  ] =
    React.useState<
      PlatformAdminMember[]
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
    addOpen,
    setAddOpen,
  ] =
    React.useState(
      false,
    );


  const [
    removeTarget,
    setRemoveTarget,
  ] =
    React.useState<
      PlatformAdminMember |
      null
    >(
      null,
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
      PlatformAdminRole
    >(
      "admin",
    );


  const [
    submitting,
    setSubmitting,
  ] =
    React.useState(
      false,
    );


  const [
    busyUserId,
    setBusyUserId,
  ] =
    React.useState<
      string |
      null
    >(
      null,
    );


  const canManage =
    currentRole ===
      "owner";


  const load =
    React.useCallback(
      async () => {
        setError(
          null,
        );


        try {
          setAdmins(
            await fetchPlatformAdmins(),
          );
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Platform administrators could not be loaded.",
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


  async function addAdmin(
    event:
      React.FormEvent,
  ) {
    event.preventDefault();


    if (
      submitting ||
      !canManage
    ) {
      return;
    }


    setSubmitting(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );


    try {
      await addPlatformAdmin(
        email,
        role,
      );


      setEmail(
        "",
      );

      setRole(
        "admin",
      );

      setAddOpen(
        false,
      );

      setNotice(
        "Platform administrator added.",
      );


      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Platform administrator could not be added.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  async function changeRole(
    member:
      PlatformAdminMember,

    nextRole:
      PlatformAdminRole,
  ) {
    if (
      !canManage ||
      nextRole ===
        member.role
    ) {
      return;
    }


    setBusyUserId(
      member.userId,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );


    try {
      await setPlatformAdminRole(
        member.userId,
        nextRole,
      );


      setNotice(
        `${member.email} is now ${nextRole}.`,
      );


      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Platform administrator role could not be changed.",
      );
    } finally {
      setBusyUserId(
        null,
      );
    }
  }


  async function confirmRemove() {
    if (
      !removeTarget ||
      !canManage ||
      submitting
    ) {
      return;
    }


    setSubmitting(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );


    try {
      await removePlatformAdmin(
        removeTarget.userId,
      );


      setNotice(
        `${removeTarget.email} was removed from ARC Control.`,
      );

      setRemoveTarget(
        null,
      );


      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Platform administrator could not be removed.",
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

        <div>

          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Security
          </p>


          <h1 className="mt-1 text-2xl font-bold">
            Platform Admins
          </h1>


          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Accounts allowed into the hidden ARC Control system. Only Platform Owners can change this list.
          </p>

        </div>


        <div className="flex gap-2">

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


          {canManage ? (

            <Button
              type="button"
              onClick={() =>
                setAddOpen(
                  true,
                )
              }
            >
              <Plus className="mr-2 h-4 w-4" />

              Add Admin
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


      {!canManage ? (

        <div className="rounded-[18px] border bg-muted/20 p-4 text-sm text-muted-foreground">
          Your role can view platform administrators, but only a Platform Owner can add, remove or change administrator roles.
        </div>

      ) : null}


      <Card>

        <CardHeader>

          <CardTitle>
            Authorized accounts
          </CardTitle>

        </CardHeader>


        <CardContent>

          {loading ? (

            <div className="rounded-[18px] border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Loading platform administrators…
            </div>

          ) : admins.length ===
            0 ? (

            <div className="rounded-[18px] border border-dashed p-8 text-center text-sm text-muted-foreground">
              No platform administrators found.
            </div>

          ) : (

            <div className="space-y-3">

              {admins.map(
                (
                  member,
                ) => {
                  const isCurrent =
                    member.userId ===
                      currentUserId;


                  const busy =
                    busyUserId ===
                      member.userId;


                  return (
                    <div
                      key={
                        member.userId
                      }
                      className="grid gap-4 rounded-[18px] border bg-muted/10 p-4 lg:grid-cols-[minmax(0,1.5fr)_0.8fr_0.8fr_auto]"
                    >

                      <div className="min-w-0">

                        <div className="flex items-center gap-2">

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border bg-background">
                            {member.role ===
                            "owner" ? (
                              <ShieldCheck className="h-4 w-4" />
                            ) : (
                              <UserRoundCog className="h-4 w-4" />
                            )}
                          </div>


                          <div className="min-w-0">

                            <p className="truncate font-semibold">
                              {member.email}
                            </p>


                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                              {isCurrent
                                ? "Current account"
                                : member.userId}
                            </p>

                          </div>

                        </div>

                      </div>


                      <div>

                        <p className="text-xs font-medium text-muted-foreground">
                          Role
                        </p>


                        {canManage ? (

                          <Select
                            value={
                              member.role
                            }
                            disabled={
                              busy
                            }
                            onChange={
                              (
                                event,
                              ) =>
                                void changeRole(
                                  member,
                                  event.target.value as PlatformAdminRole,
                                )
                            }
                            className="mt-1"
                          >

                            {ROLES.map(
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

                        ) : (

                          <p className="mt-1 text-sm font-semibold capitalize">
                            {member.role}
                          </p>

                        )}

                      </div>


                      <div>

                        <p className="text-xs font-medium text-muted-foreground">
                          Added
                        </p>


                        <p className="mt-2 text-sm font-medium">
                          {formatDate(
                            member.createdAt,
                          )}
                        </p>

                      </div>


                      <div className="flex items-end justify-end">

                        {canManage ? (

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label={
                              `Remove ${member.email}`
                            }
                            disabled={
                              busy
                            }
                            onClick={() =>
                              setRemoveTarget(
                                member,
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

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


      <Dialog
        isOpen={
          addOpen
        }
        onClose={() => {
          if (
            !submitting
          ) {
            setAddOpen(
              false,
            );
          }
        }}
        title="Add Platform Admin"
        description="The account must already exist and be confirmed in Supabase Authentication."
      >

        <form
          onSubmit={
            addAdmin
          }
          className="space-y-5"
        >

          <div>

            <label
              htmlFor="platform-admin-email"
              className="text-xs font-semibold text-muted-foreground"
            >
              Account email
            </label>


            <Input
              id="platform-admin-email"
              type="email"
              value={
                email
              }
              onChange={
                (
                  event,
                ) =>
                  setEmail(
                    event.target.value,
                  )
              }
              required
              disabled={
                submitting
              }
              className="mt-2"
            />

          </div>


          <div>

            <label
              htmlFor="platform-admin-role"
              className="text-xs font-semibold text-muted-foreground"
            >
              Role
            </label>


            <Select
              id="platform-admin-role"
              value={
                role
              }
              onChange={
                (
                  event,
                ) =>
                  setRole(
                    event.target.value as PlatformAdminRole,
                  )
              }
              disabled={
                submitting
              }
              className="mt-2"
            >

              {ROLES.map(
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


          <div className="flex justify-end gap-2">

            <Button
              type="button"
              variant="outline"
              disabled={
                submitting
              }
              onClick={() =>
                setAddOpen(
                  false,
                )
              }
            >
              Cancel
            </Button>


            <Button
              type="submit"
              disabled={
                submitting
              }
            >
              {submitting
                ? "Adding..."
                : "Add Admin"}
            </Button>

          </div>

        </form>

      </Dialog>


      <Dialog
        isOpen={
          Boolean(
            removeTarget,
          )
        }
        onClose={() => {
          if (
            !submitting
          ) {
            setRemoveTarget(
              null,
            );
          }
        }}
        title="Remove Platform Admin"
        description="This immediately removes access to ARC Control."
      >

        <p className="text-sm leading-6 text-muted-foreground">
          Remove <span className="font-semibold text-foreground">{removeTarget?.email}</span> from the platform administrator list?
        </p>


        <div className="mt-6 flex justify-end gap-2">

          <Button
            type="button"
            variant="outline"
            disabled={
              submitting
            }
            onClick={() =>
              setRemoveTarget(
                null,
              )
            }
          >
            Cancel
          </Button>


          <Button
            type="button"
            variant="destructive"
            disabled={
              submitting
            }
            onClick={() =>
              void confirmRemove()
            }
          >
            {submitting
              ? "Removing..."
              : "Remove"}
          </Button>

        </div>

      </Dialog>

    </div>
  );
}
