"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  ReceiptItem,
  ReceiptPayment,
  ReceiptSettings,
  SaleReceipt,
} from "@/lib/domain/receipts";

import type {
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
} from "@/lib/domain/sales";


/* ============================================================
   REFUND-AWARE RECEIPT TYPES
============================================================ */

export type ReceiptRefundItemSummary = {
  id: string;

  refundId: string;

  saleItemId: string;

  productName: string;

  variantName: string;

  sku: string;

  quantity: number;

  unitRefundAmount: number;

  lineRefundTotal: number;

  restocked: boolean;

  createdAt: string;
};


export type ReceiptRefundSummary = {
  id: string;

  refundNumber: string;

  method: PaymentMethod;

  amount: number;

  reason: string;

  note: string;

  createdAt: string;

  items:
    ReceiptRefundItemSummary[];
};


export type ReceiptVoidSummary = {
  id: string;

  reason: string;

  note: string;

  createdAt: string;
};


export type RefundAwareSaleReceipt =
  SaleReceipt & {
    refunds:
      ReceiptRefundSummary[];

    refundedTotal: number;

    refundedItemQuantity: number;

    netTotal: number;

    void:
      ReceiptVoidSummary | null;
  };


/* ============================================================
   DATABASE ROW TYPES
============================================================ */

type SaleRow = {
  id: string;

  business_id: string;

  receipt_number: string;

  receipt_sequence:
    | number
    | string;

  currency_code: string;

  status:
    SaleStatus;

  cashier_label:
    | string
    | null;

  customer_name:
    | string
    | null;

  customer_email:
    | string
    | null;

  customer_phone:
    | string
    | null;

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

  note:
    | string
    | null;

  created_at: string;
};


type ItemRow = {
  id: string;

  product_name: string;

  variant_name: string;

  sku: string;

  quantity:
    | number
    | string;

  unit_price:
    | number
    | string;

  line_subtotal:
    | number
    | string;

  discount_total:
    | number
    | string;

  tax_total:
    | number
    | string;

  line_total:
    | number
    | string;
};


type PaymentRow = {
  id: string;

  method:
    PaymentMethod;

  status:
    PaymentStatus;

  amount:
    | number
    | string;

  reference_number:
    | string
    | null;

  cash_received:
    | number
    | string
    | null;

  change_due:
    | number
    | string
    | null;
};


type SettingsRow = {
  paper_width:
    "58mm"
    | "80mm";

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
    string;

  show_sku:
    boolean;

  show_cashier:
    boolean;

  show_customer:
    boolean;
};


type RefundRow = {
  id: string;

  refund_number: string;

  refund_method:
    PaymentMethod;

  amount:
    | number
    | string;

  reason: string;

  note: string;

  created_at: string;
};


type RefundItemRow = {
  id: string;

  refund_id: string;

  sale_item_id: string;

  product_name: string;

  variant_name: string;

  sku: string;

  quantity:
    | number
    | string;

  unit_refund_amount:
    | number
    | string;

  line_refund_total:
    | number
    | string;

  restocked: boolean;

  created_at: string;
};


type VoidRow = {
  id: string;

  reason: string;

  note: string;

  created_at: string;
};


/* ============================================================
   DEFAULT RECEIPT SETTINGS
============================================================ */

const DEFAULT_SETTINGS:
  ReceiptSettings = {
    paperWidth:
      "80mm",

    autoPrint:
      false,

    footerMessage:
      "Thank you for shopping with us!",

    showSku:
      true,

    showCashier:
      true,

    showCustomer:
      true,
  };


/* ============================================================
   NUMBER HELPER
============================================================ */

function numberValue(
  value: unknown,
) {
  const result =
    Number(
      value ??
      0,
    );


  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}


/* ============================================================
   FETCH RECEIPT
============================================================ */

