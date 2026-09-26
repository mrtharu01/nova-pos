"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  NovaAvailablePlan,
  NovaCurrentSubscription,
} from "@/lib/domain/subscription";


export async function fetchMySubscription():
Promise<NovaCurrentSubscription> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_my_subscription",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    {
      configured:
        false,
    }
  ) as NovaCurrentSubscription;
}


export async function fetchAvailablePlans():
Promise<NovaAvailablePlan[]> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_my_available_subscription_plans",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as NovaAvailablePlan[];
}
