"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  SaleDetail,
  SaleDetailItem,
  SaleDetailPayment,
  SaleInventoryMovement,
} from "@/lib/domain/sale-detail";


/* ============================================================
   DATABASE ROW TYPES
============================================================ */

type SaleRow = {
  id: string;

  business_id: string;

  location_id: string;

  receipt_number: string;

  receipt_sequence:
    number | string;

  currency_code: string;

  status:
    | "completed"
    | "partially_refunded"
    | "refunded"
    | "voided";

  cashier_user_id:
    | string
    | null;

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
    number | string;

  discount_total:
    number | string;

  tax_total:
    number | string;

  total:
    number | string;

  item_quantity_total:
    number | string;

  note: string;

  created_at: string;

  updated_at: string;
};


type ItemRow = {
  id: string;

  product_id:
    | string
    | null;

  variant_id:
    | string
    | null;

  product_name: string;

  variant_name: string;

  sku: string;

  quantity:
    number | string;

  unit_price:
    number | string;

  unit_cost:
    number | string;

  line_subtotal:
    number | string;

  discount_total:
    number | string;

  tax_total:
    number | string;

  line_total:
    number | string;

  created_at: string;
};


type PaymentRow = {
  id: string;

  method:
    | "cash"
    | "card"
    | "bank_transfer"
    | "other";

  status:
    | "completed"
    | "partially_refunded"
    | "refunded"
    | "voided";

  amount:
    number | string;

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

  received_by_user_id:
    | string
    | null;

  created_at: string;
};


type MovementRow = {
  id: string;

  location_id: string;

  variant_id: string;

  movement_type: string;

  quantity_delta:
    number | string;

  quantity_before:
    number | string;

  quantity_after:
    number | string;

  reason: string;

  note: string;

  reference_type:
    | string
    | null;

  reference_id:
    | string
    | null;

  actor_user_id:
    | string
    | null;

  created_at: string;
};


type RefundIdRow = {
  id: string;
};


/* ============================================================
   NUMBER HELPER
============================================================ */

function numberValue(
  value: unknown,
) {
  const result =
    Number(
      value ?? 0,
    );


  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}


/* ============================================================
   MAP INVENTORY MOVEMENT
============================================================ */

function mapMovement(
  row: MovementRow,
): SaleInventoryMovement {
  return {
    id:
      row.id,

    locationId:
      row.location_id,

    variantId:
      row.variant_id,

    movementType:
      row.movement_type,

    quantityDelta:
      numberValue(
        row.quantity_delta,
      ),

    quantityBefore:
      numberValue(
        row.quantity_before,
      ),

    quantityAfter:
      numberValue(
        row.quantity_after,
      ),

    reason:
      row.reason,

    note:
      row.note,

    /*
     * SaleInventoryMovement uses optional strings,
     * not string | null.
     */

    referenceType:
      row.reference_type ??
      undefined,

    referenceId:
      row.reference_id ??
      undefined,

    actorUserId:
      row.actor_user_id ??
      undefined,

    createdAt:
      row.created_at,
  };
}


/* ============================================================
   FETCH SALE DETAIL
============================================================ */

