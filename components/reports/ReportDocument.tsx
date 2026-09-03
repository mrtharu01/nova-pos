"use client";

import * as React from "react";

import type {
  DashboardReport,
} from "@/lib/domain/dashboard";

import {
  expenseCategoryLabel,
  type ExpenseReport,
} from "@/lib/domain/expenses";

import {
  formatSaleMoney,
  paymentMethodLabel,
  saleStatusLabel,
  type PaymentMethod,
} from "@/lib/domain/sales";


export type PrintableReportSettings = {
  paperSize:
    "A4" | "Letter";

  orientation:
    "portrait" | "landscape";

  title:
    string;

  displayName:
    string | null;

  addressLine1:
    string | null;

  addressLine2:
    string | null;

  phone:
    string | null;

  email:
    string | null;

  footerMessage:
    string;

  showSummary:
    boolean;

  showSalesTrend:
    boolean;

  showPaymentBreakdown:
    boolean;

  showTopProducts:
    boolean;

  showRecentSales:
    boolean;

  showOperatingExpenses:
    boolean;

  showNetOperatingProfit:
    boolean;
};


type ReportDocumentProps = {
  report:
    DashboardReport;

  expenseReport:
    ExpenseReport;

  businessName:
    string;

  currencyCode:
    string;

  settings:
    PrintableReportSettings;
};


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
        "long",

      day:
        "numeric",
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  );
}


function formatDateTime(
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

      hour:
        "numeric",

      minute:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


function roundMoney(
  value:
    number,
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100,
  ) / 100;
}


function methodLabel(
  method:
    string,
) {
  if (
    method ===
      "cash" ||
    method ===
      "card" ||
    method ===
      "bank_transfer" ||
    method ===
      "other"
  ) {
    return paymentMethodLabel(
      method as
        PaymentMethod,
    );
  }

  return method;
}


