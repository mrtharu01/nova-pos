"use client";

import * as React from "react";

import {
  Loader2,
  LogOut,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  Sidebar,
} from "./Sidebar";

import {
  MobileNav,
} from "./MobileNav";

import {
  Topbar,
} from "./Topbar";

import {
  Button,
} from "@/components/ui/button";

import {
  useBusinessAccess,
} from "@/hooks/use-business-access";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  canAccessPath,
} from "@/lib/access/permissions";

import {
  cn,
} from "@/lib/utils";


interface AppLayoutProps {
  children: React.ReactNode;

  title: string;

  noPadding?: boolean;
}


export function AppLayout({
  children,
  title,
  noPadding = false,
}: AppLayoutProps) {
  const pathname =
    usePathname();


  const router =
    useRouter();


  const {
    business,
    demo,
  } =
    useCurrentBusiness();


  const {
    access,
    loading:
      accessLoading,
    error:
      accessError,
    refresh:
      refreshAccess,
  } =
    useBusinessAccess(
      demo
        ? undefined
        : business?.id,
    );


  /* ==========================================================
     SHOULD PERMISSIONS BE CHECKED?
  ========================================================== */

  const shouldCheckPermissions =
    !demo &&
    Boolean(
      business?.id,
    );


  /* ==========================================================
     CURRENT ROUTE ACCESS
  ========================================================== */

  const allowed =
    !shouldCheckPermissions ||
    !access
      ? true
      : canAccessPath(
          access,
          pathname,
        );


  /* ==========================================================
     REDIRECT UNAUTHORIZED ROUTES
  ========================================================== */

  React.useEffect(() => {
    if (
      !shouldCheckPermissions ||
      accessLoading ||
      !access
    ) {
      return;
    }


    if (
      !canAccessPath(
        access,
        pathname,
      )
    ) {
      router.replace(
        "/pos",
      );
    }
  }, [
    access,
    accessLoading,
    pathname,
    router,
    shouldCheckPermissions,
  ]);


  /* ==========================================================
     ACCESS ERROR
  ========================================================== */

  if (
    shouldCheckPermissions &&
    accessError
  ) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background p-6">

        <div className="w-full max-w-md rounded-[24px] border bg-card p-6 shadow-sm">

          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-destructive/10 text-destructive">

            <ShieldAlert className="h-6 w-6" />

          </div>


          <h1 className="mt-5 text-xl font-bold">
            Business access unavailable
          </h1>


          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            NOVA could not verify your access to this business.
            Your account may have been disabled, or the permission
            check may have failed.
          </p>


          <div className="mt-4 rounded-[14px] border bg-muted/30 p-3">

            <p className="break-words text-xs text-muted-foreground">
              {accessError}
            </p>

          </div>


          <div className="mt-5 grid gap-2 sm:grid-cols-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={
                refreshAccess
              }
            >

              <RefreshCw className="mr-2 h-4 w-4" />

              Try Again

            </Button>


            <form
              action="/auth/signout"
              method="post"
            >

              <Button
                type="submit"
                className="w-full rounded-[14px]"
              >

                <LogOut className="mr-2 h-4 w-4" />

                Sign Out

              </Button>

            </form>

          </div>

        </div>

      </div>
    );
  }


  /* ==========================================================
     INITIAL PERMISSION LOADING
  ========================================================== */

  if (
    shouldCheckPermissions &&
    accessLoading &&
    !access
  ) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background">

        <div className="text-center">

          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />


          <p className="mt-3 text-sm font-medium">
            Checking access…
          </p>


          <p className="mt-1 text-xs text-muted-foreground">
            Loading your NOVA permissions.
          </p>

        </div>

      </div>
    );
  }


  /* ==========================================================
     REDIRECT SCREEN
  ========================================================== */

  if (
    shouldCheckPermissions &&
    access &&
    !allowed
  ) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-background">

        <div className="text-center">

          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />


          <p className="mt-3 text-sm font-medium">
            Redirecting…
          </p>


          <p className="mt-1 text-xs text-muted-foreground">
            Your role does not have access to this page.
          </p>

        </div>

      </div>
    );
  }


  /* ==========================================================
     NORMAL APP
  ========================================================== */

  return (
    <div className="flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background">

      {/* ======================================================
          DESKTOP SIDEBAR
      ======================================================= */}

      <Sidebar
        access={
          access
        }
        accessLoading={
          shouldCheckPermissions &&
          accessLoading
        }
      />


      {/* ======================================================
          MAIN AREA
      ======================================================= */}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

        <Topbar
          title={
            title
          }
        />


        <main
          className={cn(
            `
              min-h-0
              flex-1
              overflow-y-auto
              overscroll-y-contain
              pb-[calc(6.5rem+env(safe-area-inset-bottom))]
              [-webkit-overflow-scrolling:touch]
              md:pb-0
            `,
            !noPadding &&
              "p-4 sm:p-6",
          )}
        >

          {children}

        </main>

      </div>


      {/* ======================================================
          MOBILE NAVIGATION
      ======================================================= */}

      <MobileNav
        access={
          access
        }
        accessLoading={
          shouldCheckPermissions &&
          accessLoading
        }
        demo={
          demo
        }
      />

    </div>
  );
}