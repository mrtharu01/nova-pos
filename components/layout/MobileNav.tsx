"use client";

import * as React from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  LayoutDashboard,
  Menu,
  ReceiptText,
  Scan,
  ShoppingCart,
} from "lucide-react";

import {
  hasAccessRequirement,
  type AccessRequirement,
} from "@/lib/access/permissions";

import type {
  BusinessAccess,
} from "@/lib/domain/access";

import {
  cn,
} from "@/lib/utils";


type MobileNavProps = {
  access: BusinessAccess | null;

  accessLoading?: boolean;

  demo?: boolean;
};


type MobileNavItem = {
  href: string;

  label: string;

  icon: React.ComponentType<{
    className?: string;
  }>;

  primary?: boolean;

  requirement?: AccessRequirement;
};


const MOBILE_NAV_ITEMS:
  MobileNavItem[] = [
    {
      href: "/",
      label: "Home",
      icon: LayoutDashboard,
    },

    {
      href: "/pos",
      label: "POS",
      icon: ShoppingCart,
    },

    {
      href: "/scan",
      label: "Scan",
      icon: Scan,
      primary: true,
    },

    {
      href: "/sales",
      label: "Sales",
      icon: ReceiptText,
    },

    {
      href: "/more",
      label: "More",
      icon: Menu,
    },
  ];


export function MobileNav({
  access,
  accessLoading = false,
  demo = false,
}: MobileNavProps) {
  const pathname =
    usePathname();


  /* ==========================================================
     FILTER NAVIGATION
  ========================================================== */

  const visibleItems =
    React.useMemo(() => {
      if (demo) {
        return MOBILE_NAV_ITEMS;
      }


      if (access) {
        return MOBILE_NAV_ITEMS.filter(
          (item) =>
            hasAccessRequirement(
              access,
              item.requirement,
            ),
        );
      }


      return MOBILE_NAV_ITEMS.filter(
        (item) =>
          !item.requirement,
      );
    }, [
      access,
      demo,
    ]);


  return (
    <div
      className="
        fixed
        inset-x-0
        bottom-0
        z-40
        border-t
        bg-background/90
        pb-[env(safe-area-inset-bottom)]
        backdrop-blur-md
        md:hidden
      "
    >

      <div className="flex h-16 items-center justify-around px-2">

        {visibleItems.map(
          (item) => {
            const isActive =
              pathname === item.href ||
              (
                item.href !== "/" &&
                pathname?.startsWith(
                  `${item.href}/`,
                )
              );


            if (item.primary) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative -top-5 flex flex-col items-center"
                >

                  <div
                    className={cn(
                      `
                        flex
                        h-14
                        w-14
                        items-center
                        justify-center
                        rounded-full
                        bg-primary
                        text-primary-foreground
                        shadow-lg
                        shadow-primary/30
                        transition-transform
                      `,
                      isActive &&
                        "scale-105",
                    )}
                  >

                    <item.icon className="h-6 w-6" />

                  </div>


                  <span
                    className={cn(
                      "mt-1 text-[10px] font-medium",
                      isActive
                        ? "text-primary"
                        : "text-foreground",
                    )}
                  >

                    {item.label}

                  </span>

                </Link>
              );
            }


            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  `
                    flex
                    h-full
                    w-16
                    flex-col
                    items-center
                    justify-center
                    space-y-1
                    transition-colors
                  `,
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
              >

                <item.icon
                  className={cn(
                    "h-5 w-5",
                    isActive &&
                      "fill-primary/20",
                  )}
                />


                <span className="text-[10px] font-medium">
                  {item.label}
                </span>

              </Link>
            );
          },
        )}


        {accessLoading && (
          <span className="sr-only">
            Checking permissions
          </span>
        )}

      </div>

    </div>
  );
}