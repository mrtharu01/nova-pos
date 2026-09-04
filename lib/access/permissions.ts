import type {
  BusinessAccess,
  BusinessPermissions,
} from "@/lib/domain/access";


export type AccessRequirement =
  | "manager"
  | keyof BusinessPermissions;


type RouteRule = {
  path: string;

  requirement: AccessRequirement;
};


/* ============================================================
   ROUTE PERMISSION MAP

   PostgreSQL / RLS remains the real security boundary.

   These rules control:
   - navigation visibility
   - direct route access
   - client-side redirects

   Routes without a rule are available to every active
   business member (Owner, Manager and Cashier).
============================================================ */

const ROUTE_RULES:
  RouteRule[] = [
    {
      path: "/products",
      requirement: "manageCatalog",
    },

    {
      path: "/inventory",
      requirement: "manageInventory",
    },

    {
      path: "/qr",
      requirement: "manager",
    },

    {
      path: "/reports",
      requirement: "viewReports",
    },

    {
      path: "/expenses",
      requirement: "manager",
    },

    {
      path: "/settings",
      requirement: "manageSettings",
    },

    /*
     * /customers is intentionally available to all active
     * business members.
     *
     * Permanent customer discounts remain Manager/Owner-only
     * at both the UI and PostgreSQL layers.
     */

    /*
     * /more is also available to all active business members.
     *
     * The More screen filters its own links using the same
     * permission model, allowing Cashiers to reach Customers
     * without exposing management pages.
     */
  ];


/* ============================================================
   REQUIREMENT CHECK
============================================================ */

export function hasAccessRequirement(
  access: BusinessAccess,

  requirement?: AccessRequirement,
) {
  if (!requirement) {
    return true;
  }


  if (requirement === "manager") {
    return (
      access.role === "owner" ||
      access.role === "manager"
    );
  }


  return Boolean(
    access.permissions[
      requirement
    ],
  );
}


/* ============================================================
   ROUTE MATCHING
============================================================ */

function matchesRoute(
  pathname: string,

  route: string,
) {
  return (
    pathname === route ||
    pathname.startsWith(
      `${route}/`,
    )
  );
}


/* ============================================================
   GET REQUIREMENT
============================================================ */

export function getPathRequirement(
  pathname: string,
):
  | AccessRequirement
  | undefined {
  const rule =
    ROUTE_RULES.find(
      (item) =>
        matchesRoute(
          pathname,
          item.path,
        ),
    );


  return rule?.requirement;
}


/* ============================================================
   PATH ACCESS
============================================================ */

export function canAccessPath(
  access: BusinessAccess,

  pathname: string,
) {
  return hasAccessRequirement(
    access,
    getPathRequirement(
      pathname,
    ),
  );
}