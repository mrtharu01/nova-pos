"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  CompleteSaleInput,
  CompleteSaleResult,
} from "@/lib/domain/checkout";

import type {
  PaymentMethod,
} from "@/lib/domain/sales";


type LoyaltyCompleteSaleInput =
  CompleteSaleInput & {
    customerId?:
      | string
      | null;

    loyaltyPointsToRedeem?:
      number;
  };


type CompleteSaleRow = {
  sale_id: string;

  receipt_number: string;

  receipt_sequence:
    | number
    | string;

  currency_code: string;

  subtotal:
    | number
    | string;

  discount_total:
    | number
    | string;

  tax_total:
    | number
    | string;

  total:
    | number
    | string;

  item_quantity_total:
    | number
    | string;

  payment_method:
    PaymentMethod;

  cash_received:
    | number
    | string
    | null;

  change_due:
    | number
    | string
    | null;

  created_at: string;

  was_existing: boolean;
};


type SupabaseRpcError = {
  message?: unknown;

  details?: unknown;

  hint?: unknown;

  code?: unknown;
};


function buildRpcErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }


  if (
    !error ||
    typeof error !==
      "object"
  ) {
    return "The sale could not be completed.";
  }


  const rpcError =
    error as
      SupabaseRpcError;


  const parts:
    string[] = [];


  if (
    typeof rpcError.message ===
      "string" &&
    rpcError.message.trim()
  ) {
    parts.push(
      rpcError.message.trim(),
    );
  }


  if (
    typeof rpcError.details ===
      "string" &&
    rpcError.details.trim()
  ) {
    parts.push(
      `Details: ${rpcError.details.trim()}`,
    );
  }


  if (
    typeof rpcError.hint ===
      "string" &&
    rpcError.hint.trim()
  ) {
    parts.push(
      `Hint: ${rpcError.hint.trim()}`,
    );
  }


  if (
    typeof rpcError.code ===
      "string" &&
    rpcError.code.trim()
  ) {
    parts.push(
      `Code: ${rpcError.code.trim()}`,
    );
  }


  if (
    parts.length ===
      0
  ) {
    return "The database rejected the sale, but no error message was returned.";
  }


  return parts.join(
    " • ",
  );
}


export async function completeSale(
  input:
    LoyaltyCompleteSaleInput,
): Promise<CompleteSaleResult> {
  const supabase =
    createClient();


  const rpcItems =
    input.items.map(
      (item) => ({
        variant_id:
          item.variantId,

        quantity:
          item.quantity,
      }),
    );


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "complete_sale",
      {
        p_business_id:
          input.businessId,

        p_checkout_key:
          input.checkoutKey,

        p_items:
          rpcItems,

        p_payment_method:
          input.paymentMethod,

        p_cash_received:
          input.paymentMethod ===
          "cash"
            ? input.cashReceived ??
              null
            : null,

        p_reference_number:
          input.referenceNumber
            ?.trim() ||
          null,

        p_discount_total:
          input.discountTotal ??
          0,

        p_customer_name:
          input.customerName
            ?.trim() ||
          null,

        p_customer_email:
          input.customerEmail
            ?.trim() ||
          null,

        p_customer_phone:
          input.customerPhone
            ?.trim() ||
          null,

        p_note:
          input.note
            ?.trim() ||
          "",

        p_customer_id:
          input.customerId ??
          null,

        p_loyalty_points_to_redeem:
          Math.max(
            0,
            Math.floor(
              input.loyaltyPointsToRedeem ??
              0,
            ),
          ),
      },
    );


  if (error) {
    throw new Error(
      buildRpcErrorMessage(
        error,
      ),
    );
  }


  const rows =
    data as
      | CompleteSaleRow[]
      | null;


  const row =
    rows?.[0];


  if (!row) {
    throw new Error(
      "NOVA did not return a completed sale.",
    );
  }


  return {
    saleId:
      row.sale_id,

    receiptNumber:
      row.receipt_number,

    receiptSequence:
      Number(
        row.receipt_sequence,
      ),

    currencyCode:
      row.currency_code,

    subtotal:
      Number(
        row.subtotal,
      ),

    discountTotal:
      Number(
        row.discount_total,
      ),

    taxTotal:
      Number(
        row.tax_total,
      ),

    total:
      Number(
        row.total,
      ),

    itemQuantityTotal:
      Number(
        row.item_quantity_total,
      ),

    paymentMethod:
      row.payment_method,

    cashReceived:
      row.cash_received ===
      null
        ? undefined
        : Number(
            row.cash_received,
          ),

    changeDue:
      row.change_due ===
      null
        ? undefined
        : Number(
            row.change_due,
          ),

    createdAt:
      row.created_at,

    wasExisting:
      Boolean(
        row.was_existing,
      ),
  };
}