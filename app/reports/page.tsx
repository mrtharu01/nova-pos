"use client";

import * as React from "react";

import {
  CalendarDays,
  Download,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ReportPrintDialog,
} from "@/components/reports/ReportPrintDialog";

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
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  fetchDashboardReport,
} from "@/lib/data/dashboard";

import {
  fetchExpenseReport,
} from "@/lib/data/expenses";

import type {
  DashboardReport,
} from "@/lib/domain/dashboard";

import type {
  ExpenseReport,
} from "@/lib/domain/expenses";

import {
  formatSaleMoney,
  paymentMethodLabel,
  saleStatusLabel,
  type PaymentMethod,
  type SaleStatus,
} from "@/lib/domain/sales";


type ReportPreset =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month";


const PRESETS: {
  id: ReportPreset;
  label: string;
}[] = [
  {
    id: "today",
    label: "Today",
  },
  {
    id: "yesterday",
    label: "Yesterday",
  },
  {
    id: "7d",
    label: "7 Days",
  },
  {
    id: "30d",
    label: "30 Days",
  },
  {
    id: "month",
    label: "This Month",
  },
];


function localDate(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
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


function presetRange(
  preset: ReportPreset,
) {
  const now =
    new Date();

  const end =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

  const start =
    new Date(
      end,
    );

  switch (preset) {
    case "yesterday":
      start.setDate(
        start.getDate() - 1,
      );

      end.setDate(
        end.getDate() - 1,
      );

      break;

    case "7d":
      start.setDate(
        start.getDate() - 6,
      );

      break;

    case "30d":
      start.setDate(
        start.getDate() - 29,
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


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message === "string"
    ) {
      return message;
    }
  }

  return "Reports could not be loaded.";
}


function formatReportDate(
  value: string,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-LK",
    {
      month: "short",
      day: "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}


function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-LK",
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function statusClass(
  status: SaleStatus,
) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";

    case "partially_refunded":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";

    case "refunded":
      return "bg-muted text-muted-foreground";

    case "voided":
      return "bg-destructive/10 text-destructive";
  }
}


function methodLabel(
  method: string,
) {
  if (
    method === "cash" ||
    method === "card" ||
    method === "bank_transfer" ||
    method === "other"
  ) {
    return paymentMethodLabel(
      method as PaymentMethod,
    );
  }

  return method;
}


function roundMoney(
  value: number,
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100,
  ) / 100;
}


