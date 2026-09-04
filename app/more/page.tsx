"use client";

import * as React from "react";

import Link from "next/link";

import {
  Archive,
  BarChart3,
  CreditCard,
  LogOut,
  Package,
  QrCode,
  Settings,
  Users,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ThemeToggle,
} from "@/components/ui/theme-toggle";

import {
  useBusinessAccess,
} from "@/hooks/use-business-access";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  hasAccessRequirement,
  type AccessRequirement,
} from "@/lib/access/permissions";


type MoreItem = {
  href: string;

  label: string;

  icon: React.ComponentType<{
    className?: string;
  }>;

  requirement?: AccessRequirement;
};


const ITEMS:
  MoreItem[] = [
    {
      href: "/products",
      label: "Products",
      icon: Package,
      requirement: "manageCatalog",
    },

    {
      href: "/inventory",
      label: "Inventory",
      icon: Archive,
      requirement: "manageInventory",
    },

    {
      href: "/customers",
      label: "Customers",
      icon: Users,
    },

    {
      href: "/qr",
      label: "QR Codes",
      icon: QrCode,
      requirement: "manager",
    },

    {
      href: "/reports",
      label: "Reports",
      icon: BarChart3,
      requirement: "viewReports",
    },

    {
      href: "/expenses",
      label: "Expenses",
      icon: CreditCard,
      requirement: "manager",
    },

    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      requirement: "manageSettings",
    },
  ];


export default function MorePage() {
  const {
    email,
    business,
    demo,
  } =
    useCurrentBusiness();


  const {
    access,
    loading:
      accessLoading,
  } =
    useBusinessAccess(
      demo
        ? undefined
        : business?.id,
    );


  const visibleItems =
    React.useMemo(
      () => {
        if (demo) {
          return ITEMS;
        }


        if (access) {
          return ITEMS.filter(
            (item) =>
              hasAccessRequirement(
                access,
                item.requirement,
              ),
          );
        }


        return ITEMS.filter(
          (item) =>
            !item.requirement,
        );
      },
      [
        access,
        demo,
      ],
    );


  return (
    <AppLayout title="More">

      <div className="mx-auto max-w-xl space-y-6">

        <div className="grid grid-cols-2 gap-3">

          {visibleItems.map(
            (item) => (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className="group rounded-[20px] border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
              >

                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>


                <p className="font-semibold">
                  {item.label}
                </p>


                <p className="mt-1 text-xs text-muted-foreground">
                  Open {item.label.toLowerCase()}
                </p>

              </Link>
            ),
          )}

        </div>


        {accessLoading &&
          !demo && (

          <p className="text-center text-xs text-muted-foreground">
            Checking available tools…
          </p>

        )}


        <section className="rounded-[24px] border bg-card p-4">

          <h2 className="mb-3 font-semibold">
            Appearance
          </h2>


          <ThemeToggle />

        </section>


        <section className="rounded-[24px] border bg-card p-4">

          <p className="font-semibold">
            {business?.name ??
              "NOVA Account"}
          </p>


          <p className="mt-1 text-xs text-muted-foreground">
            {demo
              ? "Demo mode"
              : email}
          </p>


          {!demo ? (

            <form
              action="/auth/signout"
              method="post"
              className="mt-4"
            >

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-[14px] border px-4 py-3 text-sm font-bold transition-colors hover:bg-muted"
              >

                <LogOut className="h-4 w-4" />

                Sign out

              </button>

            </form>

          ) : null}

        </section>

      </div>

    </AppLayout>
  );
}