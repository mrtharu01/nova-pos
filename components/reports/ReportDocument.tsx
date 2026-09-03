"use client";

import * as React from "react";

import type {
  DashboardReport,
} from "@/lib/domain/dashboard";

import type {
  ReportSettings,
} from "@/lib/domain/report-settings";

import {
  formatSaleMoney,
  paymentMethodLabel,
  saleStatusLabel,
  type PaymentMethod,
} from "@/lib/domain/sales";


type ReportDocumentProps = {
  report:
    DashboardReport;

  settings:
    ReportSettings;

  businessName:
    string;

  currencyCode:
    string;
};


function dateLabel(
  value: string,
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


function dateTimeLabel(
  value: string,
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


function paymentLabel(
  value: string,
) {
  if (
    value === "cash" ||
    value === "card" ||
    value === "bank_transfer" ||
    value === "other"
  ) {
    return paymentMethodLabel(
      value as PaymentMethod,
    );
  }


  return value;
}


export function ReportDocument({
  report,
  settings,
  businessName,
  currencyCode,
}: ReportDocumentProps) {
  const displayName =
    settings.displayName.trim() ||
    businessName;


  const landscape =
    settings.orientation ===
    "landscape";


  const pageWidth =
    settings.paperSize ===
    "letter"
      ? landscape
        ? "279mm"
        : "216mm"
      : landscape
        ? "297mm"
        : "210mm";


  const pageMinHeight =
    settings.paperSize ===
    "letter"
      ? landscape
        ? "216mm"
        : "279mm"
      : landscape
        ? "210mm"
        : "297mm";


  return (
    <>
      <style>
        {`
          @media print {

            @page {
              size: ${
                settings.paperSize ===
                "letter"
                  ? "Letter"
                  : "A4"
              } ${
                settings.orientation
              };
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
              margin: 0 !important;
              box-shadow: none !important;
              border: 0 !important;
            }

            .nova-report-section {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .nova-report-table thead {
              display: table-header-group;
            }

            .nova-report-table tr {
              break-inside: avoid;
            }
          }
        `}
      </style>


      <article
        id="nova-print-report"
        style={{
          width:
            pageWidth,

          minHeight:
            pageMinHeight,
        }}
        className="mx-auto bg-white p-[11mm] font-sans text-[10px] leading-[1.45] text-black shadow-xl"
      >

        {/* ====================================================
            HEADER
        ===================================================== */}

        <header className="border-b-2 border-black pb-5">

          <div className="flex items-start justify-between gap-8">

            <div>

              <div className="flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-black text-lg font-black text-white">
                  N
                </div>


                <div>

                  <h1 className="text-[18px] font-black uppercase tracking-tight">
                    {
                      displayName
                    }
                  </h1>


                  {settings.addressLine1 && (
                    <p className="mt-0.5 text-[9px] text-neutral-600">
                      {
                        settings.addressLine1
                      }
                    </p>
                  )}


                  {settings.addressLine2 && (
                    <p className="text-[9px] text-neutral-600">
                      {
                        settings.addressLine2
                      }
                    </p>
                  )}

                </div>

              </div>


              {(settings.phone ||
                settings.email ||
                settings.registrationNumber) && (

                <div className="mt-3 space-y-0.5 text-[8px] text-neutral-600">

                  {settings.phone && (
                    <p>
                      Tel:{" "}
                      {
                        settings.phone
                      }
                    </p>
                  )}


                  {settings.email && (
                    <p>
                      {
                        settings.email
                      }
                    </p>
                  )}


                  {settings.registrationNumber && (
                    <p>
                      Registration:{" "}
                      {
                        settings.registrationNumber
                      }
                    </p>
                  )}

                </div>

              )}

            </div>


            <div className="text-right">

              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                NOVA POS
              </p>


              <h2 className="mt-1 text-[22px] font-black uppercase tracking-tight">
                {
                  settings.reportTitle
                }
              </h2>


              <p className="mt-2 font-semibold">
                {dateLabel(
                  report.startDate,
                )}

                {" — "}

                {dateLabel(
                  report.endDate,
                )}
              </p>


              <p className="mt-1 text-[8px] text-neutral-500">
                Generated{" "}
                {dateTimeLabel(
                  new Date().toISOString(),
                )}
              </p>

            </div>

          </div>

        </header>


        {/* ====================================================
            SUMMARY
        ===================================================== */}

        <section className="nova-report-section mt-5">

          <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em]">
            Financial Summary
          </h3>


          <div className="grid grid-cols-3 gap-2">

            {settings.showGrossRevenue && (

              <Metric
                label="Gross Revenue"
                value={
                  formatSaleMoney(
                    report.summary.grossRevenue,
                    currencyCode,
                  )
                }
              />

            )}


            {settings.showRefunds && (

              <Metric
                label="Refunds"
                value={`-${formatSaleMoney(
                  report.summary.refundAmount,
                  currencyCode,
                )}`}
              />

            )}


            <Metric
              label="Net Revenue"
              value={
                formatSaleMoney(
                  report.summary.revenue,
                  currencyCode,
                )
              }
              strong
            />


            <Metric
              label="Transactions"
              value={
                report.summary.transactions.toLocaleString()
              }
            />


            <Metric
              label="Net Items Sold"
              value={
                report.summary.itemsSold.toLocaleString()
              }
            />


            {settings.showProfit && (

              <Metric
                label="Gross Profit"
                value={
                  formatSaleMoney(
                    report.summary.grossProfit,
                    currencyCode,
                  )
                }
                strong
              />

            )}

          </div>


          {settings.showCogs && (

            <div className="mt-2 flex justify-end">

              <p className="rounded-[8px] bg-neutral-100 px-3 py-2">

                <span className="text-neutral-500">
                  Cost of Goods:
                </span>

                {" "}

                <strong>
                  {formatSaleMoney(
                    report.summary.cogs,
                    currencyCode,
                  )}
                </strong>

              </p>

            </div>

          )}

        </section>


        {/* ====================================================
            CHARTS
        ===================================================== */}

        {settings.showSalesTrend && (

          <section className="nova-report-section mt-5 border-t pt-5">

            <div className="grid grid-cols-2 gap-4">

              <div>

                <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em]">
                  Net Sales Trend
                </h3>


                <ReportLineChart
                  report={
                    report
                  }
                />

              </div>


              <div>

                <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em]">
                  Daily Revenue
                </h3>


                <ReportBarChart
                  report={
                    report
                  }
                />

              </div>

            </div>

          </section>

        )}


        {/* ====================================================
            PAYMENT + PRODUCTS
        ===================================================== */}

        {(settings.showPaymentBreakdown ||
          settings.showTopProducts) && (

          <section className="nova-report-section mt-5 border-t pt-5">

            <div className="grid grid-cols-2 gap-6">

              {settings.showPaymentBreakdown && (

                <div>

                  <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em]">
                    Payment Methods
                  </h3>


                  <div className="space-y-3">

                    {report.paymentBreakdown.length >
                    0 ? (

                      report.paymentBreakdown.map(
                        (payment) => (

                          <PaymentRow
                            key={
                              payment.method
                            }
                            label={
                              paymentLabel(
                                payment.method,
                              )
                            }
                            amount={
                              formatSaleMoney(
                                payment.amount,
                                currencyCode,
                              )
                            }
                            value={
                              Math.abs(
                                payment.amount,
                              )
                            }
                            maximum={
                              Math.max(
                                1,
                                ...report.paymentBreakdown.map(
                                  (entry) =>
                                    Math.abs(
                                      entry.amount,
                                    ),
                                ),
                              )
                            }
                          />

                        ),
                      )

                    ) : (

                      <p className="text-neutral-500">
                        No payment activity.
                      </p>

                    )}

                  </div>

                </div>

              )}


              {settings.showTopProducts && (

                <div>

                  <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em]">
                    Top Products
                  </h3>


                  <table className="w-full border-collapse">

                    <thead>

                      <tr className="border-b border-black text-left text-[8px] uppercase text-neutral-500">

                        <th className="pb-2">
                          Product
                        </th>

                        <th className="pb-2 text-right">
                          Qty
                        </th>

                        <th className="pb-2 text-right">
                          Revenue
                        </th>

                      </tr>

                    </thead>


                    <tbody>

                      {report.topProducts.map(
                        (
                          product,
                          index,
                        ) => (

                          <tr
                            key={`${product.productId ?? product.name}-${index}`}
                            className="border-b border-neutral-200"
                          >

                            <td className="py-2 font-semibold">
                              {
                                product.name
                              }
                            </td>

                            <td className="py-2 text-right">
                              {
                                product.quantity
                              }
                            </td>

                            <td className="py-2 text-right font-semibold">
                              {formatSaleMoney(
                                product.revenue,
                                currencyCode,
                              )}
                            </td>

                          </tr>

                        ),
                      )}

                    </tbody>

                  </table>

                </div>

              )}

            </div>

          </section>

        )}


        {/* ====================================================
            TRANSACTIONS
        ===================================================== */}

        {settings.showTransactions && (

          <section className="mt-5 border-t pt-5">

            <h3 className="mb-3 text-[11px] font-black uppercase tracking-[0.12em]">
              Recent Transactions
            </h3>


            <table className="nova-report-table w-full border-collapse">

              <thead>

                <tr className="border-b-2 border-black text-left text-[8px] uppercase tracking-wide">

                  <th className="pb-2">
                    Receipt
                  </th>

                  <th className="pb-2">
                    Date
                  </th>

                  <th className="pb-2">
                    Customer
                  </th>

                  <th className="pb-2">
                    Status
                  </th>

                  <th className="pb-2 text-right">
                    Original
                  </th>

                  <th className="pb-2 text-right">
                    Refund
                  </th>

                  <th className="pb-2 text-right">
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
                      className="border-b border-neutral-200"
                    >

                      <td className="py-2 font-bold">
                        {
                          sale.receiptNumber
                        }
                      </td>

                      <td className="py-2">
                        {dateTimeLabel(
                          sale.createdAt,
                        )}
                      </td>

                      <td className="py-2">
                        {
                          sale.customerName ??
                          "Walk-in"
                        }
                      </td>

                      <td className="py-2">
                        {saleStatusLabel(
                          sale.status,
                        )}
                      </td>

                      <td className="py-2 text-right">
                        {formatSaleMoney(
                          sale.total,
                          sale.currencyCode,
                        )}
                      </td>

                      <td className="py-2 text-right">
                        {sale.refundAmount >
                        0
                          ? `-${formatSaleMoney(
                              sale.refundAmount,
                              sale.currencyCode,
                            )}`
                          : "—"}
                      </td>

                      <td className="py-2 text-right font-bold">
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

          </section>

        )}


        {/* ====================================================
            FOOTER
        ===================================================== */}

        <footer className="nova-report-section mt-8 border-t-2 border-black pt-4">

          <div className="flex items-end justify-between gap-8">

            <div>

              {settings.footerMessage && (

                <p className="font-semibold">
                  {
                    settings.footerMessage
                  }
                </p>

              )}


              <p className="mt-1 text-[8px] text-neutral-500">

                Reporting period:{" "}

                {dateLabel(
                  report.startDate,
                )}

                {" to "}

                {dateLabel(
                  report.endDate,
                )}

              </p>

            </div>


            {settings.showGeneratedByNova && (

              <p className="text-[8px] font-bold uppercase tracking-wider text-neutral-500">
                Generated by NOVA POS
              </p>

            )}

          </div>

        </footer>

      </article>
    </>
  );
}


