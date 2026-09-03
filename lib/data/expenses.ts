"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  Expense,
  ExpenseCategory,
  ExpenseReport,
  SaveExpenseInput,
} from "@/lib/domain/expenses";

import type {
  PaymentMethod,
} from "@/lib/domain/sales";


type ExpenseRow = {
  id:
    string;

  business_id:
    string;

  expense_date:
    string;

  category:
    ExpenseCategory;

  title:
    string;

  vendor:
    string | null;

  amount:
    number | string;

  payment_method:
    PaymentMethod;

  reference_number:
    string | null;

  note:
    string;

  created_by_user_id:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


type UnknownRecord = {
  [key: string]:
    unknown;
};


function numberValue(
  value:
    unknown,
) {
  const number =
    Number(
      value ?? 0,
    );


  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}


function objectValue(
  value:
    unknown,
): UnknownRecord {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      UnknownRecord;
  }


  return {};
}


function arrayValue(
  value:
    unknown,
) {
  return Array.isArray(
    value,
  )
    ? value
    : [];
}


function mapExpense(
  row:
    ExpenseRow,
): Expense {
  return {
    id:
      row.id,

    businessId:
      row.business_id,

    expenseDate:
      row.expense_date,

    category:
      row.category,

    title:
      row.title,

    vendor:
      row.vendor,

    amount:
      Number(
        row.amount,
      ),

    paymentMethod:
      row.payment_method,

    referenceNumber:
      row.reference_number,

    note:
      row.note,

    createdByUserId:
      row.created_by_user_id,

    createdAt:
      row.created_at,

    updatedAt:
      row.updated_at,
  };
}


const EXPENSE_SELECT = `
  id,
  business_id,
  expense_date,
  category,
  title,
  vendor,
  amount,
  payment_method,
  reference_number,
  note,
  created_by_user_id,
  created_at,
  updated_at
`;


/* ============================================================
   LIST EXPENSES
============================================================ */

export async function fetchExpenses({
  businessId,
  startDate,
  endDate,
  category,
}: {
  businessId:
    string;

  startDate:
    string;

  endDate:
    string;

  category?:
    ExpenseCategory | "all";
}): Promise<Expense[]> {
  const supabase =
    createClient();


  let query =
    supabase
      .from(
        "expenses",
      )
      .select(
        EXPENSE_SELECT,
      )
      .eq(
        "business_id",
        businessId,
      )
      .gte(
        "expense_date",
        startDate,
      )
      .lte(
        "expense_date",
        endDate,
      )
      .order(
        "expense_date",
        {
          ascending:
            false,
        },
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      );


  if (
    category &&
    category !==
      "all"
  ) {
    query =
      query.eq(
        "category",
        category,
      );
  }


  const {
    data,
    error,
  } =
    await query;


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    (
      data ??
      []
    ) as ExpenseRow[]
  ).map(
    mapExpense,
  );
}


/* ============================================================
   SAVE EXPENSE
============================================================ */

export async function saveExpense(
  input:
    SaveExpenseInput,
): Promise<Expense> {
  const supabase =
    createClient();


  if (
    !input.title.trim()
  ) {
    throw new Error(
      "Expense title is required.",
    );
  }


  if (
    !Number.isFinite(
      input.amount,
    ) ||
    input.amount <=
      0
  ) {
    throw new Error(
      "Expense amount must be greater than zero.",
    );
  }


  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser();


  if (userError) {
    throw new Error(
      userError.message,
    );
  }


  const userId =
    userData.user?.id;


  if (!userId) {
    throw new Error(
      "Authentication required.",
    );
  }


  const values = {
    business_id:
      input.businessId,

    expense_date:
      input.expenseDate,

    category:
      input.category,

    title:
      input.title.trim(),

    vendor:
      input.vendor?.trim() ||
      null,

    amount:
      Math.round(
        input.amount *
          100,
      ) /
      100,

    payment_method:
      input.paymentMethod,

    reference_number:
      input.referenceNumber
        ?.trim() ||
      null,

    note:
      input.note?.trim() ||
      "",
  };


  if (input.id) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "expenses",
        )
        .update(
          values,
        )
        .eq(
          "id",
          input.id,
        )
        .eq(
          "business_id",
          input.businessId,
        )
        .select(
          EXPENSE_SELECT,
        )
        .single();


    if (error) {
      throw new Error(
        error.message,
      );
    }


    return mapExpense(
      data as ExpenseRow,
    );
  }


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "expenses",
      )
      .insert({
        ...values,

        created_by_user_id:
          userId,
      })
      .select(
        EXPENSE_SELECT,
      )
      .single();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return mapExpense(
    data as ExpenseRow,
  );
}


