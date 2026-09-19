"use client";

import * as React from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  fetchDashboardReport,
} from "@/lib/data/dashboard";

import {
  dashboardRange,
  type DashboardRangePreset,
  type DashboardReport,
} from "@/lib/domain/dashboard";


type LiveStatus =
  | "connecting"
  | "live"
  | "offline";


const LIVE_TABLES = [
  "sales",
  "sale_items",
  "payments",
  "sale_refunds",
  "sale_refund_items",
  "sale_voids",
  "inventory_levels",
  "products",
  "product_variants",
] as const;


export function useDashboardReport(
  businessId:
    | string
    | undefined,

  preset:
    DashboardRangePreset,
) {
  const supabase =
    React.useMemo(
      () =>
        createClient(),
      [],
    );


  const [
    report,
    setReport,
  ] =
    React.useState<
      DashboardReport | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );


  const [
    syncing,
    setSyncing,
  ] =
    React.useState(
      false,
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
    React.useState(
      0,
    );


  const [
    liveStatus,
    setLiveStatus,
  ] =
    React.useState<
      LiveStatus
    >(
      "connecting",
    );


  const [
    lastUpdatedAt,
    setLastUpdatedAt,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const requestIdRef =
    React.useRef(
      0,
    );


  const liveRefreshTimerRef =
    React.useRef<
      number | null
    >(
      null,
    );


  const range =
    React.useMemo(
      () =>
        dashboardRange(
          preset,
        ),
      [
        preset,
      ],
    );


  /* ==========================================================
     REPORT LOAD

     Initial loads show the full skeleton.
     Realtime updates refresh quietly in the background.
  ========================================================== */

  React.useEffect(() => {
    if (
      !businessId
    ) {
      setReport(
        null,
      );

      setLoading(
        false,
      );

      setSyncing(
        false,
      );

      return;
    }


    let cancelled =
      false;


    const requestId =
      ++requestIdRef.current;


    async function load() {
      const background =
        Boolean(
          report,
        );


      if (
        background
      ) {
        setSyncing(
          true,
        );
      } else {
        setLoading(
          true,
        );
      }


      setError(
        null,
      );


      try {
        const result =
          await fetchDashboardReport({
            businessId:
              businessId!,

            startDate:
              range.startDate,

            endDate:
              range.endDate,
          });


        if (
          cancelled ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }


        setReport(
          result,
        );


        setLastUpdatedAt(
          new Date()
            .toISOString(),
        );
      } catch (cause) {
        if (
          cancelled ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }


        setError(
          cause instanceof
            Error
            ? cause.message
            : "Dashboard report could not be loaded.",
        );
      } finally {
        if (
          cancelled ||
          requestId !==
            requestIdRef.current
        ) {
          return;
        }


        setLoading(
          false,
        );


        setSyncing(
          false,
        );
      }
    }


    void load();


    return () => {
      cancelled =
        true;
    };
  }, [
    businessId,
    range.startDate,
    range.endDate,
    refreshKey,
  ]);


  /* ==========================================================
     LIVE DATABASE WRAPPER

     Any relevant tenant-scoped database change schedules a
     single quiet refresh. Multiple writes from one checkout are
     collapsed into one refresh so checkout does not cause a
     burst of report requests.
  ========================================================== */

  React.useEffect(() => {
    if (
      !businessId
    ) {
      setLiveStatus(
        "offline",
      );

      return;
    }


    setLiveStatus(
      "connecting",
    );


    function scheduleRefresh() {
      if (
        liveRefreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          liveRefreshTimerRef.current,
        );
      }


      liveRefreshTimerRef.current =
        window.setTimeout(
          () => {
            liveRefreshTimerRef.current =
              null;


            setRefreshKey(
              (
                value,
              ) =>
                value + 1,
            );
          },
          350,
        );
    }


    const channel =
      supabase.channel(
        `nova-dashboard-live-${businessId}`,
      );


    for (
      const table of
      LIVE_TABLES
    ) {
      channel.on(
        "postgres_changes",
        {
          event:
            "*",

          schema:
            "public",

          table,

          filter:
            `business_id=eq.${businessId}`,
        },
        scheduleRefresh,
      );
    }


    channel.subscribe(
      (
        status,
      ) => {
        if (
          status ===
          "SUBSCRIBED"
        ) {
          setLiveStatus(
            "live",
          );

          return;
        }


        if (
          status ===
            "CHANNEL_ERROR" ||
          status ===
            "TIMED_OUT" ||
          status ===
            "CLOSED"
        ) {
          setLiveStatus(
            "offline",
          );
        }
      },
    );


    function refreshOnFocus() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        scheduleRefresh();
      }
    }


    document.addEventListener(
      "visibilitychange",
      refreshOnFocus,
    );


    return () => {
      document.removeEventListener(
        "visibilitychange",
        refreshOnFocus,
      );


      if (
        liveRefreshTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          liveRefreshTimerRef.current,
        );

        liveRefreshTimerRef.current =
          null;
      }


      void supabase.removeChannel(
        channel,
      );
    };
  }, [
    businessId,
    supabase,
  ]);


  function refresh() {
    setRefreshKey(
      (
        value,
      ) =>
        value + 1,
    );
  }


  return {
    report,
    loading,
    syncing,
    error,
    refresh,
    range,
    liveStatus,
    lastUpdatedAt,
  };
}
