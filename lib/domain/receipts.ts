import type {
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
} from "@/lib/domain/sales";

export type ReceiptPaperWidth =
  | "58mm"
  | "80mm";

export type ReceiptSettings = {
  paperWidth: ReceiptPaperWidth;

  autoPrint: boolean;

  displayName?: string;

  addressLine1?: string;

  addressLine2?: string;

  phone?: string;

  email?: string;

  taxRegistrationNumber?: string;

  footerMessage: string;

  showSku: boolean;

  showCashier: boolean;

  showCustomer: boolean;
};

export type ReceiptItem = {
  id: string;

  productName: string;

  variantName: string;

  sku: string;

  quantity: number;

  unitPrice: number;

  lineSubtotal: number;

  discountTotal: number;

  taxTotal: number;

  lineTotal: number;
};

export type ReceiptPayment = {
  id: string;

  method: PaymentMethod;

  status: PaymentStatus;

  amount: number;

  referenceNumber?: string;

  cashReceived?: number;

  changeDue?: number;
};

export type SaleReceipt = {
  saleId: string;

  businessId: string;

  receiptNumber: string;

  receiptSequence: number;

  currencyCode: string;

  status: SaleStatus;

  cashierLabel?: string;

  customerName?: string;

  customerEmail?: string;

  customerPhone?: string;

  subtotal: number;

  discountTotal: number;

  taxTotal: number;

  total: number;

  itemQuantityTotal: number;

  note: string;

  createdAt: string;

  items: ReceiptItem[];

  payments: ReceiptPayment[];

  settings: ReceiptSettings;
};