export async function fetchSaleDetail(
  saleId: string,
): Promise<SaleDetail> {
  const supabase =
    createClient();


  /* ==========================================================
     SALE HEADER
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
        location_id,
        receipt_number,
        receipt_sequence,
        currency_code,
        status,
        cashier_user_id,
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
        created_at,
        updated_at
        `,
      )
      .eq(
        "id",
        saleId,
      )
      .single();


  if (saleError) {
    throw new Error(
      saleError.message,
    );
  }


  if (!saleData) {
    throw new Error(
      "Sale could not be found.",
    );
  }


  const saleRow =
    saleData as SaleRow;


  /* ==========================================================
     ITEMS + PAYMENTS + REFUND IDS
  ========================================================== */

  const [
    itemsResult,
    paymentsResult,
    refundsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "sale_items",
        )
        .select(
          `
          id,
          product_id,
          variant_id,
          product_name,
          variant_name,
          sku,
          quantity,
          unit_price,
          unit_cost,
          line_subtotal,
          discount_total,
          tax_total,
          line_total,
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
          change_due,
          received_by_user_id,
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
          "sale_refunds",
        )
        .select(
          "id",
        )
        .eq(
          "sale_id",
          saleId,
        ),
    ]);


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
    refundsResult.error
  ) {
    throw new Error(
      refundsResult.error.message,
    );
  }


  const refundRows =
    (
      itemsResult.data
        ? refundsResult.data ?? []
        : []
    ) as RefundIdRow[];


  const refundIds =
    refundRows
      .map(
        (row) =>
          row.id,
      )
      .filter(
        Boolean,
      );


  /* ==========================================================
     ORIGINAL SALE MOVEMENTS
  ========================================================== */

  const saleMovementsResult =
    await supabase
      .from(
        "inventory_movements",
      )
      .select(
        `
        id,
        location_id,
        variant_id,
        movement_type,
        quantity_delta,
        quantity_before,
        quantity_after,
        reason,
        note,
        reference_type,
        reference_id,
        actor_user_id,
        created_at
        `,
      )
      .eq(
        "reference_type",
        "sale",
      )
      .eq(
        "reference_id",
        saleId,
      );


  if (
    saleMovementsResult.error
  ) {
    throw new Error(
      saleMovementsResult
        .error.message,
    );
  }


  /* ==========================================================
     VOID MOVEMENTS
  ========================================================== */

  const voidMovementsResult =
    await supabase
      .from(
        "inventory_movements",
      )
      .select(
        `
        id,
        location_id,
        variant_id,
        movement_type,
        quantity_delta,
        quantity_before,
        quantity_after,
        reason,
        note,
        reference_type,
        reference_id,
        actor_user_id,
        created_at
        `,
      )
      .eq(
        "reference_type",
        "sale_void",
      )
      .eq(
        "reference_id",
        saleId,
      );


  if (
    voidMovementsResult.error
  ) {
    throw new Error(
      voidMovementsResult
        .error.message,
    );
  }


  /* ==========================================================
     REFUND MOVEMENTS
  ========================================================== */

  let refundMovementRows:
    MovementRow[] = [];


  if (
    refundIds.length >
    0
  ) {
    const refundMovementsResult =
      await supabase
        .from(
          "inventory_movements",
        )
        .select(
          `
          id,
          location_id,
          variant_id,
          movement_type,
          quantity_delta,
          quantity_before,
          quantity_after,
          reason,
          note,
          reference_type,
          reference_id,
          actor_user_id,
          created_at
          `,
        )
        .eq(
          "reference_type",
          "refund",
        )
        .in(
          "reference_id",
          refundIds,
        );


    if (
      refundMovementsResult.error
    ) {
      throw new Error(
        refundMovementsResult
          .error.message,
      );
    }


    refundMovementRows =
      (
        refundMovementsResult.data ??
        []
      ) as MovementRow[];
  }


  /* ==========================================================
     MAP ITEMS
  ========================================================== */

  const itemRows =
    (
      itemsResult.data ??
      []
    ) as ItemRow[];


  const items:
    SaleDetailItem[] =
      itemRows.map(
        (
          row:
            ItemRow,
        ) => ({
          id:
            row.id,

          productId:
            row.product_id ??
            undefined,

          variantId:
            row.variant_id ??
            undefined,

          productName:
            row.product_name,

          variantName:
            row.variant_name,

          sku:
            row.sku,

          quantity:
            numberValue(
              row.quantity,
            ),

          unitPrice:
            numberValue(
              row.unit_price,
            ),

          unitCost:
            numberValue(
              row.unit_cost,
            ),

          lineSubtotal:
            numberValue(
              row.line_subtotal,
            ),

          discountTotal:
            numberValue(
              row.discount_total,
            ),

          taxTotal:
            numberValue(
              row.tax_total,
            ),

          lineTotal:
            numberValue(
              row.line_total,
            ),

          createdAt:
            row.created_at,
        }),
      );


  /* ==========================================================
     MAP PAYMENTS
  ========================================================== */

  const paymentRows =
    (
      paymentsResult.data ??
      []
    ) as PaymentRow[];


  const payments:
    SaleDetailPayment[] =
      paymentRows.map(
        (
          row:
            PaymentRow,
        ) => ({
          id:
            row.id,

          method:
            row.method,

          status:
            row.status,

          amount:
            numberValue(
              row.amount,
            ),

          referenceNumber:
            row.reference_number ??
            undefined,

          cashReceived:
            row.cash_received ===
            null
              ? undefined
              : numberValue(
                  row.cash_received,
                ),

          changeDue:
            row.change_due ===
            null
              ? undefined
              : numberValue(
                  row.change_due,
                ),

          receivedByUserId:
            row.received_by_user_id ??
            undefined,

          createdAt:
            row.created_at,
        }),
      );


  /* ==========================================================
     MAP INVENTORY MOVEMENTS
  ========================================================== */

  const saleMovementRows =
    (
      saleMovementsResult.data ??
      []
    ) as MovementRow[];


  const voidMovementRows =
    (
      voidMovementsResult.data ??
      []
    ) as MovementRow[];


  const allMovementRows:
    MovementRow[] = [
      ...saleMovementRows,
      ...refundMovementRows,
      ...voidMovementRows,
    ];


  const inventoryMovements:
    SaleInventoryMovement[] =
      allMovementRows
        .map(
          (
            row:
              MovementRow,
          ) =>
            mapMovement(
              row,
            ),
        )
        .sort(
          (
            first,
            second,
          ) =>
            new Date(
              first.createdAt,
            ).getTime() -
            new Date(
              second.createdAt,
            ).getTime(),
        );


  /* ==========================================================
     FINAL SALE DETAIL
  ========================================================== */

  return {
    id:
      saleRow.id,

    businessId:
      saleRow.business_id,

    locationId:
      saleRow.location_id,

    receiptNumber:
      saleRow.receipt_number,

    receiptSequence:
      numberValue(
        saleRow.receipt_sequence,
      ),

    currencyCode:
      saleRow.currency_code,

    status:
      saleRow.status,

    /*
     * Existing domain uses optional values.
     */

    cashierUserId:
      saleRow.cashier_user_id ??
      undefined,

    cashierLabel:
      saleRow.cashier_label ??
      undefined,

    customerName:
      saleRow.customer_name ??
      undefined,

    customerEmail:
      saleRow.customer_email ??
      undefined,

    customerPhone:
      saleRow.customer_phone ??
      undefined,

    subtotal:
      numberValue(
        saleRow.subtotal,
      ),

    discountTotal:
      numberValue(
        saleRow.discount_total,
      ),

    taxTotal:
      numberValue(
        saleRow.tax_total,
      ),

    total:
      numberValue(
        saleRow.total,
      ),

    itemQuantityTotal:
      numberValue(
        saleRow.item_quantity_total,
      ),

    note:
      saleRow.note,

    createdAt:
      saleRow.created_at,

    updatedAt:
      saleRow.updated_at,

    items,

    payments,

    inventoryMovements,
  };
}