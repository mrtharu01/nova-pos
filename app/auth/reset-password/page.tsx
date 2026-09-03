"use client";

import * as React from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router =
    useRouter();

  const [password, setPassword] =
    React.useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = React.useState("");

  const [
    showPassword,
    setShowPassword,
  ] = React.useState(false);

  const [loading, setLoading] =
    React.useState(false);

  const [checking, setChecking] =
    React.useState(true);

  const [error, setError] =
    React.useState<string | null>(
      null,
    );

  React.useEffect(() => {
    async function checkSession() {
      const supabase =
        createClient();

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setError(
          "Your reset session is missing or expired. Request a new password reset email.",
        );
      }

      setChecking(false);
    }

    void checkSession();
  }, []);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (password.length < 8) {
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

    setLoading(true);
    setError(null);

    try {
      const supabase =
        createClient();

      const {
        error: updateError,
      } =
        await supabase.auth
          .updateUser({
            password,
          });

      if (updateError) {
        throw new Error(
          updateError.message,
        );
      }

      router.replace(
        "/login",
      );

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Password could not be changed.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#020817] text-white">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#020817] px-5 py-10 text-white">
      <div className="w-full max-w-[500px] rounded-[32px] border border-white/10 bg-[#121a2e] p-8 shadow-2xl sm:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-indigo-500 text-xl font-black">
          N
        </div>

        <h1 className="mt-8 text-2xl font-black">
          Choose a new password
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Create a secure password for
          your NOVA account.
        </p>

        <form
          onSubmit={
            handleSubmit
          }
          className="mt-7 space-y-5"
        >
          <div>
            <label className="text-sm font-semibold">
              New password
            </label>

            <div className="relative mt-2">
              <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

              <input
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="new-password"
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] pl-11 pr-12 text-sm outline-none focus:border-indigo-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) =>
                      !value,
                  )
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
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
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              className="mt-2 h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] px-4 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={
              loading ||
              Boolean(
                error &&
                  !password,
              )
            }
            className="flex h-13 w-full items-center justify-center rounded-[15px] bg-indigo-500 font-bold transition hover:bg-indigo-400 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}

            {loading
              ? "Updating…"
              : "Update password"}
          </button>
        </form>
      </div>
    </main>
  );
}