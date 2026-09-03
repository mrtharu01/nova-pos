import type {
  SaleStatus,
} from "@/lib/domain/sales";


export type LoyaltyTransactionType =
  | "earn"
  | "redeem"
  | "refund_reversal"
  | "manual_adjustment";


export type CustomerSummary = {
  id: string;

  name: string;

  phone: string;

  email:
    | string
    | null;

  defaultDiscountPercent:
    number;

  notes: string;

  isActive: boolean;

  loyaltyPoints: number;

  lifetimeSpend: number;

  visits: number;

  lastPurchaseAt:
    | string
    | null;

  createdAt: string;
};


export type CustomerSale = {
  id: string;

  receiptNumber: string;

  createdAt: string;

  status:
    SaleStatus;

  originalTotal: number;

  netTotal: number;

  currencyCode: string;
};


export type CustomerLoyaltyTransaction = {
  id: string;

  type:
    LoyaltyTransactionType;

  pointsDelta: number;

  monetaryValue: number;

  description: string;

  saleId:
    | string
    | null;

  refundId:
    | string
    | null;

  createdAt: string;
};


export type CustomerDetail = {
  customer: {
    id: string;

    name: string;

    phone: string;

    email:
      | string
      | null;

    defaultDiscountPercent:
      number;

    notes: string;

    isActive: boolean;

    createdAt: string;

    updatedAt: string;
  };

  loyaltyPoints: number;

  lifetimeSpend: number;

  visits: number;

  sales:
    CustomerSale[];

  loyaltyTransactions:
    CustomerLoyaltyTransaction[];
};


export type SaveCustomerInput = {
  businessId: string;

  customerId?:
    string | null;

  name: string;

  phone: string;

  email?:
    string;

  defaultDiscountPercent?:
    number;

  notes?:
    string;

  isActive?:
    boolean;
};