/* ============================================================
   METRIC
============================================================ */

function Metric({
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
      className={`rounded-[9px] border p-3 ${
        strong
          ? "border-black bg-neutral-100"
          : "border-neutral-200"
      }`}
    >

      <p className="text-[8px] font-semibold uppercase tracking-wide text-neutral-500">
        {
          label
        }
      </p>


      <p className="mt-1 text-[14px] font-black">
        {
          value
        }
      </p>

    </div>
  );
}


/* ============================================================
   PAYMENT BAR
============================================================ */

function PaymentRow({
  label,
  amount,
  value,
  maximum,
}: {
  label:
    string;

  amount:
    string;

  value:
    number;

  maximum:
    number;
}) {
  const width =
    Math.max(
      2,
      value /
        maximum *
        100,
    );


  return (
    <div>

      <div className="mb-1 flex justify-between gap-3">

        <span className="font-semibold">
          {
            label
          }
        </span>

        <strong>
          {
            amount
          }
        </strong>

      </div>


      <div className="h-[5px] overflow-hidden rounded-full bg-neutral-200">

        <div
          className="h-full rounded-full bg-black"
          style={{
            width:
              `${width}%`,
          }}
        />

      </div>

    </div>
  );
}


/* ============================================================
   LINE CHART
============================================================ */

