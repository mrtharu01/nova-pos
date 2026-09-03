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
      path: "/customers",
      requirement: "manager",
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
     * /more is the mobile overflow screen
     * containing management navigation.
     */
    {
      path: "/more",
      requirement: "manager",
    },
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