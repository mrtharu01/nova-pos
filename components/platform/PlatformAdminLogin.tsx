"use client";

import * as React from "react";

import {
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  createPlatformClient,
} from "@/lib/supabase/platform-client";

import type {
  PlatformAdminAccess,
} from "@/lib/domain/platform-admin";


export function PlatformAdminLogin({
  basePath,
}: {
  basePath:
    string;
}) {
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
    error,
    setError,
  ] =
    React.useState(
      "",
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      false,
    );


  const submittingRef =
    React.useRef(
      false,
    );


  function stopSubmitting() {
    submittingRef.current =
      false;

    setLoading(
      false,
    );
  }


  async function handleSubmit(
    event:
      React.FormEvent,
  ) {
    event.preventDefault();


    if (
      submittingRef.current
    ) {
      return;
    }


    submittingRef.current =
      true;

    setLoading(
      true,
    );

    setError(
      "",
    );


    const supabase =
      createPlatformClient();


    try {
      const {
        data,
        error:
          loginError,
      } =
        await supabase.auth
          .signInWithPassword({
            email:
              email.trim(),

            password,
          });


      if (
        loginError ||
        !data.user
      ) {
        setError(
          "Invalid email or password.",
        );

        stopSubmitting();

        return;
      }


      const {
        data:
          accessData,
        error:
          accessError,
      } =
        await supabase.rpc(
          "get_my_platform_admin_access",
        );


      const access =
        accessData as
          | PlatformAdminAccess
          | null;


      if (
        accessError ||
        !access?.isPlatformAdmin ||
        !access.role
      ) {
        await supabase.auth
          .signOut();


        setError(
          "Invalid email or password.",
        );

        stopSubmitting();

        return;
      }


      router.replace(
        `${basePath}/dashboard`,
      );

      router.refresh();
    } catch {
      setError(
        "Unable to sign in. Please try again.",
      );

      stopSubmitting();
    }
  }


  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">

      <div className="w-full max-w-md">

        <div className="mb-10 text-center">

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] border bg-card shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>


          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            ARC Internal
          </h1>


          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Platform Control System
          </p>

        </div>


        <form
          onSubmit={
            handleSubmit
          }
          aria-busy={
            loading
          }
          className="rounded-[24px] border bg-card p-6 shadow-sm sm:p-8"
        >

          <div className="space-y-5">

            <div>

              <label
                htmlFor="platform-email"
                className="text-xs font-semibold text-muted-foreground"
              >
                Email address
              </label>


              <input
                id="platform-email"
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
                autoComplete="email"
                required
                disabled={
                  loading
                }
                className="mt-2 h-11 w-full rounded-[12px] border bg-background px-3 text-sm outline-none transition-colors focus:border-foreground/50 disabled:opacity-50"
              />

            </div>


            <div>

              <label
                htmlFor="platform-password"
                className="text-xs font-semibold text-muted-foreground"
              >
                Password
              </label>


              <input
                id="platform-password"
                type="password"
                value={
                  password
                }
                onChange={
                  (
                    event,
                  ) =>
                    setPassword(
                      event.target.value,
                    )
                }
                autoComplete="current-password"
                required
                disabled={
                  loading
                }
                className="mt-2 h-11 w-full rounded-[12px] border bg-background px-3 text-sm outline-none transition-colors focus:border-foreground/50 disabled:opacity-50"
              />

            </div>


            {error ? (

              <div
                role="alert"
                className="rounded-[12px] border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
              >
                {error}
              </div>

            ) : null}


            <button
              type="submit"
              disabled={
                loading
              }
              className="inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-primary px-4 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
            >

              {loading ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}

              {loading
                ? "Signing In..."
                : "Sign In"}

            </button>

          </div>

        </form>


        <p className="mt-6 text-center text-[11px] font-medium text-muted-foreground">
          Authorized ARC platform personnel only.
        </p>

      </div>

    </div>
  );
}
