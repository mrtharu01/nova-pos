"use client";

import * as React from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] =
    React.useState("");

  const [password, setPassword] =
    React.useState("");

  const [confirmPassword, setConfirmPassword] =
    React.useState("");

  const [showPassword, setShowPassword] =
    React.useState(false);

  const [loading, setLoading] =
    React.useState(false);

  const [error, setError] =
    React.useState<string | null>(
      null,
    );

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (loading) {
      return;
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError(
        "Enter your email address.",
      );

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

      const origin =
        window.location.origin;

      const {
        data,
        error: signupError,
      } =
        await supabase.auth.signUp({
          email:
            normalizedEmail,

          password,

          options: {
            emailRedirectTo:
              `${origin}/onboarding`,
          },
        });

      if (signupError) {
        throw new Error(
          signupError.message,
        );
      }

      /*
       * Email confirmation normally means
       * there is no authenticated session yet.
       */
      if (!data.session) {
        router.push(
          `/check-email?purpose=signup&email=${encodeURIComponent(
            normalizedEmail,
          )}`,
        );

        return;
      }

      /*
       * If confirmation happens to be disabled,
       * continue into business setup.
       */
      router.replace(
        "/onboarding",
      );

      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Account creation failed.",
      );
    } finally {
      setLoading(false);
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
              Secure account access
            </p>
          </div>
        </div>

        <div className="mt-9">
          <h1 className="text-2xl font-black">
            Create your account
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Create a NOVA account to
            set up and manage your
            business.
          </p>
        </div>

        <form
          onSubmit={
            handleSubmit
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
                value={email}
                onChange={(event) =>
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
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="new-password"
                required
                placeholder="At least 8 characters"
                className="h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] pl-11 pr-12 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) =>
                      !current,
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
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              autoComplete="new-password"
              required
              placeholder="Repeat password"
              className="mt-2 h-12 w-full rounded-[14px] border border-white/10 bg-[#0a1224] px-4 text-sm outline-none transition placeholder:text-slate-600 focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="rounded-[16px] border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-13 w-full items-center justify-center rounded-[15px] bg-indigo-500 px-5 font-bold transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create account
              </>
            )}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}