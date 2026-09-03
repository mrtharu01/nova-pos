"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function createBusiness(formData: FormData) {
  const name = getText(formData, "name");
  const currencyCode = getText(formData, "currencyCode").toUpperCase() || "LKR";
  const timezone = getText(formData, "timezone") || "Asia/Colombo";

  if (name.length < 2 || name.length > 120) {
    redirect(`/onboarding?error=${encodeURIComponent("Enter a valid business name.")}`);
  }

  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    redirect(`/onboarding?error=${encodeURIComponent("Currency must be a three-letter code such as LKR.")}`);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect("/login");

  const { error } = await supabase.rpc("bootstrap_business", {
    p_name: name,
    p_currency_code: currencyCode,
    p_timezone: timezone,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message || "Unable to create business.")}`);
  }

  redirect("/");
}
