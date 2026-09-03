"use client";

import * as React from "react";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  Archive,
  BarChart3,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Package,
  QrCode,
  ReceiptText,
  Settings,
  ShoppingCart,
  Users,
} from "lucide-react";

import {
  motion,
} from "motion/react";

import {
  ProfileDialog,
} from "@/components/layout/ProfileDialog";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  hasAccessRequirement,
  type AccessRequirement,
} from "@/lib/access/permissions";

import {
  fetchAccountProfile,
  type AccountProfile,
} from "@/lib/data/profile";

import type {
  BusinessAccess,
} from "@/lib/domain/access";

import {
  cn,
} from "@/lib/utils";


type SidebarProps = {
  access:
    BusinessAccess | null;

  accessLoading?:
    boolean;
};


type NavItem = {
  href:
    string;

  label:
    string;

  icon:
    React.ComponentType<{
      className?:
        string;
    }>;

  requirement?:
    AccessRequirement;
};


const NAV_ITEMS:
  NavItem[] = [
    {
      href:
        "/",

      label:
        "Dashboard",

      icon:
        LayoutDashboard,
    },

    {
      href:
        "/pos",

      label:
        "POS",

      icon:
        ShoppingCart,
    },

    {
      href:
        "/products",

      label:
        "Products",

      icon:
        Package,

      requirement:
        "manageCatalog",
    },

    {
      href:
        "/inventory",

      label:
        "Inventory",

      icon:
        Archive,

      requirement:
        "manageInventory",
    },

    {
      href:
        "/sales",

      label:
        "Sales",

      icon:
        ReceiptText,
    },

    {
      href:
        "/customers",

      label:
        "Customers",

      icon:
        Users,

      requirement:
        "manager",
    },

    {
      href:
        "/qr",

      label:
        "QR Codes",

      icon:
        QrCode,

      requirement:
        "manager",
    },

    {
      href:
        "/reports",

      label:
        "Reports",

      icon:
        BarChart3,

      requirement:
        "viewReports",
    },

    {
      href:
        "/expenses",

      label:
        "Expenses",

      icon:
        CreditCard,

      requirement:
        "manager",
    },

    {
      href:
        "/settings",

      label:
        "Settings",

      icon:
        Settings,

      requirement:
        "manageSettings",
    },
  ];


/* ============================================================
   ROLE
============================================================ */

function roleLabel(
  access:
    BusinessAccess | null,
  demo:
    boolean,
) {
  if (demo) {
    return "Demo";
  }


  switch (
    access?.role
  ) {
    case "owner":
      return "Owner";

    case "manager":
      return "Manager";

    case "cashier":
      return "Cashier";

    default:
      return "Account";
  }
}


function roleInitials(
  access:
    BusinessAccess | null,
  demo:
    boolean,
) {
  if (demo) {
    return "DM";
  }


  switch (
    access?.role
  ) {
    case "owner":
      return "OW";

    case "manager":
      return "MG";

    case "cashier":
      return "CA";

    default:
      return "NA";
  }
}


function profileInitials(
  value: string,
  fallback: string,
) {
  const pieces =
    value
      .trim()
      .split(/\s+/)
      .filter(
        Boolean,
      );


  if (
    pieces.length ===
    0
  ) {
    return fallback;
  }


  if (
    pieces.length ===
    1
  ) {
    return pieces[0]
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }


  return (
    pieces[0][0] +
    pieces[
      pieces.length - 1
    ][0]
  ).toUpperCase();
}


/* ============================================================
   SIDEBAR
============================================================ */