/* ============================================================
   DELETE EXPENSE
============================================================ */

export async function deleteExpense({
  businessId,
  expenseId,
}: {
  businessId:
    string;

  expenseId:
    string;
}) {
  const supabase =
    createClient();


  const {
    error,
  } =
    await supabase
      .from(
        "expenses",
      )
      .delete()
      .eq(
        "id",
        expenseId,
      )
      .eq(
        "business_id",
        businessId,
      );


  if (error) {
    throw new Error(
      error.message,
    );
  }
}


/* ============================================================
   REPORT
============================================================ */

export async function fetchExpenseReport({
  businessId,
  startDate,
  endDate,
}: {
  businessId:
    string;

  startDate:
    string;

  endDate:
    string;
}): Promise<ExpenseReport> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_expense_report",
      {
        p_business_id:
          businessId,

        p_start_date:
          startDate,

        p_end_date:
          endDate,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const report =
    objectValue(
      data,
    );


  const summary =
    objectValue(
      report.summary,
    );


  const categoryBreakdown =
    arrayValue(
      report.categoryBreakdown,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          category:
            String(
              row.category ??
                "other",
            ) as ExpenseCategory,

          amount:
            numberValue(
              row.amount,
            ),

          count:
            numberValue(
              row.count,
            ),
        };
      },
    );


  const dailyExpenses =
    arrayValue(
      report.dailyExpenses,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          date:
            String(
              row.date ??
                "",
            ),

          amount:
            numberValue(
              row.amount,
            ),

          count:
            numberValue(
              row.count,
            ),
        };
      },
    );


  const recentExpenses =
    arrayValue(
      report.recentExpenses,
    ).map(
      (value) => {
        const row =
          objectValue(
            value,
          );


        return {
          id:
            String(
              row.id ??
                "",
            ),

          businessId,

          expenseDate:
            String(
              row.date ??
                "",
            ),

          category:
            String(
              row.category ??
                "other",
            ) as ExpenseCategory,

          title:
            String(
              row.title ??
                "",
            ),

          vendor:
            typeof row.vendor ===
              "string"
              ? row.vendor
              : null,

          amount:
            numberValue(
              row.amount,
            ),

          paymentMethod:
            String(
              row.paymentMethod ??
                "cash",
            ) as PaymentMethod,

          referenceNumber:
            typeof row.referenceNumber ===
              "string"
              ? row.referenceNumber
              : null,

          note:
            String(
              row.note ??
                "",
            ),

          createdByUserId:
            null,

          createdAt:
            "",

          updatedAt:
            "",
        };
      },
    );


  return {
    businessId:
      String(
        report.businessId ??
          businessId,
      ),

    startDate:
      String(
        report.startDate ??
          startDate,
      ),

    endDate:
      String(
        report.endDate ??
          endDate,
      ),

    summary: {
      total:
        numberValue(
          summary.total,
        ),

      count:
        numberValue(
          summary.count,
        ),

      average:
        numberValue(
          summary.average,
        ),
    },

    categoryBreakdown,

    dailyExpenses,

    recentExpenses,
  };
}