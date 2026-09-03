"use client";

import * as React from "react";

import {
  fetchBusinessAccess,
} from "@/lib/data/access";

import type {
  BusinessAccess,
} from "@/lib/domain/access";


/*
 * Permission information is cached per business.
 *
 * This prevents AppLayout from temporarily losing the user's
 * role every time Next.js mounts another page.
 */
const accessCache =
  new Map<
    string,
    BusinessAccess
  >();


/*
 * Also deduplicate simultaneous requests.
 *
 * Example:
 *
 * AppLayout
 * StaffSettingsCard
 *
 * can both request access at nearly the same time.
 */
const pendingRequests =
  new Map<
    string,
    Promise<BusinessAccess>
  >();


/* ============================================================
   LOAD ACCESS
============================================================ */

async function loadBusinessAccess(
  businessId: string,
) {
  const pending =
    pendingRequests.get(
      businessId,
    );


  if (pending) {
    return pending;
  }


  const request =
    fetchBusinessAccess(
      businessId,
    );


  pendingRequests.set(
    businessId,
    request,
  );


  try {
    const result =
      await request;


    accessCache.set(
      businessId,
      result,
    );


    return result;
  } catch (cause) {
    /*
     * If a background permission revalidation fails because
     * the employee was disabled, remove the stale role.
     */
    accessCache.delete(
      businessId,
    );


    throw cause;
  } finally {
    if (
      pendingRequests.get(
        businessId,
      ) ===
      request
    ) {
      pendingRequests.delete(
        businessId,
      );
    }
  }
}


/* ============================================================
   HOOK
============================================================ */

export function useBusinessAccess(
  businessId:
    | string
    | undefined,
) {
  const [
    access,
    setAccess,
  ] =
    React.useState<
      BusinessAccess | null
    >(
      () =>
        businessId
          ? accessCache.get(
              businessId,
            ) ??
            null
          : null,
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      () =>
        Boolean(
          businessId &&
          !accessCache.has(
            businessId,
          ),
        ),
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    refreshKey,
    setRefreshKey,
  ] =
    React.useState(0);


  React.useEffect(() => {
    if (!businessId) {
      setAccess(null);

      setLoading(false);

      setError(null);

      return;
    }


    let cancelled =
      false;


    const cached =
      accessCache.get(
        businessId,
      );


    /*
     * Use the previous permission result immediately.
     *
     * Most importantly, DO NOT set loading=true when cache
     * exists. This keeps Sidebar, MobileNav and Settings stable
     * while a background refresh happens.
     */
    if (cached) {
      setAccess(
        cached,
      );

      setLoading(false);
    } else {
      setAccess(null);

      setLoading(true);
    }


    setError(null);


    async function load() {
      try {
        const result =
          await loadBusinessAccess(
            businessId!,
          );


        if (cancelled) {
          return;
        }


        setAccess(
          result,
        );


        setError(null);
      } catch (cause) {
        if (cancelled) {
          return;
        }


        setAccess(null);


        setError(
          cause instanceof Error
            ? cause.message
            : "Access information could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    /*
     * Cached access remains visible while this request checks
     * whether the user's role/status has changed.
     */
    void load();


    return () => {
      cancelled =
        true;
    };
  }, [
    businessId,
    refreshKey,
  ]);


  function refresh() {
    setRefreshKey(
      (value) =>
        value + 1,
    );
  }


  return {
    access,
    loading,
    error,
    refresh,
  };
}