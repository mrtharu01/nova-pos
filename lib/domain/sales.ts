export type SaleStatus =
  | "completed"
  | "partially_refunded"
  | "refunded"
  | "voided";

export type PaymentMethod =
  | "cash"
  | "card"
  | "bank_transfer"
  | "other";

export type PaymentStatus =
  | "completed"
  | "partially_refunded"
  | "refunded"
  | "voided";

export type SaleListItem = {
  id: string;

  businessId: string;

  receiptNumber: string;

  receiptSequence: number;

  createdAt: string;

  customerName?: string;

  customerEmail?: string;

  customerPhone?: string;

  currencyCode: string;

  subtotal: number;

  discountTotal: number;

  taxTotal: number;

  total: number;

  itemQuantityTotal: number;

  lineCount: number;

  paymentMethods: PaymentMethod[];

  status: SaleStatus;

  cashierUserId?: string;
};

export type SaleItem = {
  id: string;

  saleId: string;

  productId?: string;

  variantId?: string;

  productName: string;

  variantName: string;

  sku: string;

  quantity: number;

  unitPrice: number;

  unitCost: number;

  lineSubtotal: number;

  discountTotal: number;

  taxTotal: number;

  lineTotal: number;

  createdAt: string;
};

export type SalePayment = {
  id: string;

  saleId: string;

  method: PaymentMethod;

  status: PaymentStatus;

  amount: number;

  referenceNumber?: string;

  cashReceived?: number;

  changeDue?: number;

  receivedByUserId?: string;

  createdAt: string;
};

export function formatSaleMoney(
  amount: number,
  currencyCode = "LKR",
) {
  return new Intl.NumberFormat(
    "en-LK",
    {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

export function saleStatusLabel(
  status: SaleStatus,
) {
  switch (status) {
    case "completed":
      return "Completed";

    case "partially_refunded":
      return "Partially Refunded";

    case "refunded":
      return "Refunded";

    case "voided":
      return "Voided";
  }
}

export function paymentMethodLabel(
  method: PaymentMethod,
) {
  switch (method) {
    case "cash":
      return "Cash";

    case "card":
      return "Card";

    case "bank_transfer":
      return "Bank Transfer";

    case "other":
      return "Other";
  }
}