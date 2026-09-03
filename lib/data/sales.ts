    "use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  PaymentMethod,
  SaleListItem,
  SaleStatus,
} from "@/lib/domain/sales";

type SalesListRow = {
  id: string;

  business_id: string;

  receipt_number: string;

  receipt_sequence:
    | number
    | string;

  created_at: string;

  customer_name:
    | string
    | null;

  customer_email:
    | string
    | null;

  customer_phone:
    | string
    | null;

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

  line_count:
    | number
    | string;

  payment_methods:
    | string
    | null;

  status: SaleStatus;

  cashier_user_id:
    | string
    | null;
};

function parsePaymentMethods(
  value:
    | string
    | null,
): PaymentMethod[] {
  if (!value) {
    return [];
  }

  const allowed =
    new Set<PaymentMethod>([
      "cash",
      "card",
      "bank_transfer",
      "other",
    ]);

  return value
    .split(",")
    .map((item) =>
      item.trim(),
    )
    .filter(
      (
        item,
      ): item is PaymentMethod =>
        allowed.has(
          item as PaymentMethod,
        ),
    );
}

export async function fetchSalesList(): Promise<
  SaleListItem[]
> {
  const supabase =
    createClient();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "sales_list",
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
      .limit(500);

  if (error) {
    console.error(
      "NOVA sales query failed:",
      error,
    );

    throw error;
  }

  const rows =
    (data ?? []) as
      SalesListRow[];

  return rows.map(
    (row) => ({
      id:
        row.id,

      businessId:
        row.business_id,

      receiptNumber:
        row.receipt_number,

      receiptSequence:
        Number(
          row.receipt_sequence,
        ),

      createdAt:
        row.created_at,

      customerName:
        row.customer_name ??
        undefined,

      customerEmail:
        row.customer_email ??
        undefined,

      customerPhone:
        row.customer_phone ??
        undefined,

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

      lineCount:
        Number(
          row.line_count,
        ),

      paymentMethods:
        parsePaymentMethods(
          row.payment_methods,
        ),

      status:
        row.status,

      cashierUserId:
        row.cashier_user_id ??
        undefined,
    }),
  );
}