"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  RefundSaleRequest,
  RefundSaleResult,
  SaleRefund,
  SaleRefundItem,
  SaleVoid,
  VoidSaleRequest,
  VoidSaleResult,
} from "@/lib/domain/refunds";


type RefundRow = {
  id: string;

  business_id: string;

  sale_id: string;

  refund_sequence: number | string;

  refund_number: string;

  refund_method:
    "cash"
    | "card"
    | "bank_transfer"
    | "other";

  amount:
    number | string;

  reason: string;

  note: string;

  actor_user_id:
    | string
    | null;

  created_at: string;
};


type RefundItemRow = {
  id: string;

  business_id: string;

  refund_id: string;

  sale_id: string;

  sale_item_id: string;

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

  unit_refund_amount:
    number | string;

  line_refund_total:
    number | string;

  restocked: boolean;

  created_at: string;
};


type VoidRow = {
  id: string;

  business_id: string;

  sale_id: string;

  reason: string;

  note: string;

  actor_user_id:
    | string
    | null;

  created_at: string;
};


function numberValue(
  value:
    unknown,
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
   COMPLETE REFUND
============================================================ */

export async function refundSale(
  request:
    RefundSaleRequest,
): Promise<RefundSaleResult> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "refund_sale",
      {
        p_business_id:
          request.businessId,

        p_sale_id:
          request.saleId,

        p_items:
          request.items.map(
            (item) => ({
              saleItemId:
                item.saleItemId,

              quantity:
                item.quantity,

              restock:
                item.restock,
            }),
          ),

        p_refund_method:
          request.refundMethod,

        p_reason:
          request.reason,

        p_note:
          request.note,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const row =
    data as {
      refundId:
        string;

      refundNumber:
        string;

      saleId:
        string;

      amount:
        number | string;

      saleStatus:
        "partially_refunded"
        | "refunded";
    };


  return {
    refundId:
      row.refundId,

    refundNumber:
      row.refundNumber,

    saleId:
      row.saleId,

    amount:
      numberValue(
        row.amount,
      ),

    saleStatus:
      row.saleStatus,
  };
}


/* ============================================================
   VOID SALE
============================================================ */

export async function voidSale(
  request:
    VoidSaleRequest,
): Promise<VoidSaleResult> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "void_sale",
      {
        p_business_id:
          request.businessId,

        p_sale_id:
          request.saleId,

        p_reason:
          request.reason,

        p_note:
          request.note,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const row =
    data as {
      saleId:
        string;

      receiptNumber:
        string;

      saleStatus:
        "voided";

      restoredQuantity:
        number | string;
    };


  return {
    saleId:
      row.saleId,

    receiptNumber:
      row.receiptNumber,

    saleStatus:
      row.saleStatus,

    restoredQuantity:
      numberValue(
        row.restoredQuantity,
      ),
  };
}


/* ============================================================
   REFUND HISTORY
============================================================ */

export async function fetchSaleRefunds(
  saleId:
    string,
): Promise<
  SaleRefund[]
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase

      .from(
        "sale_refunds",
      )

      .select(
        `
        id,
        business_id,
        sale_id,
        refund_sequence,
        refund_number,
        refund_method,
        amount,
        reason,
        note,
        actor_user_id,
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
            false,
        },
      );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    (
      data ??
      []
    ) as RefundRow[]
  ).map(
    (row) => ({
      id:
        row.id,

      businessId:
        row.business_id,

      saleId:
        row.sale_id,

      refundSequence:
        numberValue(
          row.refund_sequence,
        ),

      refundNumber:
        row.refund_number,

      refundMethod:
        row.refund_method,

      amount:
        numberValue(
          row.amount,
        ),

      reason:
        row.reason,

      note:
        row.note,

      actorUserId:
        row.actor_user_id,

      createdAt:
        row.created_at,
    }),
  );
}


/* ============================================================
   REFUND ITEMS
============================================================ */

export async function fetchSaleRefundItems(
  saleId:
    string,
): Promise<
  SaleRefundItem[]
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase

      .from(
        "sale_refund_items",
      )

      .select(
        `
        id,
        business_id,
        refund_id,
        sale_id,
        sale_item_id,
        product_id,
        variant_id,
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
      );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    (
      data ??
      []
    ) as RefundItemRow[]
  ).map(
    (row) => ({
      id:
        row.id,

      businessId:
        row.business_id,

      refundId:
        row.refund_id,

      saleId:
        row.sale_id,

      saleItemId:
        row.sale_item_id,

      productId:
        row.product_id,

      variantId:
        row.variant_id,

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

      unitRefundAmount:
        numberValue(
          row.unit_refund_amount,
        ),

      lineRefundTotal:
        numberValue(
          row.line_refund_total,
        ),

      restocked:
        row.restocked,

      createdAt:
        row.created_at,
    }),
  );
}


/* ============================================================
   VOID HISTORY
============================================================ */

export async function fetchSaleVoid(
  saleId:
    string,
): Promise<
  SaleVoid | null
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase

      .from(
        "sale_voids",
      )

      .select(
        `
        id,
        business_id,
        sale_id,
        reason,
        note,
        actor_user_id,
        created_at
        `,
      )

      .eq(
        "sale_id",
        saleId,
      )

      .maybeSingle();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  if (!data) {
    return null;
  }


  const row =
    data as VoidRow;


  return {
    id:
      row.id,

    businessId:
      row.business_id,

    saleId:
      row.sale_id,

    reason:
      row.reason,

    note:
      row.note,

    actorUserId:
      row.actor_user_id,

    createdAt:
      row.created_at,
  };
}