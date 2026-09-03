"use client";

import * as React from "react";

import {
  fetchSalesList,
} from "@/lib/data/sales";

import type {
  SaleListItem,
} from "@/lib/domain/sales";

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message ===
      "string"
    ) {
      return message;
    }
  }

  return "Unable to load sales.";
}

export function useSales() {
  const [
    sales,
    setSales,
  ] =
    React.useState<
      SaleListItem[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    React.useState(true);

  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);

  const refresh =
    React.useCallback(
      async () => {
        setLoading(true);
        setError(null);

        try {
          const next =
            await fetchSalesList();

          setSales(next);
        } catch (cause) {
          console.error(
            "Failed to load NOVA sales:",
            cause,
          );

          setError(
            getErrorMessage(
              cause,
            ),
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    sales,
    loading,
    error,
    refresh,
  };
}