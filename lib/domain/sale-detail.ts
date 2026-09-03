import type {
  PaymentMethod,
  PaymentStatus,
  SaleStatus,
} from "@/lib/domain/sales";

export type SaleDetailItem = {
  id: string;

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

export type SaleDetailPayment = {
  id: string;

  method: PaymentMethod;

  status: PaymentStatus;

  amount: number;

  referenceNumber?: string;

  cashReceived?: number;

  changeDue?: number;

  receivedByUserId?: string;

  createdAt: string;
};

export type SaleInventoryMovement = {
  id: string;

  locationId: string;

  variantId: string;

  movementType: string;

  quantityDelta: number;

  quantityBefore: number;

  quantityAfter: number;

  reason: string;

  note: string;

  referenceType?: string;

  referenceId?: string;

  actorUserId?: string;

  createdAt: string;
};

export type SaleDetail = {
  id: string;

  businessId: string;

  locationId: string;

  receiptNumber: string;

  receiptSequence: number;

  currencyCode: string;

  status: SaleStatus;

  cashierUserId?: string;

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

  updatedAt: string;

  items: SaleDetailItem[];

  payments: SaleDetailPayment[];

  inventoryMovements: SaleInventoryMovement[];
};