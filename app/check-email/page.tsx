"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MailCheck,
} from "lucide-react";

export default function CheckEmailPage() {
  const [email, setEmail] =
    React.useState("");

  const [purpose, setPurpose] =
    React.useState<
      "signup" | "reset"
    >("signup");

  React.useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    setEmail(
      params.get("email") ??
        "",
    );

    setPurpose(
      params.get("purpose") ===
        "reset"
        ? "reset"
        : "signup",
    );
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#020817] px-5 py-10 text-white">
      <div className="w-full max-w-[500px] rounded-[32px] border border-white/10 bg-[#121a2e] p-8 text-center shadow-2xl sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-indigo-500/15 text-indigo-400">
          <MailCheck className="h-7 w-7" />
        </div>

        <h1 className="mt-7 text-2xl font-black">
          Check your email
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-400">
          {purpose === "signup"
            ? "NOVA sent a verification link to"
            : "NOVA sent a password reset link to"}
        </p>

        {email && (
          <p className="mt-2 break-all font-semibold text-white">
            {email}
          </p>
        )}

        <div className="mt-7 rounded-[18px] border border-white/10 bg-white/[0.03] p-5 text-left text-xs leading-6 text-slate-400">
          {purpose === "signup" ? (
            <>
              Open the verification email
              from Supabase/NOVA and
              confirm your address. You
              will then continue to NOVA
              business setup.
            </>
          ) : (
            <>
              Open the reset email and
              follow the secure link to
              choose a new password.
            </>
          )}
        </div>

        <Link
          href="/login"
          className="mt-7 inline-flex items-center text-sm font-semibold text-indigo-400 transition hover:text-indigo-300"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to sign in
        </Link>
      </div>
    </main>
  );
}