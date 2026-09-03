import type {
  PaymentMethod,
  SaleStatus,
} from "@/lib/domain/sales";


export type RefundRequestItem = {
  saleItemId: string;

  quantity: number;

  restock: boolean;
};


export type RefundSaleRequest = {
  businessId: string;

  saleId: string;

  items:
    RefundRequestItem[];

  refundMethod:
    PaymentMethod;

  reason: string;

  note: string;
};


export type RefundSaleResult = {
  refundId: string;

  refundNumber: string;

  saleId: string;

  amount: number;

  saleStatus:
    SaleStatus;
};


export type VoidSaleRequest = {
  businessId: string;

  saleId: string;

  reason: string;

  note: string;
};


export type VoidSaleResult = {
  saleId: string;

  receiptNumber: string;

  saleStatus:
    "voided";

  restoredQuantity: number;
};


export type SaleRefund = {
  id: string;

  businessId: string;

  saleId: string;

  refundSequence: number;

  refundNumber: string;

  refundMethod:
    PaymentMethod;

  amount: number;

  reason: string;

  note: string;

  actorUserId:
    | string
    | null;

  createdAt: string;
};


export type SaleRefundItem = {
  id: string;

  businessId: string;

  refundId: string;

  saleId: string;

  saleItemId: string;

  productId:
    | string
    | null;

  variantId:
    | string
    | null;

  productName: string;

  variantName: string;

  sku: string;

  quantity: number;

  unitRefundAmount: number;

  lineRefundTotal: number;

  restocked: boolean;

  createdAt: string;
};


export type SaleVoid = {
  id: string;

  businessId: string;

  saleId: string;

  reason: string;

  note: string;

  actorUserId:
    | string
    | null;

  createdAt: string;
};