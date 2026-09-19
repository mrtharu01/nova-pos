"use client";

import * as React from "react";

import {
  CalendarDays,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ExpenseDialog,
} from "@/components/expenses/ExpenseDialog";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  deleteExpense,
  fetchExpenseReport,
  fetchExpenses,
} from "@/lib/data/expenses";

import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  type Expense,
  type ExpenseCategory,
  type ExpenseReport,
} from "@/lib/domain/expenses";

import {
  formatSaleMoney,
  paymentMethodLabel,
} from "@/lib/domain/sales";


type RangePreset =
  | "today"
  | "7d"
  | "30d"
  | "month";


const RANGE_OPTIONS: {
  value:
    RangePreset;

  label:
    string;
}[] = [
  {
    value:
      "today",

    label:
      "Today",
  },

  {
    value:
      "7d",

    label:
      "7 Days",
  },

  {
    value:
      "30d",

    label:
      "30 Days",
  },

  {
    value:
      "month",

    label:
      "This Month",
  },
];


function localDate(
  date:
    Date,
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


function rangeForPreset(
  preset:
    RangePreset,
) {
  const today =
    new Date();


  const end =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );


  const start =
    new Date(
      end,
    );


  switch (preset) {
    case "7d":

      start.setDate(
        start.getDate() -
          6,
      );

      break;


    case "30d":

      start.setDate(
        start.getDate() -
          29,
      );

      break;


    case "month":

      start.setDate(
        1,
      );

      break;


    case "today":
    default:

      break;
  }


  return {
    startDate:
      localDate(
        start,
      ),

    endDate:
      localDate(
        end,
      ),
  };
}


function formatDate(
  value:
    string,
) {
  return new Intl.DateTimeFormat(
    "en-LK",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}


function errorMessage(
  error:
    unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }


  return "Expenses could not be loaded.";
}


