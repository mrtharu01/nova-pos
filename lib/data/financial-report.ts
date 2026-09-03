"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  DashboardReport,
} from "@/lib/domain/dashboard";


export async function fetchFinancialReport({
  businessId,
  startDate,
  endDate,
}: {
  businessId:
    string;

  startDate:
    string;

  endDate:
    string;
}): Promise<DashboardReport> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_financial_report",
      {
        p_business_id:
          businessId,

        p_start_date:
          startDate,

        p_end_date:
          endDate,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data as
    DashboardReport;
}