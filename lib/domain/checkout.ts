import type {
  PaymentMethod,
} from "@/lib/domain/sales";

export type CheckoutItemInput = {
  variantId: string;
  quantity: number;
};

export type CompleteSaleInput = {
  businessId: string;

  checkoutKey: string;

  items: CheckoutItemInput[];

  paymentMethod: PaymentMethod;

  cashReceived?: number;

  referenceNumber?: string;

  discountTotal?: number;

  customerName?: string;

  customerEmail?: string;

  customerPhone?: string;

  note?: string;
};

export type CompleteSaleResult = {
  saleId: string;

  receiptNumber: string;

  receiptSequence: number;

  currencyCode: string;

  subtotal: number;

  discountTotal: number;

  taxTotal: number;

  total: number;

  itemQuantityTotal: number;

  paymentMethod: PaymentMethod;

  cashReceived?: number;

  changeDue?: number;

  createdAt: string;

  wasExisting: boolean;
};