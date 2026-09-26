"use client";

import * as React from "react";

import Link from "next/link";

import {
  Activity,
  ArchiveRestore,
  Building2,
  CreditCard,
  Gauge,
  Layers3,
  LogOut,
  Settings,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  createPlatformClient,
} from "@/lib/supabase/platform-client";

import type {
  PlatformAdminAccess,
} from "@/lib/domain/platform-admin";


type PlatformAdminLayoutProps = {
  children:
    React.ReactNode;

  basePath:
    string;

  email:
    string;

  access:
    PlatformAdminAccess;
};


function roleLabel(
  role:
    PlatformAdminAccess["role"],
) {
  if (
    role ===
    "owner"
  ) {
    return "Platform Owner";
  }


  if (
    role ===
    "admin"
  ) {
    return "Platform Admin";
  }


  return "Support";
}


export function PlatformAdminLayout({
  children,
  basePath,
  email,
  access,
}: PlatformAdminLayoutProps) {
  const pathname =
    usePathname();


  const router =
    useRouter();


  const [
    loggingOut,
    setLoggingOut,
  ] =
    React.useState(
      false,
    );


  const navItems = [
    {
      name:
        "Dashboard",

      path:
        `${basePath}/dashboard`,

      icon:
        Gauge,
    },
    {
      name:
        "Businesses",

      path:
        `${basePath}/businesses`,

      icon:
        Building2,
    },
    {
      name:
        "Plans",

      path:
        `${basePath}/plans`,

      icon:
        Layers3,
    },
    {
      name:
        "Subscriptions",

      path:
        `${basePath}/subscriptions`,

      icon:
        CreditCard,
    },
    {
      name:
        "Platform Admins",

      path:
        `${basePath}/admins`,

      icon:
        UserRoundCog,
    },
    {
      name:
        "Audit Log",

      path:
        `${basePath}/audit`,

      icon:
        Activity,
    },
    {
      name:
        "Backups",

      path:
        `${basePath}/backups`,

      icon:
        ArchiveRestore,
    },
    {
      name:
        "Settings",

      path:
        `${basePath}/settings`,

      icon:
        Settings,
    },
  ] as const;


  async function signOut() {
    if (
      loggingOut
    ) {
      return;
    }


    setLoggingOut(
      true,
    );


    try {
      const supabase =
        createPlatformClient();


      await supabase.auth
        .signOut();


      router.replace(
        `${basePath}/login`,
      );

      router.refresh();
    } finally {
      setLoggingOut(
        false,
      );
    }
  }


  return (
    <div className="flex min-h-[100dvh] flex-col bg-background md:h-[100dvh] md:min-h-0 md:flex-row md:overflow-hidden">

      <aside className="shrink-0 border-b bg-card md:h-[100dvh] md:w-72 md:border-b-0 md:border-r">

        <div className="border-b p-5 md:p-6">

          <div className="flex items-center gap-2">

            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-[12px] border bg-background">
              <img
                src="/arc-icon.svg"
                alt="ARC Control"
                className="h-full w-full object-cover"
              />
            </div>


            <div>

              <p className="text-sm font-bold">
                ARC CONTROL
              </p>


              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Platform Administration
              </p>

            </div>

          </div>


          <div className="mt-5 rounded-[16px] border bg-muted/20 p-3">

            <p className="truncate text-xs font-semibold">
              {email}
            </p>


            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {roleLabel(
                access.role,
              )}
            </p>

          </div>

        </div>


        <nav className="flex gap-1 overflow-x-auto p-3 md:block md:h-[calc(100dvh-238px)] md:space-y-1 md:overflow-y-auto md:p-4">

          {navItems.map(
            (
              item,
            ) => {
              const Icon =
                item.icon;


              const active =
                pathname ===
                  item.path ||
                pathname.startsWith(
                  `${item.path}/`,
                );


              return (
                <Link
                  key={
                    item.name
                  }
                  href={
                    item.path
                  }
                  prefetch={
                    false
                  }
                  className={
                    active
                      ? "flex shrink-0 items-center gap-3 rounded-[12px] bg-primary px-4 py-3 text-xs font-bold text-primary-foreground md:w-full"
                      : "flex shrink-0 items-center gap-3 rounded-[12px] px-4 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:w-full"
                  }
                >
                  <Icon className="h-4 w-4" />

                  {item.name}
                </Link>
              );
            },
          )}

        </nav>


        <div className="border-t p-3 md:p-4">

          <button
            type="button"
            onClick={() =>
              void signOut()
            }
            disabled={
              loggingOut
            }
            className="flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-wait disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />

            {loggingOut
              ? "Signing Out..."
              : "Sign Out"}
          </button>

        </div>

      </aside>


      <main className="min-h-0 flex-1 overflow-y-auto">

        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          {children}
        </div>

      </main>

    </div>
  );
}
