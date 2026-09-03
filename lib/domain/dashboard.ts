import type {
  SaleStatus,
} from "@/lib/domain/sales";


export type DashboardRangePreset =
  | "today"
  | "7d"
  | "30d";


export type DashboardDateRange = {
  startDate: string;

  endDate: string;
};


export type DashboardSummary = {
  grossRevenue: number;

  refundAmount: number;

  revenue: number;

  transactions: number;

  refunds: number;

  itemsSold: number;

  averageSale: number;

  cogs: number;

  grossProfit: number;
};


export type DashboardDailySale = {
  date: string;

  revenue: number;

  transactions: number;

  itemsSold: number;
};


export type DashboardPayment = {
  method: string;

  amount: number;

  transactions: number;
};


export type DashboardTopProduct = {
  productId:
    | string
    | null;

  name: string;

  quantity: number;

  revenue: number;
};


export type DashboardLowStock = {
  productId: string;

  variantId: string;

  productName: string;

  variantName: string;

  sku: string;

  stock: number;

  threshold: number;
};


export type DashboardRecentSale = {
  id: string;

  receiptNumber: string;

  createdAt: string;

  customerName:
    | string
    | null;

  total: number;

  refundAmount: number;

  netTotal: number;

  currencyCode: string;

  status: SaleStatus;

  itemQuantityTotal: number;
};


export type DashboardReport = {
  businessId: string;

  timezone: string;

  startDate: string;

  endDate: string;

  summary:
    DashboardSummary;

  dailySales:
    DashboardDailySale[];

  paymentBreakdown:
    DashboardPayment[];

  topProducts:
    DashboardTopProduct[];

  lowStock:
    DashboardLowStock[];

  recentSales:
    DashboardRecentSale[];
};


function formatLocalDate(
  date: Date,
) {
  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );


  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );


  return `${year}-${month}-${day}`;
}


export function dashboardRange(
  preset:
    DashboardRangePreset,
): DashboardDateRange {
  const today =
    new Date();


  const start =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );


  const end =
    new Date(
      start,
    );


  if (
    preset ===
    "7d"
  ) {
    start.setDate(
      start.getDate() -
        6,
    );
  }


  if (
    preset ===
    "30d"
  ) {
    start.setDate(
      start.getDate() -
        29,
    );
  }


  return {
    startDate:
      formatLocalDate(
        start,
      ),

    endDate:
      formatLocalDate(
        end,
      ),
  };
}