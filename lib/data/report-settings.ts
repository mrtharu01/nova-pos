"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  defaultReportSettings,
  type ReportSettings,
} from "@/lib/domain/report-settings";


type ReportSettingsRow = {
  business_id:
    string;

  display_name:
    string | null;

  address_line_1:
    string | null;

  address_line_2:
    string | null;

  phone:
    string | null;

  email:
    string | null;

  registration_number:
    string | null;

  report_title:
    string;

  footer_message:
    string;

  paper_size:
    "a4" | "letter";

  orientation:
    "portrait" | "landscape";

  show_gross_revenue:
    boolean;

  show_refunds:
    boolean;

  show_cogs:
    boolean;

  show_profit:
    boolean;

  show_sales_trend:
    boolean;

  show_payment_breakdown:
    boolean;

  show_top_products:
    boolean;

  show_transactions:
    boolean;

  show_generated_by_nova:
    boolean;
};


const SELECT_COLUMNS = `
  business_id,
  display_name,
  address_line_1,
  address_line_2,
  phone,
  email,
  registration_number,
  report_title,
  footer_message,
  paper_size,
  orientation,
  show_gross_revenue,
  show_refunds,
  show_cogs,
  show_profit,
  show_sales_trend,
  show_payment_breakdown,
  show_top_products,
  show_transactions,
  show_generated_by_nova
`;


function mapRow(
  row:
    ReportSettingsRow,
): ReportSettings {
  return {
    businessId:
      row.business_id,

    displayName:
      row.display_name ??
      "",

    addressLine1:
      row.address_line_1 ??
      "",

    addressLine2:
      row.address_line_2 ??
      "",

    phone:
      row.phone ??
      "",

    email:
      row.email ??
      "",

    registrationNumber:
      row.registration_number ??
      "",

    reportTitle:
      row.report_title,

    footerMessage:
      row.footer_message,

    paperSize:
      row.paper_size,

    orientation:
      row.orientation,

    showGrossRevenue:
      row.show_gross_revenue,

    showRefunds:
      row.show_refunds,

    showCogs:
      row.show_cogs,

    showProfit:
      row.show_profit,

    showSalesTrend:
      row.show_sales_trend,

    showPaymentBreakdown:
      row.show_payment_breakdown,

    showTopProducts:
      row.show_top_products,

    showTransactions:
      row.show_transactions,

    showGeneratedByNova:
      row.show_generated_by_nova,
  };
}


export async function fetchReportSettings(
  businessId:
    string,
): Promise<ReportSettings> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "report_settings",
      )
      .select(
        SELECT_COLUMNS,
      )
      .eq(
        "business_id",
        businessId,
      )
      .maybeSingle();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  if (!data) {
    return defaultReportSettings(
      businessId,
    );
  }


  return mapRow(
    data as
      ReportSettingsRow,
  );
}


export async function saveReportSettings(
  settings:
    ReportSettings,
): Promise<ReportSettings> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "report_settings",
      )
      .upsert(
        {
          business_id:
            settings.businessId,

          display_name:
            settings.displayName.trim() ||
            null,

          address_line_1:
            settings.addressLine1.trim() ||
            null,

          address_line_2:
            settings.addressLine2.trim() ||
            null,

          phone:
            settings.phone.trim() ||
            null,

          email:
            settings.email.trim() ||
            null,

          registration_number:
            settings.registrationNumber.trim() ||
            null,

          report_title:
            settings.reportTitle.trim() ||
            "Sales Report",

          footer_message:
            settings.footerMessage.trim(),

          paper_size:
            settings.paperSize,

          orientation:
            settings.orientation,

          show_gross_revenue:
            settings.showGrossRevenue,

          show_refunds:
            settings.showRefunds,

          show_cogs:
            settings.showCogs,

          show_profit:
            settings.showProfit,

          show_sales_trend:
            settings.showSalesTrend,

          show_payment_breakdown:
            settings.showPaymentBreakdown,

          show_top_products:
            settings.showTopProducts,

          show_transactions:
            settings.showTransactions,

          show_generated_by_nova:
            settings.showGeneratedByNova,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "business_id",
        },
      )
      .select(
        SELECT_COLUMNS,
      )
      .single();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return mapRow(
    data as
      ReportSettingsRow,
  );
}