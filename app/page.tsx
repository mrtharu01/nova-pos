"use client";

import * as React from "react";
import Link from "next/link";

import {
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarDays,
  CreditCard,
  Landmark,
  PackageSearch,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  useDashboardReport,
} from "@/hooks/use-dashboard-report";

import type {
  DashboardDailySale,
  DashboardPayment,
  DashboardRangePreset,
  DashboardTopProduct,
} from "@/lib/domain/dashboard";

import {
  formatSaleMoney,
  paymentMethodLabel,
  saleStatusLabel,
  type SaleStatus,
} from "@/lib/domain/sales";


/* ============================================================
   DATE HELPERS
============================================================ */

function formatRangeDate(
  value: string,
) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-LK",
    {
      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}


function formatChartDate(
  value: string,
) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "en-LK",
    {
      month:
        "short",

      day:
        "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}


function formatDateTime(
  value: string,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-LK",
    {
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


/* ============================================================
   STATUS
============================================================ */

function statusClass(
  status: SaleStatus,
) {
  switch (status) {
    case "completed":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "partially_refunded":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";

    case "refunded":
      return "border-muted-foreground/20 bg-muted text-muted-foreground";

    case "voided":
      return "border-destructive/20 bg-destructive/10 text-destructive";
  }
}


/* ============================================================
   RANGE LABEL
============================================================ */

function rangeLabel(
  preset: DashboardRangePreset,
) {
  switch (preset) {
    case "today":
      return "Today";

    case "7d":
      return "Last 7 Days";

    case "30d":
      return "Last 30 Days";
  }
}


/* ============================================================
   CHART HELPERS
============================================================ */

type ChartPoint = {
  x: number;
  y: number;
};


function buildSmoothPath(
  points: ChartPoint[],
) {
  if (
    points.length ===
    0
  ) {
    return "";
  }

  if (
    points.length ===
    1
  ) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path =
    `M ${points[0].x} ${points[0].y}`;


  for (
    let index = 0;
    index <
    points.length - 1;
    index++
  ) {
    const current =
      points[index];

    const next =
      points[index + 1];

    const previous =
      points[index - 1] ??
      current;

    const afterNext =
      points[index + 2] ??
      next;


    const control1X =
      current.x +
      (
        next.x -
        previous.x
      ) / 6;


    const control1Y =
      current.y +
      (
        next.y -
        previous.y
      ) / 6;


    const control2X =
      next.x -
      (
        afterNext.x -
        current.x
      ) / 6;


    const control2Y =
      next.y -
      (
        afterNext.y -
        current.y
      ) / 6;


    path +=
      ` C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${next.x} ${next.y}`;
  }


  return path;
}


function compactMoney(
  value: number,
  currency: string,
) {
  const formatted =
    new Intl.NumberFormat(
      "en-LK",
      {
        notation:
          "compact",

        maximumFractionDigits:
          1,
      },
    ).format(
      value,
    );


  return `${currency} ${formatted}`;
}


/* ============================================================
   PAGE
============================================================ */

export default function DashboardPage() {
  const {
    business,
  } =
    useCurrentBusiness();


  const [
    preset,
    setPreset,
  ] =
    React.useState<
      DashboardRangePreset
    >(
      "today",
    );


  const {
    report,
    loading,
    error,
    refresh,
  } =
    useDashboardReport(
      business?.id,
      preset,
    );


  const currency =
    business?.currency_code ??
    report?.recentSales[0]
      ?.currencyCode ??
    "LKR";


  const summary =
    report?.summary ?? {
      revenue:
        0,

      transactions:
        0,

      itemsSold:
        0,

      averageSale:
        0,

      grossProfit:
        0,
    };


  const profitMargin =
    summary.revenue > 0
      ? (
          summary.grossProfit /
          summary.revenue
        ) * 100
      : 0;


  return (
    <AppLayout title="Dashboard">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

        <div>

          <h1 className="text-2xl font-bold tracking-tight">
            Dashboard
          </h1>


          <p className="mt-1 text-sm text-muted-foreground">

            {business?.name
              ? `${business.name} · `
              : ""}

            {rangeLabel(
              preset,
            )}

          </p>


          {report && (

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">

              <CalendarDays className="h-3.5 w-3.5" />

              <span>

                {formatRangeDate(
                  report.startDate,
                )}

                {report.startDate !==
                  report.endDate && (
                  <>
                    {" "}
                    –{" "}
                    {formatRangeDate(
                      report.endDate,
                    )}
                  </>
                )}

              </span>


              <span>
                ·
              </span>


              <span>
                {report.timezone}
              </span>

            </div>

          )}

        </div>


        {/* ====================================================
            RANGE CONTROLS
        ===================================================== */}

        <div className="flex flex-wrap items-center gap-2">

          <div className="flex rounded-[14px] border bg-card p-1">

            <RangeButton
              active={
                preset ===
                "today"
              }
              label="Today"
              onClick={() =>
                setPreset(
                  "today",
                )
              }
            />


            <RangeButton
              active={
                preset ===
                "7d"
              }
              label="7 Days"
              onClick={() =>
                setPreset(
                  "7d",
                )
              }
            />


            <RangeButton
              active={
                preset ===
                "30d"
              }
              label="30 Days"
              onClick={() =>
                setPreset(
                  "30d",
                )
              }
            />

          </div>


          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-[14px]"
            disabled={
              loading
            }
            onClick={
              refresh
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

        </div>

      </div>


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (

        <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />


          <div>

            <p className="font-semibold">
              Dashboard could not be loaded
            </p>


            <p className="mt-1">
              {error}
            </p>

          </div>

        </div>

      )}


      {/* ======================================================
          LOADING
      ======================================================= */}

      {loading &&
      !report ? (

        <DashboardSkeleton />

      ) : (

        <>

          {/* ==================================================
              KPI CARDS
          =================================================== */}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

            <MetricCard
              title="Revenue"
              value={
                formatSaleMoney(
                  summary.revenue,
                  currency,
                )
              }
              subtitle={
                `${summary.transactions} completed transaction${
                  summary.transactions ===
                  1
                    ? ""
                    : "s"
                }`
              }
              icon={
                <WalletCards className="h-5 w-5" />
              }
            />


            <MetricCard
              title="Transactions"
              value={
                summary.transactions
                  .toLocaleString(
                    "en-LK",
                  )
              }
              subtitle="Completed sales"
              icon={
                <ReceiptText className="h-5 w-5" />
              }
            />


            <MetricCard
              title="Items Sold"
              value={
                summary.itemsSold
                  .toLocaleString(
                    "en-LK",
                  )
              }
              subtitle="Units across all sales"
              icon={
                <ShoppingBag className="h-5 w-5" />
              }
            />


            <MetricCard
              title="Average Sale"
              value={
                formatSaleMoney(
                  summary.averageSale,
                  currency,
                )
              }
              subtitle="Revenue per transaction"
              icon={
                <TrendingUp className="h-5 w-5" />
              }
            />


            <MetricCard
              title="Gross Profit"
              value={
                formatSaleMoney(
                  summary.grossProfit,
                  currency,
                )
              }
              subtitle={
                summary.revenue >
                0
                  ? `${profitMargin.toFixed(
                      1,
                    )}% estimated margin`
                  : "Based on stored product cost"
              }
              icon={
                <Banknote className="h-5 w-5" />
              }
            />

          </div>


          {/* ==================================================
              SALES TREND + PAYMENTS
          =================================================== */}

          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

            <Card className="overflow-hidden rounded-[24px]">

              <CardHeader>

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <CardTitle>
                      Sales Performance
                    </CardTitle>


                    <p className="mt-1 text-xs text-muted-foreground">
                      Revenue trend and activity across the selected period.
                    </p>

                  </div>


                  <div className="text-right">

                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Period Revenue
                    </p>


                    <p className="mt-1 text-lg font-bold">
                      {formatSaleMoney(
                        summary.revenue,
                        currency,
                      )}
                    </p>

                  </div>

                </div>

              </CardHeader>


              <CardContent>

                <SalesTrendChart
                  data={
                    report?.dailySales ??
                    []
                  }
                  currency={
                    currency
                  }
                />

              </CardContent>

            </Card>


            <Card className="rounded-[24px]">

              <CardHeader>

                <CardTitle>
                  Payment Breakdown
                </CardTitle>


                <p className="text-xs text-muted-foreground">
                  Completed payments for this period.
                </p>

              </CardHeader>


              <CardContent>

                <PaymentBreakdown
                  payments={
                    report?.paymentBreakdown ??
                    []
                  }
                  currency={
                    currency
                  }
                />

              </CardContent>

            </Card>

          </div>


          {/* ==================================================
              TOP PRODUCTS + LOW STOCK
          =================================================== */}

          <div className="mt-5 grid gap-5 lg:grid-cols-2">

            {/* ===============================================
                TOP PRODUCTS
            ================================================ */}

            <Card className="rounded-[24px]">

              <CardHeader>

                <div className="flex items-center justify-between gap-3">

                  <div>

                    <CardTitle>
                      Top Products
                    </CardTitle>


                    <p className="mt-1 text-xs text-muted-foreground">
                      Highest revenue products in this period.
                    </p>

                  </div>


                  <PackageSearch className="h-5 w-5 text-muted-foreground" />

                </div>

              </CardHeader>


              <CardContent>

                <TopProducts
                  products={
                    report?.topProducts ??
                    []
                  }
                  currency={
                    currency
                  }
                />

              </CardContent>

            </Card>


            {/* ===============================================
                LOW STOCK
            ================================================ */}

            <Card className="rounded-[24px]">

              <CardHeader>

                <div className="flex items-center justify-between gap-3">

                  <div>

                    <CardTitle>
                      Low Stock
                    </CardTitle>


                    <p className="mt-1 text-xs text-muted-foreground">
                      Current default-location inventory.
                    </p>

                  </div>


                  <Boxes className="h-5 w-5 text-muted-foreground" />

                </div>

              </CardHeader>


              <CardContent>

                {report &&
                report.lowStock.length >
                  0 ? (

                  <div className="space-y-2">

                    {report.lowStock.map(
                      (item) => (

                        <div
                          key={
                            item.variantId
                          }
                          className="flex items-center justify-between gap-4 rounded-[16px] border bg-muted/20 p-4"
                        >

                          <div className="min-w-0">

                            <p className="truncate font-semibold">
                              {
                                item.productName
                              }
                            </p>


                            <p className="mt-1 truncate text-xs text-muted-foreground">

                              {
                                item.variantName
                              }

                              {item.sku && (
                                <>
                                  {" "}
                                  ·{" "}
                                  {
                                    item.sku
                                  }
                                </>
                              )}

                            </p>

                          </div>


                          <div className="shrink-0 text-right">

                            <p
                              className={`text-lg font-bold ${
                                item.stock ===
                                0
                                  ? "text-destructive"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {
                                item.stock
                              }
                            </p>


                            <p className="text-[10px] text-muted-foreground">
                              threshold{" "}
                              {
                                item.threshold
                              }
                            </p>

                          </div>

                        </div>

                      ),
                    )}


                    <Link
                      href="/inventory"
                      className="mt-3 inline-flex items-center text-sm font-semibold text-primary hover:underline"
                    >
                      Open Inventory

                      <ArrowUpRight className="ml-1 h-4 w-4" />
                    </Link>

                  </div>

                ) : (

                  <EmptyState
                    title="Stock levels look healthy"
                    description="No active variant is currently at or below its low-stock threshold."
                  />

                )}

              </CardContent>

            </Card>

          </div>


          {/* ==================================================
              RECENT SALES
          =================================================== */}

          <Card className="mt-5 overflow-hidden rounded-[24px]">

            <CardHeader>

              <div className="flex items-center justify-between gap-3">

                <div>

                  <CardTitle>
                    Recent Transactions
                  </CardTitle>


                  <p className="mt-1 text-xs text-muted-foreground">
                    Most recent sales inside the selected reporting period.
                  </p>

                </div>


                <Link
                  href="/sales"
                  className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
                >
                  View All

                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>

              </div>

            </CardHeader>


            <CardContent className="p-0">

              {report &&
              report.recentSales.length >
                0 ? (

                <div className="overflow-x-auto">

                  <Table>

                    <TableHeader>

                      <TableRow>

                        <TableHead>
                          Receipt
                        </TableHead>

                        <TableHead>
                          Date
                        </TableHead>

                        <TableHead>
                          Customer
                        </TableHead>

                        <TableHead>
                          Items
                        </TableHead>

                        <TableHead>
                          Status
                        </TableHead>

                        <TableHead className="text-right">
                          Total
                        </TableHead>

                        <TableHead className="w-[90px]" />

                      </TableRow>

                    </TableHeader>


                    <TableBody>

                      {report.recentSales.map(
                        (sale) => (

                          <TableRow
                            key={
                              sale.id
                            }
                          >

                            <TableCell className="font-semibold">
                              {
                                sale.receiptNumber
                              }
                            </TableCell>


                            <TableCell className="text-muted-foreground">
                              {formatDateTime(
                                sale.createdAt,
                              )}
                            </TableCell>


                            <TableCell>
                              {
                                sale.customerName ??
                                "Walk-in"
                              }
                            </TableCell>


                            <TableCell>
                              {
                                sale.itemQuantityTotal
                              }
                            </TableCell>


                            <TableCell>

                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                  statusClass(
                                    sale.status,
                                  )
                                }`}
                              >
                                {saleStatusLabel(
                                  sale.status,
                                )}
                              </span>

                            </TableCell>


                            <TableCell className="text-right font-semibold">

                              {formatSaleMoney(
                                sale.total,
                                sale.currencyCode,
                              )}

                            </TableCell>


                            <TableCell className="text-right">

                              <Link
                                href={`/sales/details?sale=${encodeURIComponent(
                                  sale.id,
                                )}`}
                                className="inline-flex h-9 items-center justify-center rounded-[12px] border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                              >
                                View

                                <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                              </Link>

                            </TableCell>

                          </TableRow>

                        ),
                      )}

                    </TableBody>

                  </Table>

                </div>

              ) : (

                <div className="p-8">

                  <EmptyState
                    title="No transactions in this period"
                    description="Complete a sale in NOVA or select a wider reporting range."
                  />

                </div>

              )}

            </CardContent>

          </Card>

        </>

      )}

    </AppLayout>
  );
}


/* ============================================================
   RANGE BUTTON
============================================================ */

function RangeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;

  label: string;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`h-9 rounded-[10px] px-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}


/* ============================================================
   KPI CARD
============================================================ */

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;

  value: string;

  subtitle: string;

  icon: React.ReactNode;
}) {
  return (
    <Card className="rounded-[24px]">

      <CardContent className="p-5">

        <div className="flex items-start justify-between gap-4">

          <div className="min-w-0">

            <p className="text-xs font-medium text-muted-foreground">
              {title}
            </p>


            <p className="mt-2 truncate text-xl font-bold tracking-tight">
              {value}
            </p>


            <p className="mt-1 truncate text-[11px] text-muted-foreground">
              {subtitle}
            </p>

          </div>


          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-muted">
            {icon}
          </div>

        </div>

      </CardContent>

    </Card>
  );
}


/* ============================================================
   SMOOTH INFOGRAPHIC SALES TREND
============================================================ */

function SalesTrendChart({
  data,
  currency,
}: {
  data: DashboardDailySale[];

  currency: string;
}) {
  const [
    hoveredIndex,
    setHoveredIndex,
  ] =
    React.useState<
      number | null
    >(null);


  if (
    data.length ===
    0
  ) {
    return (
      <EmptyState
        title="No sales data"
        description="No completed sales were found for this period."
      />
    );
  }


  /* ==========================================================
     SUMMARY
  ========================================================== */

  const totalRevenue =
    data.reduce(
      (
        total,
        day,
      ) =>
        total +
        day.revenue,
      0,
    );


  const totalTransactions =
    data.reduce(
      (
        total,
        day,
      ) =>
        total +
        day.transactions,
      0,
    );


  const totalItems =
    data.reduce(
      (
        total,
        day,
      ) =>
        total +
        day.itemsSold,
      0,
    );


  const averageRevenue =
    data.length >
    0
      ? totalRevenue /
        data.length
      : 0;


  const activeDays =
    data.filter(
      (day) =>
        day.revenue >
        0,
    ).length;


  const bestDay =
    data.reduce(
      (
        best,
        day,
      ) =>
        day.revenue >
        best.revenue
          ? day
          : best,
      data[0],
    );


  const rawMaxRevenue =
    Math.max(
      ...data.map(
        (day) =>
          day.revenue,
      ),
      1,
    );


  /*
   * Small headroom makes peaks
   * look cleaner instead of touching
   * the top of the chart.
   */

  const chartCeiling =
    rawMaxRevenue *
    1.15;


  /* ==========================================================
     SVG DIMENSIONS
  ========================================================== */

  const width =
    1000;

  const height =
    330;


  const padding = {
    top:
      28,

    right:
      28,

    bottom:
      52,

    left:
      82,
  };


  const chartWidth =
    width -
    padding.left -
    padding.right;


  const chartHeight =
    height -
    padding.top -
    padding.bottom;


  const baselineY =
    padding.top +
    chartHeight;


  /* ==========================================================
     POINTS
  ========================================================== */

  const points:
    ChartPoint[] =
      data.map(
        (
          day,
          index,
        ) => {
          const x =
            data.length ===
            1
              ? padding.left +
                chartWidth /
                  2
              : padding.left +
                (
                  index /
                  (
                    data.length -
                    1
                  )
                ) *
                  chartWidth;


          const y =
            padding.top +
            chartHeight -
            (
              day.revenue /
              chartCeiling
            ) *
              chartHeight;


          return {
            x,
            y,
          };
        },
      );


  const linePath =
    buildSmoothPath(
      points,
    );


  const areaPath =
    points.length >
    1
      ? `${linePath} L ${
          points[
            points.length -
              1
          ].x
        } ${baselineY} L ${
          points[0].x
        } ${baselineY} Z`
      : "";


  /* ==========================================================
     DATE LABEL FREQUENCY
  ========================================================== */

  const labelEvery =
    data.length <=
    7
      ? 1
      : data.length <=
        14
        ? 2
        : 5;


  const hoveredDay =
    hoveredIndex !==
    null
      ? data[
          hoveredIndex
        ]
      : null;


  const hoveredPoint =
    hoveredIndex !==
    null
      ? points[
          hoveredIndex
        ]
      : null;


  const singlePoint =
    data.length ===
    1;


  return (
    <div className="space-y-4">

      {/* ======================================================
          INFOGRAPHIC SUMMARY
      ======================================================= */}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">

        <TrendStat
          label="Best Day"
          value={
            formatChartDate(
              bestDay.date,
            )
          }
          detail={
            formatSaleMoney(
              bestDay.revenue,
              currency,
            )
          }
        />


        <TrendStat
          label="Daily Average"
          value={
            compactMoney(
              averageRevenue,
              currency,
            )
          }
          detail="per calendar day"
        />


        <TrendStat
          label="Active Days"
          value={`${activeDays} / ${data.length}`}
          detail="days with revenue"
        />


        <TrendStat
          label="Activity"
          value={`${totalTransactions} sales`}
          detail={`${totalItems} items sold`}
        />

      </div>


      {/* ======================================================
          GRAPH CONTAINER
      ======================================================= */}

      <div className="overflow-hidden rounded-[20px] border bg-gradient-to-b from-primary/[0.045] via-primary/[0.015] to-transparent">

        {/* ====================================================
            INTERACTIVE INFO STRIP
        ===================================================== */}

        <div className="flex min-h-[68px] items-center justify-between gap-4 border-b px-4 py-3">

          {hoveredDay ? (

            <>

              <div>

                <p className="text-xs font-medium text-muted-foreground">
                  {formatChartDate(
                    hoveredDay.date,
                  )}
                </p>


                <p className="mt-0.5 text-xl font-bold tracking-tight">
                  {formatSaleMoney(
                    hoveredDay.revenue,
                    currency,
                  )}
                </p>

              </div>


              <div className="flex gap-6 text-right">

                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Sales
                  </p>


                  <p className="mt-1 text-sm font-bold">
                    {
                      hoveredDay.transactions
                    }
                  </p>

                </div>


                <div>

                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Items
                  </p>


                  <p className="mt-1 text-sm font-bold">
                    {
                      hoveredDay.itemsSold
                    }
                  </p>

                </div>

              </div>

            </>

          ) : (

            <>

              <div>

                <p className="text-xs font-medium text-muted-foreground">
                  Total revenue
                </p>


                <p className="mt-0.5 text-xl font-bold tracking-tight">
                  {formatSaleMoney(
                    totalRevenue,
                    currency,
                  )}
                </p>

              </div>


              <div className="hidden text-right sm:block">

                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Explore
                </p>


                <p className="mt-1 text-xs text-muted-foreground">
                  Hover over the curve
                </p>

              </div>

            </>

          )}

        </div>


        {/* ====================================================
            SVG GRAPH
        ===================================================== */}

        <div className="overflow-x-auto">

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block min-w-[650px] w-full text-primary"
            role="img"
            aria-label="Sales revenue trend"
            onMouseLeave={() =>
              setHoveredIndex(
                null,
              )
            }
          >

            {/* ================================================
                DEFINITIONS
            ================================================= */}

            <defs>

              <linearGradient
                id="nova-dashboard-sales-area"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >

                <stop
                  offset="0%"
                  stopColor="currentColor"
                  stopOpacity="0.28"
                />


                <stop
                  offset="45%"
                  stopColor="currentColor"
                  stopOpacity="0.10"
                />


                <stop
                  offset="100%"
                  stopColor="currentColor"
                  stopOpacity="0"
                />

              </linearGradient>


              <filter
                id="nova-dashboard-line-glow"
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
              >

                <feGaussianBlur
                  stdDeviation="2"
                  result="blur"
                />


                <feMerge>

                  <feMergeNode
                    in="blur"
                  />


                  <feMergeNode
                    in="SourceGraphic"
                  />

                </feMerge>

              </filter>

            </defs>


            {/* ================================================
                HORIZONTAL GRID
            ================================================= */}

            {Array.from({
              length:
                5,
            }).map(
              (
                _,
                index,
              ) => {
                const percent =
                  index /
                  4;


                const y =
                  padding.top +
                  chartHeight *
                    percent;


                const value =
                  chartCeiling *
                  (
                    1 -
                    percent
                  );


                return (
                  <g
                    key={
                      index
                    }
                  >

                    <line
                      x1={
                        padding.left
                      }
                      x2={
                        width -
                        padding.right
                      }
                      y1={
                        y
                      }
                      y2={
                        y
                      }
                      stroke="currentColor"
                      strokeOpacity="0.075"
                      strokeDasharray="5 7"
                    />


                    <text
                      x={
                        padding.left -
                        14
                      }
                      y={
                        y +
                        4
                      }
                      textAnchor="end"
                      fill="currentColor"
                      opacity="0.55"
                      fontSize="10"
                    >
                      {compactMoney(
                        value,
                        currency,
                      )}
                    </text>

                  </g>
                );
              },
            )}


            {/* ================================================
                AVERAGE LINE
            ================================================= */}

            {averageRevenue >
              0 && (

              <>

                <line
                  x1={
                    padding.left
                  }
                  x2={
                    width -
                    padding.right
                  }
                  y1={
                    padding.top +
                    chartHeight -
                    (
                      averageRevenue /
                      chartCeiling
                    ) *
                      chartHeight
                  }
                  y2={
                    padding.top +
                    chartHeight -
                    (
                      averageRevenue /
                      chartCeiling
                    ) *
                      chartHeight
                  }
                  stroke="currentColor"
                  strokeOpacity="0.22"
                  strokeDasharray="3 7"
                />


                <text
                  x={
                    width -
                    padding.right
                  }
                  y={
                    padding.top +
                    chartHeight -
                    (
                      averageRevenue /
                      chartCeiling
                    ) *
                      chartHeight -
                    8
                  }
                  textAnchor="end"
                  fill="currentColor"
                  fontSize="9"
                  opacity="0.65"
                >
                  DAILY AVG
                </text>

              </>

            )}


            {/* ================================================
                AREA FILL
            ================================================= */}

            {!singlePoint && (

              <path
                d={
                  areaPath
                }
                fill="url(#nova-dashboard-sales-area)"
                pointerEvents="none"
              />

            )}


            {/* ================================================
                SMOOTH CURVED LINE
            ================================================= */}

            {!singlePoint && (

              <path
                d={
                  linePath
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#nova-dashboard-line-glow)"
                pointerEvents="none"
              />

            )}


            {/* ================================================
                SINGLE-DAY LINE
            ================================================= */}

            {singlePoint && (

              <line
                x1={
                  padding.left
                }
                x2={
                  width -
                  padding.right
                }
                y1={
                  points[0].y
                }
                y2={
                  points[0].y
                }
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeOpacity="0.45"
              />

            )}


            {/* ================================================
                HOVER GUIDE
            ================================================= */}

            {hoveredPoint && (

              <line
                x1={
                  hoveredPoint.x
                }
                x2={
                  hoveredPoint.x
                }
                y1={
                  padding.top
                }
                y2={
                  baselineY
                }
                stroke="currentColor"
                strokeOpacity="0.18"
                strokeDasharray="4 6"
                pointerEvents="none"
              />

            )}


            {/* ================================================
                DATA POINTS + HIT AREAS
            ================================================= */}

            {points.map(
              (
                point,
                index,
              ) => {
                const isHovered =
                  hoveredIndex ===
                  index;


                const hasRevenue =
                  data[
                    index
                  ].revenue >
                  0;


                const hitWidth =
                  data.length ===
                  1
                    ? 220
                    : Math.max(
                        24,
                        chartWidth /
                          data.length,
                      );


                return (
                  <g
                    key={
                      data[
                        index
                      ].date
                    }
                    onMouseEnter={() =>
                      setHoveredIndex(
                        index,
                      )
                    }
                    className="cursor-crosshair"
                  >

                    {/* INVISIBLE INTERACTION ZONE */}

                    <rect
                      x={
                        point.x -
                        hitWidth /
                          2
                      }
                      y={
                        padding.top
                      }
                      width={
                        hitWidth
                      }
                      height={
                        chartHeight
                      }
                      fill="transparent"
                    />


                    {/* HOVER HALO */}

                    {isHovered && (

                      <circle
                        cx={
                          point.x
                        }
                        cy={
                          point.y
                        }
                        r="13"
                        fill="currentColor"
                        opacity="0.12"
                        pointerEvents="none"
                      />

                    )}


                    {/* POINT */}

                    <circle
                      cx={
                        point.x
                      }
                      cy={
                        point.y
                      }
                      r={
                        isHovered
                          ? 6
                          : hasRevenue
                            ? 4
                            : 2
                      }
                      fill="currentColor"
                      opacity={
                        hasRevenue
                          ? 1
                          : 0.28
                      }
                      stroke="var(--background)"
                      strokeWidth={
                        isHovered
                          ? 3
                          : 2
                      }
                      pointerEvents="none"
                    />

                  </g>
                );
              },
            )}


            {/* ================================================
                X AXIS LABELS
            ================================================= */}

            {data.map(
              (
                row,
                index,
              ) => {

                if (
                  index %
                    labelEvery !==
                    0 &&
                  index !==
                    data.length -
                      1
                ) {
                  return null;
                }


                return (
                  <text
                    key={
                      row.date
                    }
                    x={
                      points[
                        index
                      ].x
                    }
                    y={
                      height -
                      16
                    }
                    textAnchor="middle"
                    fill="currentColor"
                    opacity="0.6"
                    fontSize="10"
                  >
                    {formatChartDate(
                      row.date,
                    )}
                  </text>
                );
              },
            )}

          </svg>

        </div>


        {/* ====================================================
            SINGLE DAY NOTE
        ===================================================== */}

        {singlePoint && (

          <div className="border-t px-4 py-3 text-center text-[10px] text-muted-foreground">

            Today currently contains one daily reporting point.
            The detailed Reports view can later show hourly sales activity.

          </div>

        )}

      </div>

    </div>
  );
}


/* ============================================================
   TREND STAT
============================================================ */

function TrendStat({
  label,
  value,
  detail,
}: {
  label: string;

  value: string;

  detail: string;
}) {
  return (
    <div className="rounded-[16px] border bg-muted/20 p-3">

      <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
        {label}
      </p>


      <p className="mt-1.5 truncate text-sm font-bold">
        {value}
      </p>


      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {detail}
      </p>

    </div>
  );
}


/* ============================================================
   PAYMENT BREAKDOWN
============================================================ */

function PaymentBreakdown({
  payments,
  currency,
}: {
  payments: DashboardPayment[];

  currency: string;
}) {
  if (
    payments.length ===
    0
  ) {
    return (
      <EmptyState
        title="No payments yet"
        description="Completed payment totals will appear here."
      />
    );
  }


  const total =
    payments.reduce(
      (
        result,
        payment,
      ) =>
        result +
        payment.amount,
      0,
    );


  return (
    <div className="space-y-4">

      {payments.map(
        (payment) => {
          const percent =
            total > 0
              ? (
                  payment.amount /
                  total
                ) * 100
              : 0;


          return (
            <div
              key={
                payment.method
              }
            >

              <div className="mb-2 flex items-center justify-between gap-3">

                <div className="flex min-w-0 items-center gap-2">

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-muted">

                    <PaymentIcon
                      method={
                        payment.method
                      }
                    />

                  </div>


                  <div className="min-w-0">

                    <p className="truncate text-sm font-semibold">

                      {paymentMethodLabel(
                        payment.method as
                          | "cash"
                          | "card"
                          | "bank_transfer"
                          | "other",
                      )}

                    </p>


                    <p className="text-[10px] text-muted-foreground">

                      {
                        payment.transactions
                      }{" "}
                      transaction
                      {
                        payment.transactions ===
                        1
                          ? ""
                          : "s"
                      }

                    </p>

                  </div>

                </div>


                <div className="shrink-0 text-right">

                  <p className="text-sm font-semibold">

                    {formatSaleMoney(
                      payment.amount,
                      currency,
                    )}

                  </p>


                  <p className="text-[10px] text-muted-foreground">

                    {percent.toFixed(
                      1,
                    )}
                    %

                  </p>

                </div>

              </div>


              <div className="h-2 overflow-hidden rounded-full bg-muted">

                <div
                  style={{
                    width:
                      `${Math.min(
                        100,
                        Math.max(
                          0,
                          percent,
                        ),
                      )}%`,
                  }}
                  className="h-full rounded-full bg-primary"
                />

              </div>

            </div>
          );
        },
      )}

    </div>
  );
}


/* ============================================================
   PAYMENT ICON
============================================================ */

function PaymentIcon({
  method,
}: {
  method: string;
}) {
  switch (method) {
    case "cash":
      return (
        <Banknote className="h-4 w-4" />
      );

    case "card":
      return (
        <CreditCard className="h-4 w-4" />
      );

    case "bank_transfer":
      return (
        <Landmark className="h-4 w-4" />
      );

    default:
      return (
        <WalletCards className="h-4 w-4" />
      );
  }
}


/* ============================================================
   TOP PRODUCTS
============================================================ */

function TopProducts({
  products,
  currency,
}: {
  products: DashboardTopProduct[];

  currency: string;
}) {
  if (
    products.length ===
    0
  ) {
    return (
      <EmptyState
        title="No product sales yet"
        description="Your best-selling products will appear here once sales are completed."
      />
    );
  }


  const highestRevenue =
    Math.max(
      ...products.map(
        (product) =>
          product.revenue,
      ),
      1,
    );


  return (
    <div className="space-y-3">

      {products.map(
        (
          product,
          index,
        ) => {
          const percent =
            (
              product.revenue /
              highestRevenue
            ) * 100;


          return (
            <div
              key={
                product.productId ??
                `${product.name}-${index}`
              }
              className="rounded-[16px] border bg-muted/20 p-4"
            >

              <div className="flex items-start justify-between gap-4">

                <div className="flex min-w-0 items-start gap-3">

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-background text-xs font-bold">

                    {index + 1}

                  </div>


                  <div className="min-w-0">

                    <p className="truncate font-semibold">
                      {
                        product.name
                      }
                    </p>


                    <p className="mt-1 text-xs text-muted-foreground">

                      {
                        product.quantity
                      }{" "}
                      unit
                      {
                        product.quantity ===
                        1
                          ? ""
                          : "s"
                      }{" "}
                      sold

                    </p>

                  </div>

                </div>


                <p className="shrink-0 text-sm font-bold">

                  {formatSaleMoney(
                    product.revenue,
                    currency,
                  )}

                </p>

              </div>


              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">

                <div
                  style={{
                    width:
                      `${percent}%`,
                  }}
                  className="h-full rounded-full bg-primary"
                />

              </div>

            </div>
          );
        },
      )}

    </div>
  );
}


/* ============================================================
   EMPTY STATE
============================================================ */

function EmptyState({
  title,
  description,
}: {
  title: string;

  description: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center text-center">

      <PackageSearch className="h-7 w-7 text-muted-foreground" />


      <p className="mt-3 font-semibold">
        {title}
      </p>


      <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
        {description}
      </p>

    </div>
  );
}


/* ============================================================
   INITIAL SKELETON
============================================================ */

function DashboardSkeleton() {
  return (
    <div className="space-y-5">

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

        {Array.from({
          length:
            5,
        }).map(
          (
            _,
            index,
          ) => (

            <Card
              key={
                index
              }
              className="rounded-[24px]"
            >

              <CardContent className="p-5">

                <div className="h-3 w-24 animate-pulse rounded bg-muted" />

                <div className="mt-4 h-7 w-32 animate-pulse rounded bg-muted" />

                <div className="mt-3 h-3 w-28 animate-pulse rounded bg-muted" />

              </CardContent>

            </Card>

          ),
        )}

      </div>


      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

        <Card className="rounded-[24px]">

          <CardContent className="p-6">

            <div className="h-80 animate-pulse rounded-[20px] bg-muted" />

          </CardContent>

        </Card>


        <Card className="rounded-[24px]">

          <CardContent className="p-6">

            <div className="h-80 animate-pulse rounded-[20px] bg-muted" />

          </CardContent>

        </Card>

      </div>

    </div>
  );
}