function ReportLineChart({
  report,
}: {
  report:
    DashboardReport;
}) {
  const values =
    report.dailySales.map(
      (day) =>
        day.revenue,
    );


  if (
    values.length ===
    0
  ) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded border text-neutral-500">
        No data
      </div>
    );
  }


  const width =
    420;

  const height =
    130;

  const padding =
    12;


  const max =
    Math.max(
      1,
      ...values,
    );


  const min =
    Math.min(
      0,
      ...values,
    );


  const range =
    Math.max(
      1,
      max -
        min,
    );


  const points =
    values.map(
      (
        value,
        index,
      ) => {
        const x =
          values.length ===
          1
            ? width /
              2
            : padding +
              index /
                (
                  values.length -
                  1
                ) *
                (
                  width -
                  padding *
                    2
                );


        const y =
          height -
          padding -
          (
            value -
            min
          ) /
            range *
            (
              height -
              padding *
                2
            );


        return {
          x,
          y,
        };
      },
    );


  const path =
    points
      .map(
        (
          point,
          index,
        ) =>
          `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
      )
      .join(" ");


  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[120px] w-full rounded border border-neutral-200"
    >

      <line
        x1="0"
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke="#d4d4d4"
      />


      <path
        d={path}
        fill="none"
        stroke="black"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />


      {points.map(
        (
          point,
          index,
        ) => (

          <circle
            key={
              index
            }
            cx={
              point.x
            }
            cy={
              point.y
            }
            r="3"
            fill="white"
            stroke="black"
            strokeWidth="2"
          />

        ),
      )}

    </svg>
  );
}


/* ============================================================
   BAR CHART
============================================================ */

function ReportBarChart({
  report,
}: {
  report:
    DashboardReport;
}) {
  const maximum =
    Math.max(
      1,
      ...report.dailySales.map(
        (day) =>
          day.revenue,
      ),
    );


  return (
    <div className="flex h-[120px] items-end gap-[3px] rounded border border-neutral-200 p-3">

      {report.dailySales.map(
        (day) => {

          const height =
            Math.max(
              3,
              Math.round(
                day.revenue /
                  maximum *
                  90,
              ),
            );


          return (
            <div
              key={
                day.date
              }
              className="flex h-full min-w-0 flex-1 items-end"
              title={
                day.date
              }
            >

              <div
                className="w-full bg-black"
                style={{
                  height:
                    `${height}%`,
                }}
              />

            </div>
          );
        },
      )}

    </div>
  );
}