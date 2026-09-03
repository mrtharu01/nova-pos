"use client";

import * as React from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  isDemoMode,
  isSupabaseConfigured,
} from "@/lib/supabase/config";


export type CurrentBusiness = {
  id: string;

  name: string;

  currency_code: string;

  timezone: string;
};


type CurrentBusinessSnapshot = {
  email: string;

  business:
    | CurrentBusiness
    | null;
};


const DEMO_BUSINESS: CurrentBusiness = {
  id: "demo",

  name: "NOVA Demo Store",

  currency_code: "LKR",

  timezone: "Asia/Colombo",
};


/*
 * These live for the lifetime of the browser application.
 *
 * They survive client-side page navigation because the module
 * itself does not get recreated every time AppLayout mounts.
 */
let cachedSnapshot:
  | CurrentBusinessSnapshot
  | null = null;


let pendingRequest:
  | Promise<CurrentBusinessSnapshot>
  | null = null;


/* ============================================================
   LOAD CURRENT BUSINESS
============================================================ */

async function loadCurrentBusinessSnapshot() {
  /*
   * AppLayout and Sidebar can call this hook at the same time.
   *
   * Reuse one in-flight request instead of sending duplicate
   * Supabase queries.
   */
  if (pendingRequest) {
    return pendingRequest;
  }


  const request =
    (async (): Promise<CurrentBusinessSnapshot> => {
      const supabase =
        createClient();


      const [
        userResult,
        businessResult,
      ] =
        await Promise.all([
          supabase.auth.getUser(),

          supabase
            .from(
              "businesses",
            )
            .select(
              `
              id,
              name,
              currency_code,
              timezone
              `,
            )
            .limit(1),
        ]);


      if (
        userResult.error
      ) {
        throw new Error(
          userResult.error.message,
        );
      }


      if (
        businessResult.error
      ) {
        throw new Error(
          businessResult.error.message,
        );
      }


      const business =
        (
          businessResult.data?.[0] ??
          null
        ) as
          | CurrentBusiness
          | null;


      const snapshot:
        CurrentBusinessSnapshot = {
          email:
            userResult.data.user?.email ??
            "Signed-in user",

          business,
        };


      cachedSnapshot =
        snapshot;


      return snapshot;
    })();


  pendingRequest =
    request;


  try {
    return await request;
  } finally {
    /*
     * Only clear the promise belonging to this request.
     */
    if (
      pendingRequest ===
      request
    ) {
      pendingRequest =
        null;
    }
  }
}


/* ============================================================
   HOOK
============================================================ */

export function useCurrentBusiness() {
  const demo =
    isDemoMode() ||
    !isSupabaseConfigured();


  /*
   * The important part:
   *
   * On a client-side route change we initialise state using
   * the cached business instead of null.
   */
  const [
    email,
    setEmail,
  ] =
    React.useState(
      () =>
        demo
          ? "demo@nova.local"
          : cachedSnapshot?.email ??
            "",
    );


  const [
    business,
    setBusiness,
  ] =
    React.useState<
      CurrentBusiness | null
    >(
      () =>
        demo
          ? DEMO_BUSINESS
          : cachedSnapshot?.business ??
            null,
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      () =>
        !demo &&
        !cachedSnapshot,
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
    if (demo) {
      setEmail(
        "demo@nova.local",
      );

      setBusiness(
        DEMO_BUSINESS,
      );

      setLoading(false);

      setError(null);

      return;
    }


    let cancelled =
      false;


    /*
     * Immediately restore cached information.
     *
     * This happens synchronously enough that route navigation
     * no longer rebuilds the sidebar from business=null.
     */
    if (cachedSnapshot) {
      setEmail(
        cachedSnapshot.email,
      );

      setBusiness(
        cachedSnapshot.business,
      );

      setLoading(false);
    } else {
      setLoading(true);
    }


    async function load() {
      setError(null);


      try {
        const snapshot =
          await loadCurrentBusinessSnapshot();


        if (cancelled) {
          return;
        }


        setEmail(
          snapshot.email,
        );


        setBusiness(
          snapshot.business,
        );
      } catch (cause) {
        if (cancelled) {
          return;
        }


        setError(
          cause instanceof Error
            ? cause.message
            : "Business information could not be loaded.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }


    /*
     * Even if we already have cache, revalidate quietly.
     *
     * This means updated business information eventually
     * reaches the application without producing navigation
     * flicker.
     */
    void load();


    return () => {
      cancelled =
        true;
    };
  }, [
    demo,
    refreshKey,
  ]);


  function refresh() {
    setRefreshKey(
      (value) =>
        value + 1,
    );
  }


  return {
    email,
    business,
    demo,
    loading,
    error,
    refresh,
  };
}