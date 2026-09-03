import type {
  PaymentMethod,
} from "@/lib/domain/sales";


export type ExpenseCategory =
  | "rent"
  | "utilities"
  | "salaries"
  | "supplies"
  | "transport"
  | "marketing"
  | "maintenance"
  | "equipment"
  | "fees"
  | "other";


export type Expense = {
  id: string;

  businessId: string;

  expenseDate: string;

  category:
    ExpenseCategory;

  title: string;

  vendor:
    string | null;

  amount: number;

  paymentMethod:
    PaymentMethod;

  referenceNumber:
    string | null;

  note: string;

  createdByUserId:
    string | null;

  createdAt: string;

  updatedAt: string;
};


export type SaveExpenseInput = {
  id?:
    string;

  businessId:
    string;

  expenseDate:
    string;

  category:
    ExpenseCategory;

  title:
    string;

  vendor?:
    string;

  amount:
    number;

  paymentMethod:
    PaymentMethod;

  referenceNumber?:
    string;

  note?:
    string;
};


export type ExpenseCategorySummary = {
  category:
    ExpenseCategory;

  amount:
    number;

  count:
    number;
};


export type ExpenseDailySummary = {
  date:
    string;

  amount:
    number;

  count:
    number;
};


export type ExpenseReport = {
  businessId:
    string;

  startDate:
    string;

  endDate:
    string;

  summary: {
    total:
      number;

    count:
      number;

    average:
      number;
  };

  categoryBreakdown:
    ExpenseCategorySummary[];

  dailyExpenses:
    ExpenseDailySummary[];

  recentExpenses:
    Expense[];
};


export const EXPENSE_CATEGORIES: {
  value:
    ExpenseCategory;

  label:
    string;
}[] = [
  {
    value:
      "rent",

    label:
      "Rent",
  },

  {
    value:
      "utilities",

    label:
      "Utilities",
  },

  {
    value:
      "salaries",

    label:
      "Salaries",
  },

  {
    value:
      "supplies",

    label:
      "Supplies",
  },

  {
    value:
      "transport",

    label:
      "Transport",
  },

  {
    value:
      "marketing",

    label:
      "Marketing",
  },

  {
    value:
      "maintenance",

    label:
      "Maintenance",
  },

  {
    value:
      "equipment",

    label:
      "Equipment",
  },

  {
    value:
      "fees",

    label:
      "Bank / Service Fees",
  },

  {
    value:
      "other",

    label:
      "Other",
  },
];


export function expenseCategoryLabel(
  category:
    ExpenseCategory,
) {
  return (
    EXPENSE_CATEGORIES.find(
      (item) =>
        item.value ===
        category,
    )?.label ??
    "Other"
  );
}