"use client";

import * as React from "react";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  TriangleAlert,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


export default function StaffSetupPasswordPage() {
  const router =
    useRouter();


  const [
    invitationId,
    setInvitationId,
  ] =
    React.useState("");


  const [
    email,
    setEmail,
  ] =
    React.useState("");


  const [
    password,
    setPassword,
  ] =
    React.useState("");


  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    React.useState("");


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
    >(null);


  React.useEffect(() => {
    async function initialize() {
      const params =
        new URLSearchParams(
          window.location.search,
        );


      const invitation =
        params.get(
          "invitation",
        ) ??
        "";


      setInvitationId(
        invitation,
      );


      if (!invitation) {
        setError(
          "Invitation information is missing.",
        );

        setLoading(
          false,
        );

        return;
      }


      const supabase =
        createClient();


      const {
        data: {
          user,
        },
      } =
        await supabase.auth
          .getUser();


      if (!user) {
        setError(
          "Your invitation session is not active. Open the invitation link from your email again.",
        );

        setLoading(
          false,
        );

        return;
      }


      setEmail(
        user.email ??
          "",
      );


      setLoading(
        false,
      );
    }


    void initialize();
  }, []);


  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();


    if (saving) {
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


    if (!invitationId) {
      setError(
        "Invitation information is missing.",
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


      const {
        error:
          acceptanceError,
      } =
        await supabase.rpc(
          "accept_staff_invitation",
          {
            p_invitation_id:
              invitationId,
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
        "/",
      );


      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof
        Error
          ? cause.message
          : "Account setup failed.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  if (loading) {
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


        {error &&
        !email ? (

          <div className="mt-8 rounded-[18px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

            <div className="flex gap-3">

              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />


              <span>
                {
                  error
                }
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
                Your email invitation has been verified. Set a password to finish joining NOVA.
              </p>

            </div>


            <div className="mt-6 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">

              <p className="text-xs text-slate-500">
                Account
              </p>


              <p className="mt-1 font-semibold">
                {
                  email
                }
              </p>

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
                    placeholder="At least 8 characters"
                    className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] pl-11 pr-12 text-sm outline-none transition focus:border-indigo-500"
                  />


                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (value) =>
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
                  placeholder="Repeat password"
                  className="mt-2 h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] px-4 text-sm outline-none transition focus:border-indigo-500"
                />

              </div>


              {error && (

                <div className="flex gap-3 rounded-[16px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">

                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />


                  {
                    error
                  }

                </div>

              )}


              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex h-13 w-full items-center justify-center rounded-[15px] bg-indigo-500 px-5 font-bold transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
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