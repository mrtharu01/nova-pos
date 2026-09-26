"use client";

import * as React from "react";

import {
  fetchMySubscription,
} from "@/lib/data/subscription";

import type {
  NovaCurrentSubscription,
} from "@/lib/domain/subscription";


let cachedSubscription:
  NovaCurrentSubscription |
  null =
    null;


let pendingRequest:
  Promise<NovaCurrentSubscription> |
  null =
    null;


async function loadSubscription() {
  if (
    pendingRequest
  ) {
    return pendingRequest;
  }


  pendingRequest =
    fetchMySubscription();


  try {
    const result =
      await pendingRequest;


    cachedSubscription =
      result;


    return result;
  } finally {
    pendingRequest =
      null;
  }
}


export function useSubscription() {
  const [
    subscription,
    setSubscription,
  ] =
    React.useState<
      NovaCurrentSubscription |
      null
    >(
      cachedSubscription,
    );


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      cachedSubscription ===
        null,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string |
      null
    >(
      null,
    );


  const [
    refreshKey,
    setRefreshKey,
  ] =
    React.useState(0);


  React.useEffect(() => {
    let cancelled =
      false;


    if (
      cachedSubscription
    ) {
      setSubscription(
        cachedSubscription,
      );

      setLoading(
        false,
      );
    } else {
      setLoading(
        true,
      );
    }


    setError(
      null,
    );


    void loadSubscription()
      .then(
        (
          result,
        ) => {
          if (
            cancelled
          ) {
            return;
          }


          setSubscription(
            result,
          );

          setError(
            null,
          );
        },
      )
      .catch(
        (
          cause,
        ) => {
          if (
            cancelled
          ) {
            return;
          }


          setError(
            cause instanceof Error
              ? cause.message
              : "Subscription information could not be loaded.",
          );
        },
      )
      .finally(
        () => {
          if (
            !cancelled
          ) {
            setLoading(
              false,
            );
          }
        },
      );


    return () => {
      cancelled =
        true;
    };
  }, [
    refreshKey,
  ]);


  function refresh() {
    cachedSubscription =
      null;

    setRefreshKey(
      (
        value,
      ) =>
        value + 1,
    );
  }


  return {
    subscription,
    loading,
    error,
    refresh,
  };
}
