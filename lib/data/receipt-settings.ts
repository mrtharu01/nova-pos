"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettingsForm,
} from "@/lib/domain/receipt-settings";

type ReceiptSettingsRow = {
  paper_width:
    "58mm" | "80mm";

  auto_print:
    boolean;

  display_name:
    | string
    | null;

  address_line_1:
    | string
    | null;

  address_line_2:
    | string
    | null;

  phone:
    | string
    | null;

  email:
    | string
    | null;

  tax_registration_number:
    | string
    | null;

  footer_message:
    | string
    | null;

  show_sku:
    boolean;

  show_cashier:
    boolean;

  show_customer:
    boolean;
};

function mapRow(
  row: ReceiptSettingsRow,
): ReceiptSettingsForm {
  return {
    paperWidth:
      row.paper_width,

    autoPrint:
      row.auto_print,

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

    taxRegistrationNumber:
      row.tax_registration_number ??
      "",

    footerMessage:
      row.footer_message ??
      DEFAULT_RECEIPT_SETTINGS.footerMessage,

    showSku:
      row.show_sku,

    showCashier:
      row.show_cashier,

    showCustomer:
      row.show_customer,
  };
}

export async function fetchReceiptSettings(
  businessId: string,
): Promise<ReceiptSettingsForm> {
  const supabase =
    createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "receipt_settings",
      )
      .select(`
        paper_width,
        auto_print,
        display_name,
        address_line_1,
        address_line_2,
        phone,
        email,
        tax_registration_number,
        footer_message,
        show_sku,
        show_cashier,
        show_customer
      `)
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

  /*
   * Phase 4C should already
   * have created this row.
   *
   * Returning defaults here
   * prevents the settings page
   * from crashing if an older
   * development business somehow
   * has no row.
   */

  if (!data) {
    return {
      ...DEFAULT_RECEIPT_SETTINGS,
    };
  }

  return mapRow(
    data as ReceiptSettingsRow,
  );
}

export async function saveReceiptSettings(
  businessId: string,
  settings: ReceiptSettingsForm,
): Promise<ReceiptSettingsForm> {
  const supabase =
    createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "receipt_settings",
      )
      .update({
        paper_width:
          settings.paperWidth,

        auto_print:
          settings.autoPrint,

        display_name:
          settings.displayName
            .trim() ||
          null,

        address_line_1:
          settings.addressLine1
            .trim() ||
          null,

        address_line_2:
          settings.addressLine2
            .trim() ||
          null,

        phone:
          settings.phone
            .trim() ||
          null,

        email:
          settings.email
            .trim() ||
          null,

        tax_registration_number:
          settings.taxRegistrationNumber
            .trim() ||
          null,

        footer_message:
          settings.footerMessage
            .trim() ||
          "Thank you for shopping with us!",

        show_sku:
          settings.showSku,

        show_cashier:
          settings.showCashier,

        show_customer:
          settings.showCustomer,
      })
      .eq(
        "business_id",
        businessId,
      )
      .select(`
        paper_width,
        auto_print,
        display_name,
        address_line_1,
        address_line_2,
        phone,
        email,
        tax_registration_number,
        footer_message,
        show_sku,
        show_cashier,
        show_customer
      `)
      .single();

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return mapRow(
    data as ReceiptSettingsRow,
  );
}