"use client";

import * as React from "react";

import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


type PendingInvitation = {
  id: string;

  business_id: string;

  business_name: string;

  email: string;

  role:
    | "manager"
    | "cashier";

  expires_at: string;
};


function roleLabel(
  role:
    | "manager"
    | "cashier",
) {
  return role ===
    "manager"
    ? "Manager"
    : "Cashier";
}


export default function StaffSetupPasswordPage() {
  const router =
    useRouter();


  const [
    invitation,
    setInvitation,
  ] =
    React.useState<
      PendingInvitation | null
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
    password,
    setPassword,
  ] =
    React.useState(
      "",
    );


  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    React.useState(
      "",
    );


  const [
    showPassword,
    setShowPassword,
  ] =
    React.useState(
      false,
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );


  const [
    saving,
    setSaving,
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


  React.useEffect(() => {
    async function initialize() {
      try {
        const params =
          new URLSearchParams(
            window.location.search,
          );


        const invitationId =
          params.get(
            "invitation",
          ) ??
          "";


        if (
          !invitationId
        ) {
          setError(
            "Invitation information is missing.",
          );

          return;
        }


        const supabase =
          createClient();


        const {
          data: {
            user,
          },

          error:
            userError,
        } =
          await supabase.auth
            .getUser();


        if (
          userError ||
          !user
        ) {
          setError(
            "Your invitation session is not active. Open the secure invitation link from your email again.",
          );

          return;
        }


        setEmail(
          user.email ??
            "",
        );


        const {
          data:
            pendingRows,

          error:
            pendingError,
        } =
          await supabase.rpc(
            "get_my_pending_staff_invitations",
          );


        if (
          pendingError
        ) {
          throw new Error(
            pendingError.message,
          );
        }


        const invitations =
          (
            pendingRows ??
            []
          ) as PendingInvitation[];


        const matchingInvitation =
          invitations.find(
            (
              item,
            ) =>
              item.id ===
              invitationId,
          );


        if (
          !matchingInvitation
        ) {
          /*
           * If access already exists, the invitation may have
           * already been accepted.
           */

          const {
            data:
              businessRows,
          } =
            await supabase
              .from(
                "businesses",
              )
              .select(
                "id",
              )
              .limit(
                1,
              );


          if (
            businessRows &&
            businessRows.length >
              0
          ) {
            router.replace(
              "/",
            );

            router.refresh();

            return;
          }


          setError(
            "This invitation is expired, revoked, already used, or does not belong to this account.",
          );

          return;
        }


        setInvitation(
          matchingInvitation,
        );
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "NOVA could not prepare this staff invitation.",
        );
      } finally {
        setLoading(
          false,
        );
      }
    }


    void initialize();
  }, [
    router,
  ]);


  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();


    if (
      saving ||
      !invitation
    ) {
      return;
    }


    if (
      password.length <
      8
    ) {
      setError(
        "Password must contain at least 8 characters.",
      );

      return;
    }


    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Passwords do not match.",
      );

      return;
    }


    setSaving(
      true,
    );

    setError(
      null,
    );


    try {
      const supabase =
        createClient();


      /*
       * First create the staff member's permanent NOVA
       * password.
       */

      const {
        error:
          passwordError,
      } =
        await supabase.auth
          .updateUser({
            password,
          });


      if (
        passwordError
      ) {
        throw new Error(
          passwordError.message,
        );
      }


      /*
       * Then activate business access.
       *
       * If this fails, the invitation remains pending and the
       * page can be retried without accidentally creating an
       * Owner workspace.
       */

      const {
        error:
          acceptanceError,
      } =
        await supabase.rpc(
          "accept_staff_invitation",
          {
            p_invitation_id:
              invitation.id,
          },
        );


      if (
        acceptanceError
      ) {
        throw new Error(
          acceptanceError.message,
        );
      }


      router.replace(
        "/auth/continue",
      );

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Account setup failed.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  if (
    loading
  ) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#020817] px-5 text-white">

        <div className="text-center">

          <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-400" />


          <p className="mt-4 text-sm text-slate-400">
            Preparing your NOVA account…
          </p>

        </div>

      </main>
    );
  }


  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#020817] px-5 py-10 text-white">

      <div className="w-full max-w-[500px] rounded-[32px] border border-white/10 bg-[#121a2e] p-8 shadow-2xl sm:p-10">

        <div className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-indigo-500 text-xl font-black shadow-lg shadow-indigo-500/20">
            N
          </div>


          <div>

            <p className="text-xl font-black">
              NOVA POS
            </p>


            <p className="text-sm text-slate-400">
              Staff account setup
            </p>

          </div>

        </div>


        {!invitation ? (

          <div className="mt-8 rounded-[18px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

            <div className="flex gap-3">

              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />


              <span>
                {error ??
                  "This invitation is not available."}
              </span>

            </div>

          </div>

        ) : (

          <>

            <div className="mt-9">

              <h1 className="text-2xl font-black">
                Create your password
              </h1>


              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your invitation has been verified. Create your password to finish joining this NOVA workspace.
              </p>

            </div>


            <div className="mt-6 space-y-2">

              <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">

                <p className="text-xs text-slate-500">
                  Account
                </p>


                <p className="mt-1 font-semibold">
                  {email}
                </p>

              </div>


              <div className="grid gap-2 sm:grid-cols-2">

                <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">

                  <div className="flex items-center gap-2 text-xs text-slate-500">

                    <Building2 className="h-3.5 w-3.5" />

                    Business

                  </div>


                  <p className="mt-1 font-semibold">
                    {invitation.business_name}
                  </p>

                </div>


                <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">

                  <div className="flex items-center gap-2 text-xs text-slate-500">

                    <ShieldCheck className="h-3.5 w-3.5" />

                    Access role

                  </div>


                  <p className="mt-1 font-semibold">
                    {roleLabel(
                      invitation.role,
                    )}
                  </p>

                </div>

              </div>

            </div>


            <form
              onSubmit={
                handleSubmit
              }
              className="mt-6 space-y-5"
            >

              <div>

                <label className="text-sm font-semibold">
                  Password
                </label>


                <div className="relative mt-2">

                  <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />


                  <input
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={
                      password
                    }
                    onChange={(
                      event,
                    ) =>
                      setPassword(
                        event.target.value,
                      )
                    }
                    autoComplete="new-password"
                    required
                    placeholder="At least 8 characters"
                    className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] pl-11 pr-12 text-sm outline-none transition focus:border-indigo-500"
                  />


                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (
                          value,
                        ) =>
                          !value,
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
                  >

                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}

                  </button>

                </div>

              </div>


              <div>

                <label className="text-sm font-semibold">
                  Confirm password
                </label>


                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={
                    confirmPassword
                  }
                  onChange={(
                    event,
                  ) =>
                    setConfirmPassword(
                      event.target.value,
                    )
                  }
                  autoComplete="new-password"
                  required
                  placeholder="Repeat password"
                  className="mt-2 h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] px-4 text-sm outline-none transition focus:border-indigo-500"
                />

              </div>


              {error && (

                <div className="flex gap-3 rounded-[16px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

                  <span>
                    {error}
                  </span>

                </div>

              )}


              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex h-[52px] w-full items-center justify-center rounded-[15px] bg-indigo-500 px-5 font-bold transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finishing setup…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Complete account setup
                  </>
                )}

              </button>

            </form>

          </>

        )}

      </div>

    </main>
  );
}