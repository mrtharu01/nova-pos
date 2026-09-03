"use client";

import * as React from "react";

import {
  fetchDashboardReport,
} from "@/lib/data/dashboard";

import {
  dashboardRange,
  type DashboardRangePreset,
  type DashboardReport,
} from "@/lib/domain/dashboard";


export function useDashboardReport(
  businessId:
    | string
    | undefined,

  preset:
    DashboardRangePreset,
) {
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


  React.useEffect(() => {
    if (
      !businessId
    ) {
      return;
    }


    let cancelled =
      false;


    async function load() {
      setLoading(
        true,
      );

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
          cancelled
        ) {
          return;
        }


        setReport(
          result,
        );
      } catch (cause) {
        if (
          cancelled
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
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
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


  function refresh() {
    setRefreshKey(
      (value) =>
        value + 1,
    );
  }


  return {
    report,
    loading,
    error,
    refresh,
    range,
  };
}