export function ReportDocument({
  report,
  expenseReport,
  businessName,
  currencyCode,
  settings,
}: ReportDocumentProps) {
  const displayName =
    settings.displayName ??
    businessName;


  const operatingExpenses =
    expenseReport.summary.total;


  const netOperatingProfit =
    roundMoney(
      report.summary.grossProfit -
      operatingExpenses,
    );


  const paperCss =
    `${settings.paperSize} ${settings.orientation}`;


  return (
    <>

      <style>
        {`
          @media print {

            @page {
              size: ${paperCss};
              margin: 0;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }

            body * {
              visibility: hidden !important;
            }

            #nova-print-report,
            #nova-print-report * {
              visibility: visible !important;
            }

            #nova-print-report {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              min-height: 100% !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: 0 !important;
              border-radius: 0 !important;

              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            .nova-report-avoid-break {
              break-inside: avoid;
              page-break-inside: avoid;
            }
          }
        `}
      </style>


      <article
        id="nova-print-report"
        className={`mx-auto bg-white text-black shadow-xl ${
          settings.paperSize ===
          "A4"
            ? settings.orientation ===
              "portrait"
              ? "w-[210mm] min-h-[297mm]"
              : "w-[297mm] min-h-[210mm]"
            : settings.orientation ===
              "portrait"
              ? "w-[216mm] min-h-[279mm]"
              : "w-[279mm] min-h-[216mm]"
        }`}
      >

        <div className="p-[12mm]">

          {/* ================================================
              HEADER
          ================================================= */}

          <header className="flex items-start justify-between gap-8 border-b-2 border-black pb-5">

            <div>

              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">
                NOVA POS
              </p>


              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {
                  settings.title
                }
              </h1>


              <p className="mt-2 text-sm font-semibold">
                {
                  displayName
                }
              </p>


              {settings.addressLine1 && (

                <p className="mt-1 text-xs text-gray-600">
                  {
                    settings.addressLine1
                  }
                </p>

              )}


              {settings.addressLine2 && (

                <p className="text-xs text-gray-600">
                  {
                    settings.addressLine2
                  }
                </p>

              )}


              {(settings.phone ||
                settings.email) && (

                <p className="mt-1 text-xs text-gray-600">

                  {settings.phone ??
                    ""}

                  {settings.phone &&
                  settings.email
                    ? " · "
                    : ""}

                  {settings.email ??
                    ""}

                </p>

              )}

            </div>


            <div className="min-w-[190px] rounded-xl border border-gray-300 p-4 text-right">

              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">
                Reporting Period
              </p>


              <p className="mt-2 text-sm font-bold">
                {formatDate(
                  report.startDate,
                )}
              </p>


              <p className="text-xs text-gray-500">
                to
              </p>


              <p className="text-sm font-bold">
                {formatDate(
                  report.endDate,
                )}
              </p>


              <p className="mt-3 text-[9px] text-gray-500">
                Generated{" "}
                {new Intl.DateTimeFormat(
                  "en-LK",
                  {
                    dateStyle:
                      "medium",

                    timeStyle:
                      "short",
                  },
                ).format(
                  new Date(),
                )}
              </p>

            </div>

          </header>


          {/* ================================================
              FINANCIAL SUMMARY
          ================================================= */}

          {settings.showSummary && (

            <section className="nova-report-avoid-break mt-7">

              <SectionTitle>
                Financial Summary
              </SectionTitle>


              <div className="grid grid-cols-4 gap-3">

                <SummaryBox
                  label="Gross Revenue"
                  value={
                    formatSaleMoney(
                      report.summary.grossRevenue,
                      currencyCode,
                    )
                  }
                />


                <SummaryBox
                  label="Refunds"
                  value={`-${formatSaleMoney(
                    report.summary.refundAmount,
                    currencyCode,
                  )}`}
                />


                <SummaryBox
                  label="Net Revenue"
                  value={
                    formatSaleMoney(
                      report.summary.revenue,
                      currencyCode,
                    )
                  }
                  strong
                />


                <SummaryBox
                  label="COGS"
                  value={`-${formatSaleMoney(
                    report.summary.cogs,
                    currencyCode,
                  )}`}
                />


                <SummaryBox
                  label="Gross Profit"
                  value={
                    formatSaleMoney(
                      report.summary.grossProfit,
                      currencyCode,
                    )
                  }
                  strong
                />


                {settings.showOperatingExpenses && (

                  <SummaryBox
                    label="Operating Expenses"
                    value={`-${formatSaleMoney(
                      operatingExpenses,
                      currencyCode,
                    )}`}
                  />

                )}


                {settings.showNetOperatingProfit && (

                  <SummaryBox
                    label="Net Operating Profit"
                    value={
                      formatSaleMoney(
                        netOperatingProfit,
                        currencyCode,
                      )
                    }
                    strong
                  />

                )}


                <SummaryBox
                  label="Transactions"
                  value={
                    report.summary.transactions.toLocaleString()
                  }
                />

              </div>

            </section>

          )}


          {/* ================================================
              PROFIT & LOSS
          ================================================= */}

          <section className="nova-report-avoid-break mt-7">

            <SectionTitle>
              Profit & Loss
            </SectionTitle>


            <div className="rounded-xl border border-gray-300">

              <FinancialLine
                label="Gross revenue"
                value={
                  formatSaleMoney(
                    report.summary.grossRevenue,
                    currencyCode,
                  )
                }
              />


              <FinancialLine
                label="Less: refunds"
                value={`-${formatSaleMoney(
                  report.summary.refundAmount,
                  currencyCode,
                )}`}
              />


              <FinancialLine
                label="Net revenue"
                value={
                  formatSaleMoney(
                    report.summary.revenue,
                    currencyCode,
                  )
                }
                strong
              />


              <FinancialLine
                label="Less: cost of goods sold"
                value={`-${formatSaleMoney(
                  report.summary.cogs,
                  currencyCode,
                )}`}
              />


              <FinancialLine
                label="Gross profit"
                value={
                  formatSaleMoney(
                    report.summary.grossProfit,
                    currencyCode,
                  )
                }
                strong
              />


              {settings.showOperatingExpenses && (

                <FinancialLine
                  label="Less: operating expenses"
                  value={`-${formatSaleMoney(
                    operatingExpenses,
                    currencyCode,
                  )}`}
                />

              )}


              {settings.showNetOperatingProfit && (

                <div className="flex items-center justify-between border-t-2 border-black bg-gray-100 px-4 py-4">

                  <span className="text-sm font-black uppercase tracking-wide">
                    Net Operating Profit
                  </span>


                  <span className="text-xl font-black">
                    {formatSaleMoney(
                      netOperatingProfit,
                      currencyCode,
                    )}
                  </span>

                </div>

              )}

            </div>

          </section>


          {/* ================================================
              SALES TREND
          ================================================= */}

          {settings.showSalesTrend && (

            <section className="nova-report-avoid-break mt-7">

              <SectionTitle>
                Sales Trend
              </SectionTitle>


              <PrintableSalesChart
                report={
                  report
                }
                currencyCode={
                  currencyCode
                }
              />

            </section>

          )}


          {/* ================================================
              EXPENSES
          ================================================= */}

          {settings.showOperatingExpenses && (

            <section className="nova-report-avoid-break mt-7">

              <SectionTitle>
                Operating Expense Breakdown
              </SectionTitle>


              {expenseReport.categoryBreakdown.length >
              0 ? (

                <table className="w-full border-collapse text-xs">

                  <thead>

                    <tr className="bg-black text-white">

                      <th className="px-3 py-2 text-left">
                        Category
                      </th>

                      <th className="px-3 py-2 text-center">
                        Entries
                      </th>

                      <th className="px-3 py-2 text-right">
                        Amount
                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {expenseReport.categoryBreakdown.map(
                      (item) => (

                        <tr
                          key={
                            item.category
                          }
                          className="border-b border-gray-300"
                        >

                          <td className="px-3 py-2.5 font-semibold">

                            {expenseCategoryLabel(
                              item.category,
                            )}

                          </td>


                          <td className="px-3 py-2.5 text-center">
                            {
                              item.count
                            }
                          </td>


                          <td className="px-3 py-2.5 text-right font-semibold">

                            {formatSaleMoney(
                              item.amount,
                              currencyCode,
                            )}

                          </td>

                        </tr>

                      ),
                    )}

                  </tbody>


                  <tfoot>

                    <tr className="border-t-2 border-black">

                      <td
                        colSpan={
                          2
                        }
                        className="px-3 py-3 font-black"
                      >
                        TOTAL OPERATING EXPENSES
                      </td>


                      <td className="px-3 py-3 text-right text-sm font-black">

                        {formatSaleMoney(
                          operatingExpenses,
                          currencyCode,
                        )}

                      </td>

                    </tr>

                  </tfoot>

                </table>

              ) : (

                <p className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500">
                  No operating expenses were recorded during this period.
                </p>

              )}

            </section>

          )}


          {/* ================================================
              PAYMENTS + PRODUCTS
          ================================================= */}

          <div className="mt-7 grid grid-cols-2 gap-5">

            {settings.showPaymentBreakdown && (

              <section className="nova-report-avoid-break">

                <SectionTitle>
                  Payment Methods
                </SectionTitle>


                <div className="rounded-xl border border-gray-300">

                  {report.paymentBreakdown.length >
                  0 ? (

                    report.paymentBreakdown.map(
                      (
                        payment,
                        index,
                      ) => (

                        <div
                          key={
                            payment.method
                          }
                          className={`flex items-center justify-between gap-4 px-4 py-3 ${
                            index >
                            0
                              ? "border-t border-gray-200"
                              : ""
                          }`}
                        >

                          <div>

                            <p className="text-xs font-bold">
                              {methodLabel(
                                payment.method,
                              )}
                            </p>


                            <p className="mt-0.5 text-[9px] text-gray-500">
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


                          <span className="text-xs font-black">

                            {formatSaleMoney(
                              payment.amount,
                              currencyCode,
                            )}

                          </span>

                        </div>

                      ),
                    )

                  ) : (

                    <p className="p-5 text-center text-xs text-gray-500">
                      No payment activity.
                    </p>

                  )}

                </div>

              </section>

            )}


            {settings.showTopProducts && (

              <section className="nova-report-avoid-break">

                <SectionTitle>
                  Top Products
                </SectionTitle>


                <div className="rounded-xl border border-gray-300">

                  {report.topProducts.length >
                  0 ? (

                    report.topProducts.map(
                      (
                        product,
                        index,
                      ) => (

                        <div
                          key={`${product.productId ?? product.name}-${index}`}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            index >
                            0
                              ? "border-t border-gray-200"
                              : ""
                          }`}
                        >

                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black text-[9px] font-black text-white">
                            {
                              index + 1
                            }
                          </div>


                          <div className="min-w-0 flex-1">

                            <p className="truncate text-xs font-bold">
                              {
                                product.name
                              }
                            </p>


                            <p className="text-[9px] text-gray-500">
                              {
                                product.quantity
                              }{" "}
                              unit
                              {product.quantity ===
                              1
                                ? ""
                                : "s"}
                            </p>

                          </div>


                          <p className="text-right text-[10px] font-black">

                            {formatSaleMoney(
                              product.revenue,
                              currencyCode,
                            )}

                          </p>

                        </div>

                      ),
                    )

                  ) : (

                    <p className="p-5 text-center text-xs text-gray-500">
                      No product activity.
                    </p>

                  )}

                </div>

              </section>

            )}

          </div>


          {/* ================================================
              TRANSACTIONS
          ================================================= */}

          {settings.showRecentSales && (

            <section className="mt-7">

              <SectionTitle>
                Recent Sales
              </SectionTitle>


              {report.recentSales.length >
              0 ? (

                <table className="w-full border-collapse text-[9px]">

                  <thead>

                    <tr className="bg-black text-white">

                      <th className="px-2 py-2 text-left">
                        Receipt
                      </th>

                      <th className="px-2 py-2 text-left">
                        Date
                      </th>

                      <th className="px-2 py-2 text-left">
                        Customer
                      </th>

                      <th className="px-2 py-2 text-left">
                        Status
                      </th>

                      <th className="px-2 py-2 text-right">
                        Original
                      </th>

                      <th className="px-2 py-2 text-right">
                        Refund
                      </th>

                      <th className="px-2 py-2 text-right">
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
                          className="border-b border-gray-300"
                        >

                          <td className="px-2 py-2 font-bold">
                            {
                              sale.receiptNumber
                            }
                          </td>


                          <td className="px-2 py-2">
                            {formatDateTime(
                              sale.createdAt,
                            )}
                          </td>


                          <td className="px-2 py-2">
                            {
                              sale.customerName ??
                              "Walk-in"
                            }
                          </td>


                          <td className="px-2 py-2">
                            {saleStatusLabel(
                              sale.status,
                            )}
                          </td>


                          <td className="px-2 py-2 text-right">
                            {formatSaleMoney(
                              sale.total,
                              sale.currencyCode,
                            )}
                          </td>


                          <td className="px-2 py-2 text-right">
                            {sale.refundAmount >
                            0
                              ? `-${formatSaleMoney(
                                  sale.refundAmount,
                                  sale.currencyCode,
                                )}`
                              : "—"}
                          </td>


                          <td className="px-2 py-2 text-right font-black">
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

              ) : (

                <p className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500">
                  No transactions in this reporting period.
                </p>

              )}

            </section>

          )}


          {/* ================================================
              FOOTER
          ================================================= */}

          <footer className="mt-10 border-t border-gray-300 pt-4 text-center">

            <p className="text-[9px] text-gray-600">
              {
                settings.footerMessage
              }
            </p>


            <p className="mt-1 text-[8px] text-gray-400">
              NOVA POS · Financial report ·{" "}
              {
                report.startDate
              }{" "}
              to{" "}
              {
                report.endDate
              }
            </p>

          </footer>

        </div>

      </article>

    </>
  );
}


function SectionTitle({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">

      <h2 className="shrink-0 text-xs font-black uppercase tracking-[0.14em]">
        {
          children
        }
      </h2>


      <div className="h-px flex-1 bg-gray-300" />

    </div>
  );
}


function SummaryBox({
  label,
  value,
  strong = false,
}: {
  label:
    string;

  value:
    string;

  strong?:
    boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        strong
          ? "border-black bg-gray-100"
          : "border-gray-300"
      }`}
    >

      <p className="text-[8px] font-bold uppercase tracking-wider text-gray-500">
        {
          label
        }
      </p>


      <p className="mt-2 text-sm font-black">
        {
          value
        }
      </p>

    </div>
  );
}


function FinancialLine({
  label,
  value,
  strong = false,
}: {
  label:
    string;

  value:
    string;

  strong?:
    boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 border-b border-gray-200 px-4 py-3 ${
        strong
          ? "bg-gray-50 font-bold"
          : ""
      }`}
    >

      <span className="text-xs">
        {
          label
        }
      </span>


      <span className="text-xs font-black">
        {
          value
        }
      </span>

    </div>
  );
}


function PrintableSalesChart({
  report,
  currencyCode,
}: {
  report:
    DashboardReport;

  currencyCode:
    string;
}) {
  const data =
    report.dailySales;


  if (
    data.length ===
    0
  ) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500">
        No sales activity.
      </p>
    );
  }


  const maximum =
    Math.max(
      1,
      ...data.map(
        (day) =>
          day.revenue,
      ),
    );


  const shown =
    data.length >
    14
      ? data.filter(
          (
            _,
            index,
          ) =>
            index %
            Math.ceil(
              data.length /
              14,
            ) ===
            0 ||
            index ===
            data.length -
              1,
        )
      : data;


  return (
    <div className="rounded-xl border border-gray-300 p-4">

      <div className="flex h-[120px] items-end gap-2">

        {shown.map(
          (day) => {
            const height =
              day.revenue <=
              0
                ? 2
                : Math.max(
                    5,
                    day.revenue /
                    maximum *
                    100,
                  );


            return (
              <div
                key={
                  day.date
                }
                className="flex min-w-0 flex-1 flex-col items-center justify-end"
              >

                <p className="mb-1 text-[7px] font-bold">
                  {formatSaleMoney(
                    day.revenue,
                    currencyCode,
                  )}
                </p>


                <div
                  className="w-full max-w-[22px] rounded-t bg-black"
                  style={{
                    height:
                      `${height}px`,
                  }}
                />


                <p className="mt-1 text-[7px] text-gray-500">
                  {
                    day.date.slice(
                      5,
                    )
                  }
                </p>

              </div>
            );
          },
        )}

      </div>

    </div>
  );
}