export default function ExpensesPage() {
  const {
    business,
    demo,
  } =
    useCurrentBusiness();


  const businessId =
    business?.id ??
    "";


  const currencyCode =
    business?.currency_code ??
    "LKR";


  const [
    rangePreset,
    setRangePreset,
  ] =
    React.useState<RangePreset>(
      "30d",
    );


  const [
    category,
    setCategory,
  ] =
    React.useState<
      ExpenseCategory | "all"
    >(
      "all",
    );


  const [
    search,
    setSearch,
  ] =
    React.useState("");


  const [
    expenses,
    setExpenses,
  ] =
    React.useState<
      Expense[]
    >([]);


  const [
    report,
    setReport,
  ] =
    React.useState<
      ExpenseReport | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    dialogOpen,
    setDialogOpen,
  ] =
    React.useState(
      false,
    );


  const [
    editingExpense,
    setEditingExpense,
  ] =
    React.useState<
      Expense | null
    >(null);


  const [
    deletingId,
    setDeletingId,
  ] =
    React.useState<
      string | null
    >(null);


  const range =
    React.useMemo(
      () =>
        rangeForPreset(
          rangePreset,
        ),
      [
        rangePreset,
      ],
    );


  const load =
    React.useCallback(
      async () => {
        if (
          !businessId ||
          demo
        ) {
          setLoading(
            false,
          );

          return;
        }


        setLoading(
          true,
        );


        setError(
          null,
        );


        try {
          const [
            expenseRows,
            expenseReport,
          ] =
            await Promise.all([
              fetchExpenses({
                businessId,

                startDate:
                  range.startDate,

                endDate:
                  range.endDate,

                category,
              }),

              fetchExpenseReport({
                businessId,

                startDate:
                  range.startDate,

                endDate:
                  range.endDate,
              }),
            ]);


          setExpenses(
            expenseRows,
          );


          setReport(
            expenseReport,
          );
        } catch (cause) {
          setError(
            errorMessage(
              cause,
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        businessId,
        category,
        demo,
        range.endDate,
        range.startDate,
      ],
    );


  React.useEffect(() => {
    void load();
  }, [
    load,
  ]);


  const filteredExpenses =
    React.useMemo(
      () => {
        const value =
          search
            .trim()
            .toLowerCase();


        if (!value) {
          return expenses;
        }


        return expenses.filter(
          (expense) => {
            return (
              expense.title
                .toLowerCase()
                .includes(
                  value,
                ) ||
              expense.vendor
                ?.toLowerCase()
                .includes(
                  value,
                ) ||
              expense.referenceNumber
                ?.toLowerCase()
                .includes(
                  value,
                ) ||
              expense.note
                .toLowerCase()
                .includes(
                  value,
                ) ||
              expenseCategoryLabel(
                expense.category,
              )
                .toLowerCase()
                .includes(
                  value,
                )
            );
          },
        );
      },
      [
        expenses,
        search,
      ],
    );


  const highestCategory =
    report
      ?.categoryBreakdown[
        0
      ] ??
    null;


  function openNewExpense() {
    setEditingExpense(
      null,
    );


    setDialogOpen(
      true,
    );
  }


  function openEditExpense(
    expense:
      Expense,
  ) {
    setEditingExpense(
      expense,
    );


    setDialogOpen(
      true,
    );
  }


  async function handleDelete(
    expense:
      Expense,
  ) {
    const confirmed =
      window.confirm(
        `Delete "${expense.title}"?\n\nThis removes the expense from NOVA's operating-expense reports.`,
      );


    if (!confirmed) {
      return;
    }


    setDeletingId(
      expense.id,
    );


    setError(
      null,
    );


    try {
      await deleteExpense({
        businessId,

        expenseId:
          expense.id,
      });


      await load();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setDeletingId(
        null,
      );
    }
  }


  if (
    loading &&
    !report
  ) {
    return (
      <AppLayout title="Expenses">

        <div className="flex min-h-[65vh] flex-col items-center justify-center">

          <Loader2 className="h-8 w-8 animate-spin text-primary" />


          <p className="mt-4 text-sm text-muted-foreground">
            Loading expenses…
          </p>

        </div>

      </AppLayout>
    );
  }


  return (
    <AppLayout title="Expenses">

      <div className="space-y-6">

        {/* ====================================================
            HEADER
        ===================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>

            <h1 className="text-2xl font-bold tracking-tight">
              Expenses
            </h1>


            <p className="mt-1 text-sm text-muted-foreground">
              Track operating costs and calculate the real profitability of your business.
            </p>

          </div>


          <div className="flex gap-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[12px]"
              disabled={
                loading
              }
              onClick={() =>
                void load()
              }
            >

              <RefreshCw
                className={`mr-2 h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh

            </Button>


            <Button
              type="button"
              className="rounded-[12px]"
              disabled={
                demo
              }
              onClick={
                openNewExpense
              }
            >

              <Plus className="mr-2 h-4 w-4" />

              Add Expense

            </Button>

          </div>

        </div>


        {/* ====================================================
            DEMO
        ===================================================== */}

        {demo && (

          <div className="rounded-[18px] border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
            Expenses require a connected NOVA business database.
          </div>

        )}


        {/* ====================================================
            FILTERS
        ===================================================== */}

        <div className="rounded-[20px] border bg-card p-4">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

            <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">

              {RANGE_OPTIONS.map(
                (option) => (

                  <button
                    key={
                      option.value
                    }
                    type="button"
                    onClick={() =>
                      setRangePreset(
                        option.value,
                      )
                    }
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      rangePreset ===
                      option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {
                      option.label
                    }
                  </button>

                ),
              )}

            </div>


            <div className="flex flex-col gap-2 sm:flex-row">

              <div className="relative sm:w-[260px]">

                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />


                <Input
                  value={
                    search
                  }
                  onChange={(
                    event,
                  ) =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  className="pl-9"
                  placeholder="Search expenses..."
                />

              </div>


              <select
                value={
                  category
                }
                onChange={(
                  event,
                ) =>
                  setCategory(
                    event.target.value as
                      ExpenseCategory | "all",
                  )
                }
                className="h-10 rounded-[12px] border bg-background px-3 text-sm outline-none focus:border-primary"
              >

                <option value="all">
                  All categories
                </option>


                {EXPENSE_CATEGORIES.map(
                  (item) => (

                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {
                        item.label
                      }
                    </option>

                  ),
                )}

              </select>

            </div>

          </div>


          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">

            <CalendarDays className="h-4 w-4" />

            {formatDate(
              range.startDate,
            )}

            {" — "}

            {formatDate(
              range.endDate,
            )}

          </div>

        </div>


        {/* ====================================================
            ERROR
        ===================================================== */}

        {error && (

          <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

            {
              error
            }

          </div>

        )}


        {/* ====================================================
            SUMMARY
        ===================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <SummaryCard
            icon={
              <WalletCards className="h-5 w-5" />
            }
            label="Operating Expenses"
            value={
              formatSaleMoney(
                report?.summary.total ??
                  0,
                currencyCode,
              )
            }
            hint="Selected period"
            primary
          />


          <SummaryCard
            icon={
              <ReceiptText className="h-5 w-5" />
            }
            label="Expense Entries"
            value={
              (
                report?.summary.count ??
                0
              ).toLocaleString()
            }
            hint="Recorded transactions"
          />


          <SummaryCard
            icon={
              <CreditCard className="h-5 w-5" />
            }
            label="Average Expense"
            value={
              formatSaleMoney(
                report?.summary.average ??
                  0,
                currencyCode,
              )
            }
            hint="Average per entry"
          />


          <SummaryCard
            icon={
              <WalletCards className="h-5 w-5" />
            }
            label="Highest Category"
            value={
              highestCategory
                ? expenseCategoryLabel(
                    highestCategory.category,
                  )
                : "—"
            }
            hint={
              highestCategory
                ? formatSaleMoney(
                    highestCategory.amount,
                    currencyCode,
                  )
                : "No expense data"
            }
          />

        </div>


        {/* ====================================================
            CATEGORY BREAKDOWN
        ===================================================== */}

        <Card className="rounded-[24px]">

          <CardHeader>

            <CardTitle>
              Expense Breakdown
            </CardTitle>

          </CardHeader>


          <CardContent>

            {report &&
            report.categoryBreakdown.length >
              0 ? (

              <div className="space-y-4">

                {report.categoryBreakdown.map(
                  (item) => {
                    const maximum =
                      Math.max(
                        1,
                        ...report.categoryBreakdown.map(
                          (row) =>
                            row.amount,
                        ),
                      );


                    const width =
                      item.amount /
                      maximum *
                      100;


                    return (
                      <div
                        key={
                          item.category
                        }
                      >

                        <div className="mb-2 flex items-center justify-between gap-4">

                          <div>

                            <p className="text-sm font-semibold">
                              {expenseCategoryLabel(
                                item.category,
                              )}
                            </p>


                            <p className="text-[10px] text-muted-foreground">

                              {
                                item.count
                              }{" "}
                              entr
                              {item.count ===
                              1
                                ? "y"
                                : "ies"}

                            </p>

                          </div>


                          <p className="text-sm font-bold">

                            {formatSaleMoney(
                              item.amount,
                              currencyCode,
                            )}

                          </p>

                        </div>


                        <div className="h-2 overflow-hidden rounded-full bg-muted">

                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width:
                                `${Math.max(
                                  2,
                                  width,
                                )}%`,
                            }}
                          />

                        </div>

                      </div>
                    );
                  },
                )}

              </div>

            ) : (

              <EmptyState />

            )}

          </CardContent>

        </Card>


        {/* ====================================================
            EXPENSE LIST
        ===================================================== */}

        <Card className="overflow-hidden rounded-[24px]">

          <CardHeader>

            <div className="flex items-center justify-between gap-4">

              <div>

                <CardTitle>
                  Expense History
                </CardTitle>


                <p className="mt-1 text-xs text-muted-foreground">

                  {
                    filteredExpenses.length
                  }{" "}
                  visible expense
                  {filteredExpenses.length ===
                  1
                    ? ""
                    : "s"}

                </p>

              </div>


              <Button
                type="button"
                size="sm"
                className="rounded-[12px]"
                disabled={
                  demo
                }
                onClick={
                  openNewExpense
                }
              >

                <Plus className="mr-2 h-4 w-4" />

                Add

              </Button>

            </div>

          </CardHeader>


          <CardContent className="p-0">

            {filteredExpenses.length >
            0 ? (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[850px] text-sm">

                  <thead>

                    <tr className="border-y bg-muted/30 text-left text-xs text-muted-foreground">

                      <th className="px-5 py-3 font-medium">
                        Date
                      </th>

                      <th className="px-5 py-3 font-medium">
                        Expense
                      </th>

                      <th className="px-5 py-3 font-medium">
                        Category
                      </th>

                      <th className="px-5 py-3 font-medium">
                        Payment
                      </th>

                      <th className="px-5 py-3 text-right font-medium">
                        Amount
                      </th>

                      <th className="px-5 py-3 text-right font-medium">
                        Actions
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {filteredExpenses.map(
                      (expense) => (

                        <tr
                          key={
                            expense.id
                          }
                          className="border-b last:border-0"
                        >

                          <td className="px-5 py-4 text-muted-foreground">

                            {formatDate(
                              expense.expenseDate,
                            )}

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-semibold">
                              {
                                expense.title
                              }
                            </p>


                            <p className="mt-1 max-w-[280px] truncate text-xs text-muted-foreground">

                              {
                                expense.vendor ??
                                expense.note ??
                                "—"
                              }

                            </p>

                          </td>


                          <td className="px-5 py-4">

                            <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">

                              {expenseCategoryLabel(
                                expense.category,
                              )}

                            </span>

                          </td>


                          <td className="px-5 py-4">

                            <p className="font-medium">
                              {paymentMethodLabel(
                                expense.paymentMethod,
                              )}
                            </p>


                            {expense.referenceNumber && (

                              <p className="mt-1 max-w-[170px] truncate font-mono text-[10px] text-muted-foreground">
                                {
                                  expense.referenceNumber
                                }
                              </p>

                            )}

                          </td>


                          <td className="px-5 py-4 text-right font-bold">

                            {formatSaleMoney(
                              expense.amount,
                              currencyCode,
                            )}

                          </td>


                          <td className="px-5 py-4">

                            <div className="flex justify-end gap-1">

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-[10px]"
                                title="Edit expense"
                                onClick={() =>
                                  openEditExpense(
                                    expense,
                                  )
                                }
                              >

                                <Pencil className="h-4 w-4" />

                              </Button>


                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="rounded-[10px] text-destructive hover:text-destructive"
                                title="Delete expense"
                                disabled={
                                  deletingId ===
                                  expense.id
                                }
                                onClick={() =>
                                  void handleDelete(
                                    expense,
                                  )
                                }
                              >

                                {deletingId ===
                                expense.id ? (

                                  <Loader2 className="h-4 w-4 animate-spin" />

                                ) : (

                                  <Trash2 className="h-4 w-4" />

                                )}

                              </Button>

                            </div>

                          </td>

                        </tr>

                      ),
                    )}

                  </tbody>

                </table>

              </div>

            ) : (

              <EmptyState />

            )}

          </CardContent>

        </Card>

      </div>


      {/* ======================================================
          ADD / EDIT
      ======================================================= */}

      <ExpenseDialog
        isOpen={
          dialogOpen
        }
        onClose={() => {

          setDialogOpen(
            false,
          );


          setEditingExpense(
            null,
          );

        }}
        businessId={
          businessId
        }
        expense={
          editingExpense
        }
        onSaved={async () => {
          await load();
        }}
      />

    </AppLayout>
  );
}


/* ============================================================
   SUMMARY
============================================================ */

function SummaryCard({
  icon,
  label,
  value,
  hint,
  primary = false,
}: {
  icon:
    React.ReactNode;

  label:
    string;

  value:
    string;

  hint:
    string;

  primary?:
    boolean;
}) {
  return (
    <Card className="rounded-[20px]">

      <CardContent className="flex items-center gap-4 p-5">

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${
            primary
              ? "bg-primary/10 text-primary"
              : "bg-muted"
          }`}
        >

          {
            icon
          }

        </div>


        <div className="min-w-0">

          <p className="text-xs text-muted-foreground">
            {
              label
            }
          </p>


          <p
            className={`mt-1 truncate text-xl font-bold ${
              primary
                ? "text-primary"
                : ""
            }`}
          >

            {
              value
            }

          </p>


          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            {
              hint
            }
          </p>

        </div>

      </CardContent>

    </Card>
  );
}


/* ============================================================
   EMPTY
============================================================ */

function EmptyState() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">

      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-muted">

        <WalletCards className="h-6 w-6 text-muted-foreground" />

      </div>


      <p className="mt-4 font-semibold">
        No expenses found
      </p>


      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Record business operating expenses such as rent, utilities, salaries and marketing.
      </p>

    </div>
  );
}