export default function ReportsPage() {
  const {
    business,
  } =
    useCurrentBusiness();


  const businessId =
    business?.id ?? "";


  const currencyCode =
    business?.currency_code ??
    "LKR";


  const [
    preset,
    setPreset,
  ] =
    React.useState<ReportPreset>(
      "7d",
    );


  const [
    report,
    setReport,
  ] =
    React.useState<DashboardReport | null>(
      null,
    );


  const [
    expenseReport,
    setExpenseReport,
  ] =
    React.useState<ExpenseReport | null>(
      null,
    );


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
    React.useState<string | null>(
      null,
    );


  const [
    printOpen,
    setPrintOpen,
  ] =
    React.useState(
      false,
    );


  const range =
    React.useMemo(
      () =>
        presetRange(
          preset,
        ),
      [
        preset,
      ],
    );


  const loadReport =
    React.useCallback(
      async () => {
        if (!businessId) {
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
            salesResult,
            expenseResult,
          ] =
            await Promise.all([
              fetchDashboardReport({
                businessId,

                startDate:
                  range.startDate,

                endDate:
                  range.endDate,
              }),

              fetchExpenseReport({
                businessId,

                startDate:
                  range.startDate,

                endDate:
                  range.endDate,
              }),
            ]);


          setReport(
            salesResult,
          );


          setExpenseReport(
            expenseResult,
          );
        } catch (cause) {
          setError(
            getErrorMessage(
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
        range.endDate,
        range.startDate,
      ],
    );


  React.useEffect(() => {
    void loadReport();
  }, [
    loadReport,
  ]);


  const operatingExpenses =
    expenseReport?.summary.total ??
    0;


  const grossProfit =
    report?.summary.grossProfit ??
    0;


  const netOperatingProfit =
    roundMoney(
      grossProfit -
      operatingExpenses,
    );


  function exportCsv() {
    if (
      !report ||
      !expenseReport
    ) {
      return;
    }


    const rows: string[][] = [
      [
        "NOVA POS REPORT",
      ],

      [
        "Business",
        business?.name ??
          "NOVA POS",
      ],

      [
        "Start Date",
        report.startDate,
      ],

      [
        "End Date",
        report.endDate,
      ],

      [],

      [
        "FINANCIAL SUMMARY",
      ],

      [
        "Gross Revenue",
        report.summary.grossRevenue.toFixed(
          2,
        ),
      ],

      [
        "Refunds",
        report.summary.refundAmount.toFixed(
          2,
        ),
      ],

      [
        "Net Revenue",
        report.summary.revenue.toFixed(
          2,
        ),
      ],

      [
        "Cost of Goods",
        report.summary.cogs.toFixed(
          2,
        ),
      ],

      [
        "Gross Profit",
        report.summary.grossProfit.toFixed(
          2,
        ),
      ],

      [
        "Operating Expenses",
        expenseReport.summary.total.toFixed(
          2,
        ),
      ],

      [
        "Net Operating Profit",
        netOperatingProfit.toFixed(
          2,
        ),
      ],

      [],

      [
        "TRANSACTION SUMMARY",
      ],

      [
        "Transactions",
        report.summary.transactions.toString(),
      ],

      [
        "Refund Transactions",
        report.summary.refunds.toString(),
      ],

      [
        "Items Sold",
        report.summary.itemsSold.toString(),
      ],

      [
        "Expense Entries",
        expenseReport.summary.count.toString(),
      ],

      [],

      [
        "DAILY SALES",
      ],

      [
        "Date",
        "Net Revenue",
        "Transactions",
        "Items Sold",
      ],

      ...report.dailySales.map(
        (day) => [
          day.date,

          day.revenue.toFixed(
            2,
          ),

          day.transactions.toString(),

          day.itemsSold.toString(),
        ],
      ),

      [],

      [
        "OPERATING EXPENSES",
      ],

      [
        "Category",
        "Entries",
        "Amount",
      ],

      ...expenseReport.categoryBreakdown.map(
        (expense) => [
          expense.category,

          expense.count.toString(),

          expense.amount.toFixed(
            2,
          ),
        ],
      ),

      [],

      [
        "TOP PRODUCTS",
      ],

      [
        "Product",
        "Quantity",
        "Net Revenue",
      ],

      ...report.topProducts.map(
        (product) => [
          product.name,

          product.quantity.toString(),

          product.revenue.toFixed(
            2,
          ),
        ],
      ),
    ];


    const csv =
      rows
        .map(
          (row) =>
            row
              .map(
                (cell) =>
                  `"${cell.replace(
                    /"/g,
                    '""',
                  )}"`,
              )
              .join(","),
        )
        .join("\n");


    const blob =
      new Blob(
        [
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );


    const url =
      URL.createObjectURL(
        blob,
      );


    const anchor =
      document.createElement(
        "a",
      );


    anchor.href =
      url;


    anchor.download =
      `nova-report-${report.startDate}-${report.endDate}.csv`;


    document.body.appendChild(
      anchor,
    );


    anchor.click();


    anchor.remove();


    URL.revokeObjectURL(
      url,
    );
  }


  if (
    loading &&
    !report
  ) {
    return (
      <AppLayout title="Reports">

        <div className="flex min-h-[65vh] flex-col items-center justify-center">

          <Loader2 className="h-8 w-8 animate-spin text-primary" />


          <p className="mt-4 text-sm text-muted-foreground">
            Building financial report…
          </p>

        </div>

      </AppLayout>
    );
  }


  return (
    <AppLayout title="Reports">

      <div className="space-y-6">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

          <div>

            <h1 className="text-2xl font-bold tracking-tight">
              Reports
            </h1>


            <p className="mt-1 text-sm text-muted-foreground">
              Sales, refunds, cost of goods and operating-expense reporting from NOVA.
            </p>

          </div>


          <div className="flex flex-wrap gap-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[12px]"
              disabled={
                loading
              }
              onClick={() =>
                void loadReport()
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
              variant="outline"
              className="rounded-[12px]"
              disabled={
                !report ||
                !expenseReport
              }
              onClick={
                exportCsv
              }
            >

              <Download className="mr-2 h-4 w-4" />

              CSV

            </Button>


            <Button
              type="button"
              className="rounded-[12px]"
              disabled={
                !report ||
                !expenseReport
              }
              onClick={() =>
                setPrintOpen(
                  true,
                )
              }
            >

              <Printer className="mr-2 h-4 w-4" />

              Print Report

            </Button>

          </div>

        </div>


        <div className="flex flex-col gap-3 rounded-[18px] border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">

            {PRESETS.map(
              (item) => (

                <button
                  key={
                    item.id
                  }
                  type="button"
                  onClick={() =>
                    setPreset(
                      item.id,
                    )
                  }
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    preset ===
                    item.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >

                  {
                    item.label
                  }

                </button>

              ),
            )}

          </div>


          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">

            <CalendarDays className="h-4 w-4" />


            <span>
              {formatReportDate(
                range.startDate,
              )}

              {" — "}

              {formatReportDate(
                range.endDate,
              )}
            </span>

          </div>

        </div>


        {error && (

          <div className="flex items-start gap-3 rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

            <span>
              {
                error
              }
            </span>

          </div>

        )}


        {report &&
        expenseReport && (

          <>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <MetricCard
                icon={
                  <WalletCards className="h-5 w-5" />
                }
                label="Gross Revenue"
                value={
                  formatSaleMoney(
                    report.summary.grossRevenue,
                    currencyCode,
                  )
                }
                hint="Before refunds"
              />


              <MetricCard
                icon={
                  <RotateCcw className="h-5 w-5" />
                }
                label="Refunds"
                value={`-${formatSaleMoney(
                  report.summary.refundAmount,
                  currencyCode,
                )}`}
                hint={`${report.summary.refunds} refund transaction${
                  report.summary.refunds === 1
                    ? ""
                    : "s"
                }`}
                destructive={
                  report.summary.refundAmount >
                  0
                }
              />


              <MetricCard
                icon={
                  <TrendingUp className="h-5 w-5" />
                }
                label="Net Revenue"
                value={
                  formatSaleMoney(
                    report.summary.revenue,
                    currencyCode,
                  )
                }
                hint="After refunds"
                primary
              />


              <MetricCard
                icon={
                  <ShoppingBag className="h-5 w-5" />
                }
                label="Net Items Sold"
                value={
                  report.summary.itemsSold.toLocaleString()
                }
                hint="After returned quantities"
              />

            </div>


            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <MetricCard
                icon={
                  <ReceiptText className="h-5 w-5" />
                }
                label="Transactions"
                value={
                  report.summary.transactions.toLocaleString()
                }
                hint={`Average ${formatSaleMoney(
                  report.summary.averageSale,
                  currencyCode,
                )}`}
              />


              <MetricCard
                icon={
                  <TrendingUp className="h-5 w-5" />
                }
                label="Gross Profit"
                value={
                  formatSaleMoney(
                    report.summary.grossProfit,
                    currencyCode,
                  )
                }
                hint="Revenue minus COGS"
              />


              <MetricCard
                icon={
                  <WalletCards className="h-5 w-5" />
                }
                label="Operating Expenses"
                value={`-${formatSaleMoney(
                  operatingExpenses,
                  currencyCode,
                )}`}
                hint={`${expenseReport.summary.count} expense entr${
                  expenseReport.summary.count ===
                  1
                    ? "y"
                    : "ies"
                }`}
                destructive={
                  operatingExpenses >
                  0
                }
              />


              <MetricCard
                icon={
                  <TrendingUp className="h-5 w-5" />
                }
                label="Net Operating Profit"
                value={
                  formatSaleMoney(
                    netOperatingProfit,
                    currencyCode,
                  )
                }
                hint="After operating expenses"
                primary={
                  netOperatingProfit >=
                  0
                }
                destructive={
                  netOperatingProfit <
                  0
                }
              />

            </div>


            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.7fr)]">

              <Card className="rounded-[24px]">

                <CardHeader>

                  <CardTitle>
                    Net Sales Trend
                  </CardTitle>

                </CardHeader>


                <CardContent>

                  <SalesTrend
                    report={
                      report
                    }
                    currencyCode={
                      currencyCode
                    }
                  />

                </CardContent>

              </Card>


              <Card className="rounded-[24px]">

                <CardHeader>

                  <CardTitle>
                    Profit & Loss Summary
                  </CardTitle>

                </CardHeader>


                <CardContent className="space-y-3">

                  <FinancialRow
                    label="Gross revenue"
                    value={
                      formatSaleMoney(
                        report.summary.grossRevenue,
                        currencyCode,
                      )
                    }
                  />


                  <FinancialRow
                    label="Refunds"
                    value={`-${formatSaleMoney(
                      report.summary.refundAmount,
                      currencyCode,
                    )}`}
                    destructive={
                      report.summary.refundAmount >
                      0
                    }
                  />


                  <FinancialRow
                    label="Net revenue"
                    value={
                      formatSaleMoney(
                        report.summary.revenue,
                        currencyCode,
                      )
                    }
                    strong
                  />


                  <FinancialRow
                    label="Cost of goods"
                    value={`-${formatSaleMoney(
                      report.summary.cogs,
                      currencyCode,
                    )}`}
                  />


                  <FinancialRow
                    label="Gross profit"
                    value={
                      formatSaleMoney(
                        report.summary.grossProfit,
                        currencyCode,
                      )
                    }
                    strong
                  />


                  <FinancialRow
                    label="Operating expenses"
                    value={`-${formatSaleMoney(
                      operatingExpenses,
                      currencyCode,
                    )}`}
                    destructive={
                      operatingExpenses >
                      0
                    }
                  />


                  <div className="border-t pt-3">

                    <FinancialRow
                      label="Net operating profit"
                      value={
                        formatSaleMoney(
                          netOperatingProfit,
                          currencyCode,
                        )
                      }
                      primary={
                        netOperatingProfit >=
                        0
                      }
                      destructive={
                        netOperatingProfit <
                        0
                      }
                      strong
                    />

                  </div>

                </CardContent>

              </Card>

            </div>


            <div className="grid gap-6 xl:grid-cols-2">

              <Card className="rounded-[24px]">

                <CardHeader>
                  <CardTitle>
                    Operating Expenses
                  </CardTitle>
                </CardHeader>


                <CardContent>

                  {expenseReport.categoryBreakdown.length >
                  0 ? (

                    <ExpenseBreakdown
                      expenseReport={
                        expenseReport
                      }
                      currencyCode={
                        currencyCode
                      }
                    />

                  ) : (

                    <EmptyState
                      text="No operating expenses in this period."
                    />

                  )}

                </CardContent>

              </Card>


              <Card className="rounded-[24px]">

                <CardHeader>
                  <CardTitle>
                    Payment Methods
                  </CardTitle>
                </CardHeader>


                <CardContent>

                  <PaymentBreakdown
                    report={
                      report
                    }
                    currencyCode={
                      currencyCode
                    }
                  />

                </CardContent>

              </Card>

            </div>


            <Card className="rounded-[24px]">

              <CardHeader>
                <CardTitle>
                  Top Products
                </CardTitle>
              </CardHeader>


              <CardContent>

                {report.topProducts.length >
                0 ? (

                  <div className="grid gap-3 lg:grid-cols-2">

                    {report.topProducts.map(
                      (
                        product,
                        index,
                      ) => (

                        <div
                          key={`${product.productId ?? product.name}-${index}`}
                          className="flex items-center gap-3 rounded-[14px] border p-3"
                        >

                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-muted text-sm font-bold">
                            {
                              index + 1
                            }
                          </div>


                          <div className="min-w-0 flex-1">

                            <p className="truncate text-sm font-semibold">
                              {
                                product.name
                              }
                            </p>


                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {
                                product.quantity
                              }{" "}
                              unit
                              {product.quantity === 1
                                ? ""
                                : "s"}
                            </p>

                          </div>


                          <p className="shrink-0 text-sm font-bold">

                            {formatSaleMoney(
                              product.revenue,
                              currencyCode,
                            )}

                          </p>

                        </div>

                      ),
                    )}

                  </div>

                ) : (

                  <EmptyState
                    text="No product sales in this period."
                  />

                )}

              </CardContent>

            </Card>


            <Card className="rounded-[24px]">

              <CardHeader>
                <CardTitle>
                  Recent Transactions
                </CardTitle>
              </CardHeader>


              <CardContent>

                {report.recentSales.length >
                0 ? (

                  <div className="overflow-x-auto">

                    <table className="w-full min-w-[760px] text-sm">

                      <thead>

                        <tr className="border-b text-left text-xs text-muted-foreground">

                          <th className="pb-3 font-medium">
                            Receipt
                          </th>

                          <th className="pb-3 font-medium">
                            Customer
                          </th>

                          <th className="pb-3 font-medium">
                            Date
                          </th>

                          <th className="pb-3 font-medium">
                            Status
                          </th>

                          <th className="pb-3 text-right font-medium">
                            Original
                          </th>

                          <th className="pb-3 text-right font-medium">
                            Refund
                          </th>

                          <th className="pb-3 text-right font-medium">
                            Net
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {report.recentSales.map(
                          (sale) => (

                            <tr
                              key={
                                sale.id
                              }
                              className="border-b last:border-0"
                            >

                              <td className="py-3 font-semibold">
                                {
                                  sale.receiptNumber
                                }
                              </td>


                              <td className="py-3 text-muted-foreground">
                                {
                                  sale.customerName ??
                                  "Walk-in"
                                }
                              </td>


                              <td className="py-3 text-muted-foreground">

                                {formatDateTime(
                                  sale.createdAt,
                                )}

                              </td>


                              <td className="py-3">

                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                                    statusClass(
                                      sale.status,
                                    )
                                  }`}
                                >

                                  {saleStatusLabel(
                                    sale.status,
                                  )}

                                </span>

                              </td>


                              <td className="py-3 text-right">

                                {formatSaleMoney(
                                  sale.total,
                                  sale.currencyCode,
                                )}

                              </td>


                              <td className="py-3 text-right text-destructive">

                                {sale.refundAmount >
                                0
                                  ? `-${formatSaleMoney(
                                      sale.refundAmount,
                                      sale.currencyCode,
                                    )}`
                                  : "—"}

                              </td>


                              <td className="py-3 text-right font-bold">

                                {formatSaleMoney(
                                  sale.netTotal,
                                  sale.currencyCode,
                                )}

                              </td>

                            </tr>

                          ),
                        )}

                      </tbody>

                    </table>

                  </div>

                ) : (

                  <EmptyState
                    text="No transactions in this period."
                  />

                )}

              </CardContent>

            </Card>

          </>

        )}

      </div>


      <ReportPrintDialog
        isOpen={
          printOpen
        }
        onClose={() =>
          setPrintOpen(
            false,
          )
        }
        report={
          report
        }
        expenseReport={
          expenseReport
        }
        businessId={
          businessId
        }
        businessName={
          business?.name ??
          "NOVA POS"
        }
        currencyCode={
          currencyCode
        }
      />

    </AppLayout>
  );
}


function MetricCard({
  icon,
  label,
  value,
  hint,
  primary = false,
  destructive = false,
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

  destructive?:
    boolean;
}) {
  return (
    <Card className="rounded-[20px]">

      <CardContent className="flex items-center gap-4 p-5">

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${
            primary
              ? "bg-primary/10 text-primary"
              : destructive
                ? "bg-destructive/10 text-destructive"
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
                : destructive
                  ? "text-destructive"
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


function SalesTrend({
  report,
  currencyCode,
}: {
  report:
    DashboardReport;

  currencyCode:
    string;
}) {
  const maximum =
    Math.max(
      1,
      ...report.dailySales.map(
        (day) =>
          day.revenue,
      ),
    );


  if (
    report.dailySales.length ===
    0
  ) {
    return (
      <EmptyState
        text="No sales trend available."
      />
    );
  }


  const labelInterval =
    Math.max(
      1,
      Math.ceil(
        report.dailySales.length /
        7,
      ),
    );


  return (
    <div>

      <div className="flex h-[230px] items-end gap-2 border-b px-1">

        {report.dailySales.map(
          (
            day,
            index,
          ) => {
            const height =
              day.revenue <=
              0
                ? 4
                : Math.max(
                    8,
                    Math.round(
                      day.revenue /
                      maximum *
                      210,
                    ),
                  );


            return (
              <div
                key={
                  day.date
                }
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center"
              >

                <div
                  className="w-full max-w-[36px] rounded-t-[8px] bg-primary/80 transition-all group-hover:bg-primary"
                  style={{
                    height:
                      `${height}px`,
                  }}
                />


                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-[10px] border bg-popover px-2.5 py-1.5 text-xs shadow-lg group-hover:block">

                  <p className="font-semibold">

                    {formatSaleMoney(
                      day.revenue,
                      currencyCode,
                    )}

                  </p>


                  <p className="text-[10px] text-muted-foreground">
                    {
                      day.transactions
                    }{" "}
                    transaction
                    {day.transactions ===
                    1
                      ? ""
                      : "s"}
                  </p>

                </div>


                {index ===
                  report.dailySales.length -
                    1 && (
                  <span className="sr-only">
                    Latest
                  </span>
                )}

              </div>
            );
          },
        )}

      </div>


      <div
        className="mt-2 grid"
        style={{
          gridTemplateColumns:
            `repeat(${report.dailySales.length}, minmax(0, 1fr))`,
        }}
      >

        {report.dailySales.map(
          (
            day,
            index,
          ) => (

            <div
              key={
                day.date
              }
              className="min-w-0 text-center"
            >

              {index %
                labelInterval ===
                0 ||
              index ===
                report.dailySales.length -
                  1 ? (

                <span className="text-[9px] text-muted-foreground">

                  {formatReportDate(
                    day.date,
                  )}

                </span>

              ) : null}

            </div>

          ),
        )}

      </div>

    </div>
  );
}


function PaymentBreakdown({
  report,
  currencyCode,
}: {
  report:
    DashboardReport;

  currencyCode:
    string;
}) {
  if (
    report.paymentBreakdown.length ===
    0
  ) {
    return (
      <EmptyState
        text="No payment activity in this period."
      />
    );
  }


  const maxAmount =
    Math.max(
      1,
      ...report.paymentBreakdown.map(
        (payment) =>
          Math.abs(
            payment.amount,
          ),
      ),
    );


  return (
    <div className="space-y-4">

      {report.paymentBreakdown.map(
        (payment) => {
          const width =
            Math.max(
              2,
              Math.abs(
                payment.amount,
              ) /
                maxAmount *
                100,
            );


          return (
            <div
              key={
                payment.method
              }
            >

              <div className="mb-2 flex items-center justify-between gap-4">

                <div>

                  <p className="text-sm font-semibold">
                    {methodLabel(
                      payment.method,
                    )}
                  </p>


                  <p className="text-[10px] text-muted-foreground">
                    {
                      payment.transactions
                    }{" "}
                    transaction
                    {payment.transactions ===
                    1
                      ? ""
                      : "s"}
                  </p>

                </div>


                <p
                  className={`text-sm font-bold ${
                    payment.amount <
                    0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {formatSaleMoney(
                    payment.amount,
                    currencyCode,
                  )}
                </p>

              </div>


              <div className="h-2 overflow-hidden rounded-full bg-muted">

                <div
                  className={`h-full rounded-full ${
                    payment.amount <
                    0
                      ? "bg-destructive"
                      : "bg-primary"
                  }`}
                  style={{
                    width:
                      `${width}%`,
                  }}
                />

              </div>

            </div>
          );
        },
      )}

    </div>
  );
}


function ExpenseBreakdown({
  expenseReport,
  currencyCode,
}: {
  expenseReport:
    ExpenseReport;

  currencyCode:
    string;
}) {
  const maxAmount =
    Math.max(
      1,
      ...expenseReport.categoryBreakdown.map(
        (item) =>
          item.amount,
      ),
    );


  return (
    <div className="space-y-4">

      {expenseReport.categoryBreakdown.map(
        (item) => {
          const width =
            Math.max(
              2,
              item.amount /
              maxAmount *
              100,
            );


          return (
            <div
              key={
                item.category
              }
            >

              <div className="mb-2 flex items-center justify-between gap-4">

                <div>

                  <p className="text-sm font-semibold capitalize">
                    {item.category.replace(
                      /_/g,
                      " ",
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
                      `${width}%`,
                  }}
                />

              </div>

            </div>
          );
        },
      )}

    </div>
  );
}


function FinancialRow({
  label,
  value,
  strong = false,
  primary = false,
  destructive = false,
}: {
  label:
    string;

  value:
    string;

  strong?:
    boolean;

  primary?:
    boolean;

  destructive?:
    boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[14px] bg-muted/30 p-3.5">

      <span
        className={`text-sm ${
          strong
            ? "font-semibold"
            : "text-muted-foreground"
        }`}
      >
        {
          label
        }
      </span>


      <span
        className={`text-sm ${
          strong
            ? "font-bold"
            : "font-semibold"
        } ${
          primary
            ? "text-primary"
            : destructive
              ? "text-destructive"
              : ""
        }`}
      >
        {
          value
        }
      </span>

    </div>
  );
}


function EmptyState({
  text,
}: {
  text:
    string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center text-center">

      <ReceiptText className="h-6 w-6 text-muted-foreground" />


      <p className="mt-3 text-sm text-muted-foreground">
        {
          text
        }
      </p>

    </div>
  );
}