export function Sidebar({
  access,
  accessLoading = false,
}: SidebarProps) {
  const pathname =
    usePathname();


  const {
    email,
    business,
    demo,
  } =
    useCurrentBusiness();


  const [
    profileOpen,
    setProfileOpen,
  ] =
    React.useState(false);


  const [
    profile,
    setProfile,
  ] =
    React.useState<
      AccountProfile | null
    >(null);


  /* ==========================================================
     LOAD ACCOUNT PROFILE
  ========================================================== */

  React.useEffect(() => {
    if (demo) {
      setProfile(null);

      return;
    }


    let cancelled =
      false;


    void fetchAccountProfile()
      .then(
        (result) => {
          if (
            !cancelled
          ) {
            setProfile(
              result,
            );
          }
        },
      )
      .catch(
        () => {
          /*
           * Sidebar can still work even if
           * profile metadata is unavailable.
           */
        },
      );


    return () => {
      cancelled =
        true;
    };
  }, [
    demo,
  ]);


  /* ==========================================================
     NAV PERMISSIONS
  ========================================================== */

  const visibleItems =
    React.useMemo(
      () => {
        if (demo) {
          return NAV_ITEMS;
        }


        if (access) {
          return NAV_ITEMS.filter(
            (item) =>
              hasAccessRequirement(
                access,
                item.requirement,
              ),
          );
        }


        return NAV_ITEMS.filter(
          (item) =>
            !item.requirement,
        );
      },
      [
        access,
        demo,
      ],
    );


  const currentRoleLabel =
    roleLabel(
      access,
      demo,
    );


  const fallbackInitials =
    roleInitials(
      access,
      demo,
    );


  const accountName =
    profile?.displayName ??
    business?.name ??
    "NOVA Account";


  const avatarInitials =
    profileInitials(
      accountName,
      fallbackInitials,
    );


  return (
    <>

      <div className="hidden h-screen w-64 flex-col border-r bg-card md:flex">

        {/* ====================================================
            BRAND
        ===================================================== */}

        <div className="flex items-center gap-3 p-6">

          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/30">

            N

          </div>


          <div className="min-w-0">

            <span className="block truncate text-xl font-bold tracking-tight text-foreground">
              Nova POS
            </span>


            <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {
                currentRoleLabel
              }
            </span>

          </div>

        </div>


        {/* ====================================================
            NAVIGATION
        ===================================================== */}

        <div className="flex-1 space-y-1 overflow-y-auto px-4 py-2">

          {visibleItems.map(
            (item) => {
              const isActive =
                pathname ===
                  item.href ||
                (
                  item.href !==
                    "/" &&
                  pathname?.startsWith(
                    item.href,
                  )
                );


              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  className={cn(
                    "relative flex items-center gap-3 rounded-[12px] px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "font-bold text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >

                  {isActive && (

                    <>

                      <motion.div
                        layoutId="sidebar-active-bg"
                        className="absolute inset-0 rounded-[12px] bg-primary/10"
                        initial={
                          false
                        }
                        transition={{
                          type:
                            "spring",

                          stiffness:
                            300,

                          damping:
                            30,
                        }}
                      />


                      <motion.div
                        layoutId="sidebar-active-indicator"
                        className="absolute -left-[16px] h-6 w-1 rounded-r-full bg-primary"
                        initial={
                          false
                        }
                        transition={{
                          type:
                            "spring",

                          stiffness:
                            300,

                          damping:
                            30,
                        }}
                      />

                    </>

                  )}


                  <item.icon className="relative z-10 h-5 w-5" />


                  <span className="relative z-10">
                    {
                      item.label
                    }
                  </span>

                </Link>
              );
            },
          )}


          {accessLoading && (

            <div className="px-3 py-2 text-[10px] text-muted-foreground">
              Checking permissions…
            </div>

          )}

        </div>


        {/* ====================================================
            PROFILE
        ===================================================== */}

        <div className="mt-auto border-t p-3">

          <button
            type="button"
            disabled={
              demo
            }
            onClick={() =>
              setProfileOpen(
                true,
              )
            }
            className="group flex w-full items-center gap-3 rounded-[16px] p-2.5 text-left transition-colors hover:bg-muted/60 disabled:cursor-default"
          >

            {/* AVATAR */}

            {profile?.avatarUrl ? (

              <img
                src={
                  profile.avatarUrl
                }
                alt=""
                className="h-10 w-10 shrink-0 rounded-[13px] border object-cover"
              />

            ) : (

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-secondary text-xs font-bold">

                {
                  avatarInitials
                }

              </div>

            )}


            {/* DETAILS */}

            <div className="min-w-0 flex-1">

              <p className="truncate text-sm font-semibold">
                {
                  accountName
                }
              </p>


              <div className="mt-1 flex min-w-0 items-center gap-1.5">

                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">

                  {
                    currentRoleLabel
                  }

                </span>


                <p className="truncate text-[10px] text-muted-foreground">

                  {demo
                    ? "Demo mode"
                    : profile?.email ||
                      email}

                </p>

              </div>

            </div>


            {!demo && (

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />

            )}

          </button>

        </div>

      </div>


      {/* ======================================================
          PROFILE DIALOG
      ======================================================= */}

      {!demo && (

        <ProfileDialog
          isOpen={
            profileOpen
          }
          onClose={() =>
            setProfileOpen(
              false,
            )
          }
          businessName={
            business?.name ??
            "NOVA POS"
          }
          roleLabel={
            currentRoleLabel
          }
          onProfileUpdated={(
            updated,
          ) =>
            setProfile(
              updated,
            )
          }
        />

      )}

    </>
  );
}