export async function fetchSaleReceipt(
  saleId: string,
): Promise<SaleReceipt> {
  const supabase =
    createClient();


  /* ==========================================================
     SALE
  ========================================================== */

  const {
    data:
      saleData,
    error:
      saleError,
  } =
    await supabase
      .from(
        "sales",
      )
      .select(
        `
        id,
        business_id,
        receipt_number,
        receipt_sequence,
        currency_code,
        status,
        cashier_label,
        customer_name,
        customer_email,
        customer_phone,
        subtotal,
        discount_total,
        tax_total,
        total,
        item_quantity_total,
        note,
        created_at
        `,
      )
      .eq(
        "id",
        saleId,
      )
      .single();


  if (
    saleError
  ) {
    throw new Error(
      saleError.message,
    );
  }


  if (
    !saleData
  ) {
    throw new Error(
      "Receipt sale could not be found.",
    );
  }


  const sale =
    saleData as
      SaleRow;


  /* ==========================================================
     RELATED DATA
  ========================================================== */

  const [
    itemsResult,
    paymentsResult,
    settingsResult,
    refundsResult,
    refundItemsResult,
    voidResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "sale_items",
        )
        .select(
          `
          id,
          product_name,
          variant_name,
          sku,
          quantity,
          unit_price,
          line_subtotal,
          discount_total,
          tax_total,
          line_total
          `,
        )
        .eq(
          "sale_id",
          saleId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),


      supabase
        .from(
          "payments",
        )
        .select(
          `
          id,
          method,
          status,
          amount,
          reference_number,
          cash_received,
          change_due
          `,
        )
        .eq(
          "sale_id",
          saleId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),


      supabase
        .from(
          "receipt_settings",
        )
        .select(
          `
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
          `,
        )
        .eq(
          "business_id",
          sale.business_id,
        )
        .maybeSingle(),


      supabase
        .from(
          "sale_refunds",
        )
        .select(
          `
          id,
          refund_number,
          refund_method,
          amount,
          reason,
          note,
          created_at
          `,
        )
        .eq(
          "sale_id",
          saleId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),


      supabase
        .from(
          "sale_refund_items",
        )
        .select(
          `
          id,
          refund_id,
          sale_item_id,
          product_name,
          variant_name,
          sku,
          quantity,
          unit_refund_amount,
          line_refund_total,
          restocked,
          created_at
          `,
        )
        .eq(
          "sale_id",
          saleId,
        )
        .order(
          "created_at",
          {
            ascending:
              true,
          },
        ),


      supabase
        .from(
          "sale_voids",
        )
        .select(
          `
          id,
          reason,
          note,
          created_at
          `,
        )
        .eq(
          "sale_id",
          saleId,
        )
        .maybeSingle(),
    ]);


  /* ==========================================================
     ERRORS
  ========================================================== */

  if (
    itemsResult.error
  ) {
    throw new Error(
      itemsResult.error.message,
    );
  }


  if (
    paymentsResult.error
  ) {
    throw new Error(
      paymentsResult.error.message,
    );
  }


  if (
    settingsResult.error
  ) {
    throw new Error(
      settingsResult.error.message,
    );
  }


  if (
    refundsResult.error
  ) {
    throw new Error(
      refundsResult.error.message,
    );
  }


  if (
    refundItemsResult.error
  ) {
    throw new Error(
      refundItemsResult.error.message,
    );
  }


  if (
    voidResult.error
  ) {
    throw new Error(
      voidResult.error.message,
    );
  }


  /* ==========================================================
     ROWS
  ========================================================== */

  const items =
    (
      itemsResult.data ??
      []
    ) as ItemRow[];


  const payments =
    (
      paymentsResult.data ??
      []
    ) as PaymentRow[];


  const refundRows =
    (
      refundsResult.data ??
      []
    ) as RefundRow[];


  const refundItemRows =
    (
      refundItemsResult.data ??
      []
    ) as RefundItemRow[];


  const settingsRow =
    settingsResult.data as
      | SettingsRow
      | null;


  const voidRow =
    voidResult.data as
      | VoidRow
      | null;


  /* ==========================================================
     SETTINGS
  ========================================================== */

  const settings:
    ReceiptSettings =
      settingsRow
        ? {
            paperWidth:
              settingsRow.paper_width,

            autoPrint:
              settingsRow.auto_print,

            displayName:
              settingsRow.display_name ??
              undefined,

            addressLine1:
              settingsRow.address_line_1 ??
              undefined,

            addressLine2:
              settingsRow.address_line_2 ??
              undefined,

            phone:
              settingsRow.phone ??
              undefined,

            email:
              settingsRow.email ??
              undefined,

            taxRegistrationNumber:
              settingsRow.tax_registration_number ??
              undefined,

            footerMessage:
              settingsRow.footer_message,

            showSku:
              settingsRow.show_sku,

            showCashier:
              settingsRow.show_cashier,

            showCustomer:
              settingsRow.show_customer,
          }
        : DEFAULT_SETTINGS;


  /* ==========================================================
     ITEMS
  ========================================================== */

  const receiptItems:
    ReceiptItem[] =
      items.map(
        (item) => ({
          id:
            item.id,

          productName:
            item.product_name,

          variantName:
            item.variant_name,

          sku:
            item.sku,

          quantity:
            numberValue(
              item.quantity,
            ),

          unitPrice:
            numberValue(
              item.unit_price,
            ),

          lineSubtotal:
            numberValue(
              item.line_subtotal,
            ),

          discountTotal:
            numberValue(
              item.discount_total,
            ),

          taxTotal:
            numberValue(
              item.tax_total,
            ),

          lineTotal:
            numberValue(
              item.line_total,
            ),
        }),
      );


  /* ==========================================================
     PAYMENTS
  ========================================================== */

  const receiptPayments:
    ReceiptPayment[] =
      payments.map(
        (payment) => ({
          id:
            payment.id,

          method:
            payment.method,

          status:
            payment.status,

          amount:
            numberValue(
              payment.amount,
            ),

          referenceNumber:
            payment.reference_number ??
            undefined,

          cashReceived:
            payment.cash_received ===
            null
              ? undefined
              : numberValue(
                  payment.cash_received,
                ),

          changeDue:
            payment.change_due ===
            null
              ? undefined
              : numberValue(
                  payment.change_due,
                ),
        }),
      );


  /* ==========================================================
     REFUND ITEMS
  ========================================================== */

  const receiptRefundItems:
    ReceiptRefundItemSummary[] =
      refundItemRows.map(
        (item) => ({
          id:
            item.id,

          refundId:
            item.refund_id,

          saleItemId:
            item.sale_item_id,

          productName:
            item.product_name,

          variantName:
            item.variant_name,

          sku:
            item.sku,

          quantity:
            numberValue(
              item.quantity,
            ),

          unitRefundAmount:
            numberValue(
              item.unit_refund_amount,
            ),

          lineRefundTotal:
            numberValue(
              item.line_refund_total,
            ),

          restocked:
            item.restocked,

          createdAt:
            item.created_at,
        }),
      );


  /* ==========================================================
     REFUNDS
  ========================================================== */

  const refunds:
    ReceiptRefundSummary[] =
      refundRows.map(
        (refund) => ({
          id:
            refund.id,

          refundNumber:
            refund.refund_number,

          method:
            refund.refund_method,

          amount:
            numberValue(
              refund.amount,
            ),

          reason:
            refund.reason,

          note:
            refund.note,

          createdAt:
            refund.created_at,

          items:
            receiptRefundItems.filter(
              (item) =>
                item.refundId ===
                refund.id,
            ),
        }),
      );


  const refundedTotal =
    refunds.reduce(
      (
        total,
        refund,
      ) =>
        total +
        refund.amount,
      0,
    );


  const refundedItemQuantity =
    receiptRefundItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.quantity,
      0,
    );


  const originalTotal =
    numberValue(
      sale.total,
    );


  const netTotal =
    sale.status ===
    "voided"
      ? 0
      : Math.max(
          0,
          originalTotal -
            refundedTotal,
        );


  /* ==========================================================
     VOID
  ========================================================== */

  const saleVoid:
    ReceiptVoidSummary | null =
      voidRow
        ? {
            id:
              voidRow.id,

            reason:
              voidRow.reason,

            note:
              voidRow.note,

            createdAt:
              voidRow.created_at,
          }
        : null;


  /* ==========================================================
     FINAL RECEIPT
  ========================================================== */

  const receipt:
    RefundAwareSaleReceipt = {
      saleId:
        sale.id,

      businessId:
        sale.business_id,

      receiptNumber:
        sale.receipt_number,

      receiptSequence:
        numberValue(
          sale.receipt_sequence,
        ),

      currencyCode:
        sale.currency_code,

      status:
        sale.status,

      cashierLabel:
        sale.cashier_label ??
        undefined,

      customerName:
        sale.customer_name ??
        undefined,

      customerEmail:
        sale.customer_email ??
        undefined,

      customerPhone:
        sale.customer_phone ??
        undefined,

      subtotal:
        numberValue(
          sale.subtotal,
        ),

      discountTotal:
        numberValue(
          sale.discount_total,
        ),

      taxTotal:
        numberValue(
          sale.tax_total,
        ),

      total:
        originalTotal,

      itemQuantityTotal:
        numberValue(
          sale.item_quantity_total,
        ),

      note:
        sale.note ??
        "",

      createdAt:
        sale.created_at,

      items:
        receiptItems,

      payments:
        receiptPayments,

      settings,

      refunds,

      refundedTotal,

      refundedItemQuantity,

      netTotal,

      void:
        saleVoid,
    };


  return receipt;
}