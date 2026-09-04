"use client";

import * as React from "react";

import Link from "next/link";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";


function safeNextPath(
  value: string | null,
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }


  if (
    value.startsWith("/login") ||
    value.startsWith("/signup") ||
    value.startsWith("/check-email") ||
    value.startsWith("/auth/")
  ) {
    return "/";
  }


  return value;
}


export default function LoginPage() {
  const router =
    useRouter();


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
      false,
    );


  const [
    resetLoading,
    setResetLoading,
  ] =
    React.useState(
      false,
    );


  const [
    nextPath,
    setNextPath,
  ] =
    React.useState(
      "/",
    );


  const [
    message,
    setMessage,
  ] =
    React.useState<
      string | null
    >(
      null,
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
    const params =
      new URLSearchParams(
        window.location.search,
      );


    setNextPath(
      safeNextPath(
        params.get(
          "next",
        ),
      ),
    );


    if (
      params.get(
        "message",
      ) ===
      "password-reset"
    ) {
      setMessage(
        "Your password was updated successfully. Sign in with your new password.",
      );
    }
  }, []);


  async function handleSignIn(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();


    if (
      loading
    ) {
      return;
    }


    const normalizedEmail =
      email
        .trim()
        .toLowerCase();


    if (
      !normalizedEmail ||
      !password
    ) {
      setError(
        "Enter your email and password.",
      );

      return;
    }


    setLoading(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );


    try {
      const supabase =
        createClient();


      const {
        error:
          signInError,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              normalizedEmail,

            password,
          });


      if (
        signInError
      ) {
        throw new Error(
          signInError.message,
        );
      }


      /*
       * Never decide Owner / Manager / Cashier here.
       *
       * /auth/continue is the single source of truth.
       */

      const destination =
        nextPath === "/"
          ? "/auth/continue"
          : `/auth/continue?next=${encodeURIComponent(
              nextPath,
            )}`;


      router.replace(
        destination,
      );

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sign in failed.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  async function handleForgotPassword() {
    const normalizedEmail =
      email
        .trim()
        .toLowerCase();


    if (
      !normalizedEmail
    ) {
      setError(
        "Enter your email first, then choose Forgot password.",
      );

      return;
    }


    setResetLoading(
      true,
    );

    setError(
      null,
    );

    setMessage(
      null,
    );


    try {
      const supabase =
        createClient();


      const origin =
        window.location.origin;


      const {
        error:
          resetError,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            normalizedEmail,
            {
              redirectTo:
                `${origin}/auth/reset-password`,
            },
          );


      if (
        resetError
      ) {
        throw new Error(
          resetError.message,
        );
      }


      router.push(
        `/check-email?purpose=reset&email=${encodeURIComponent(
          normalizedEmail,
        )}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Password reset email could not be sent.",
      );
    } finally {
      setResetLoading(
        false,
      );
    }
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
              Secure business access
            </p>

          </div>

        </div>


        <div className="mt-9">

          <h1 className="text-2xl font-black">
            Welcome back
          </h1>


          <p className="mt-2 text-sm leading-6 text-slate-400">
            Owners, managers and cashiers all use the same secure NOVA sign-in.
          </p>

        </div>


        <form
          onSubmit={
            handleSignIn
          }
          className="mt-7 space-y-5"
        >

          <div>

            <label className="text-sm font-semibold">
              Email
            </label>


            <div className="relative mt-2">

              <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />


              <input
                type="email"
                value={
                  email
                }
                onChange={(
                  event,
                ) =>
                  setEmail(
                    event.target.value,
                  )
                }
                autoComplete="email"
                required
                placeholder="you@gmail.com"
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
              />

            </div>

          </div>


          <div>

            <div className="flex items-center justify-between gap-4">

              <label className="text-sm font-semibold">
                Password
              </label>


              <button
                type="button"
                disabled={
                  resetLoading
                }
                onClick={() =>
                  void handleForgotPassword()
                }
                className="text-xs font-semibold text-indigo-400 transition hover:text-indigo-300 disabled:opacity-50"
              >
                {resetLoading
                  ? "Sending…"
                  : "Forgot password?"}
              </button>

            </div>


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
                autoComplete="current-password"
                required
                placeholder="Your password"
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
              />


              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >

                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}

              </button>

            </div>

          </div>


          {message && (

            <div className="flex gap-3 rounded-[16px] border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">

              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

              <span>
                {message}
              </span>

            </div>

          )}


          {error && (

            <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>

          )}


          <button
            type="submit"
            disabled={
              loading
            }
            className="flex h-[52px] w-full items-center justify-center rounded-[15px] bg-indigo-500 px-5 font-bold transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >

            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Sign in
              </>
            )}

          </button>

        </form>


        <p className="mt-7 text-center text-sm text-slate-400">

          Setting up a new business?{" "}

          <Link
            href="/signup"
            className="font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Create account
          </Link>

        </p>

      </div>

    </main>
  );
}