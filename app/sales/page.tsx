"use client";

import * as React from "react";

import Link from "next/link";

import {
  ArrowUpRight,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
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
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

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
  useSales,
} from "@/hooks/use-sales";

import {
  formatSaleMoney,
  paymentMethodLabel,
  saleStatusLabel,
  type SaleStatus,
} from "@/lib/domain/sales";


function formatDate(
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
    new Date(value),
  );
}


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


export default function SalesPage() {
  const {
    business,
  } =
    useCurrentBusiness();


  const {
    sales,
    loading,
    error,
    refresh,
  } =
    useSales();


  const [
    search,
    setSearch,
  ] =
    React.useState("");


  const filtered =
    React.useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();


        if (!term) {
          return sales;
        }


        return sales.filter(
          (sale) => {
            const payment =
              sale.paymentMethods
                .map(
                  paymentMethodLabel,
                )
                .join(" ")
                .toLowerCase();


            return (
              sale.receiptNumber
                .toLowerCase()
                .includes(term)

              ||

              sale.customerName
                ?.toLowerCase()
                .includes(term)

              ||

              sale.customerEmail
                ?.toLowerCase()
                .includes(term)

              ||

              sale.customerPhone
                ?.toLowerCase()
                .includes(term)

              ||

              payment.includes(
                term,
              )
            );
          },
        );
      },

      [
        sales,
        search,
      ],
    );


  const salesValue =
    React.useMemo(
      () =>
        sales

          .filter(
            (sale) =>
              sale.status ===
                "completed"
              ||
              sale.status ===
                "partially_refunded",
          )

          .reduce(
            (
              total,
              sale,
            ) =>
              total +
              sale.total,

            0,
          ),

      [
        sales,
      ],
    );


  const itemsSold =
    React.useMemo(
      () =>
        sales.reduce(
          (
            total,
            sale,
          ) =>
            total +
            sale.itemQuantityTotal,

          0,
        ),

      [
        sales,
      ],
    );


  const currency =
    sales[0]
      ?.currencyCode
      ??
    business?.currency_code
      ??
    "LKR";


  return (
    <AppLayout title="Sales">

      {/* ======================================================
          SUMMARY
      ======================================================= */}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">

        <Card className="rounded-[24px]">
          <CardContent className="p-4">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs font-medium text-muted-foreground">
                  Transactions
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {
                    sales.length
                  }
                </p>

              </div>


              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted">

                <ReceiptText className="h-5 w-5" />

              </div>

            </div>

          </CardContent>
        </Card>


        <Card className="rounded-[24px]">
          <CardContent className="p-4">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs font-medium text-muted-foreground">
                  Sales Value
                </p>

                <p className="mt-1 text-xl font-bold">
                  {formatSaleMoney(
                    salesValue,
                    currency,
                  )}
                </p>

              </div>


              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted">

                <WalletCards className="h-5 w-5" />

              </div>

            </div>

          </CardContent>
        </Card>


        <Card className="rounded-[24px]">
          <CardContent className="p-4">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs font-medium text-muted-foreground">
                  Items Sold
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {
                    itemsSold
                  }
                </p>

              </div>


              <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted">

                <ShoppingBag className="h-5 w-5" />

              </div>

            </div>

          </CardContent>
        </Card>

      </div>


      {/* ======================================================
          SEARCH
      ======================================================= */}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">

        <div className="relative max-w-md flex-1">

          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />


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
            placeholder="Search receipt, customer or payment..."
            className="h-11 rounded-xl bg-card pl-9"
          />

        </div>


        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          disabled={
            loading
          }
          onClick={() =>
            void refresh()
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


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (

        <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

          Sales could not be
          loaded:{" "}
          {error}

        </div>

      )}


      {/* ======================================================
          TABLE
      ======================================================= */}

      <Card className="overflow-hidden rounded-[24px]">

        <CardContent className="p-0">

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
                  Payment
                </TableHead>

                <TableHead className="text-right">
                  Total
                </TableHead>

                <TableHead>
                  Status
                </TableHead>

                <TableHead className="text-right">
                  Action
                </TableHead>

              </TableRow>

            </TableHeader>


            <TableBody>

              {loading &&
                sales.length ===
                  0 &&

                Array.from({
                  length:
                    5,
                }).map(
                  (
                    _,
                    index,
                  ) => (

                    <TableRow
                      key={
                        index
                      }
                    >

                      <TableCell colSpan={8}>

                        <div className="h-8 animate-pulse rounded-lg bg-muted" />

                      </TableCell>

                    </TableRow>

                  ),
                )}


              {!loading &&
                filtered.map(
                  (sale) => (

                    <TableRow
                      key={
                        sale.id
                      }
                    >

                      <TableCell>

                        <Link
                          href={`/sales/details?sale=${encodeURIComponent(
                            sale.id,
                          )}`}
                          className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                          {
                            sale.receiptNumber
                          }
                        </Link>

                      </TableCell>


                      <TableCell className="text-muted-foreground">

                        {formatDate(
                          sale.createdAt,
                        )}

                      </TableCell>


                      <TableCell>

                        {
                          sale.customerName
                          ??
                          "Walk-in"
                        }

                      </TableCell>


                      <TableCell>

                        <p className="font-medium">

                          {
                            sale.itemQuantityTotal
                          }{" "}
                          item
                          {
                            sale.itemQuantityTotal ===
                            1
                              ? ""
                              : "s"
                          }

                        </p>

                        <p className="text-xs text-muted-foreground">

                          {
                            sale.lineCount
                          }{" "}
                          line
                          {
                            sale.lineCount ===
                            1
                              ? ""
                              : "s"
                          }

                        </p>

                      </TableCell>


                      <TableCell>

                        {
                          sale.paymentMethods.length >
                          0
                            ? sale.paymentMethods
                                .map(
                                  paymentMethodLabel,
                                )
                                .join(
                                  ", ",
                                )
                            : "—"
                        }

                      </TableCell>


                      <TableCell className="text-right font-semibold">

                        {formatSaleMoney(
                          sale.total,
                          sale.currencyCode,
                        )}

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


                      <TableCell className="text-right">

                        <Button
                          asChild
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-[12px]"
                        >

                          <Link
                            href={`/sales/details?sale=${encodeURIComponent(
                              sale.id,
                            )}`}
                          >

                            Details

                            <ArrowUpRight className="ml-2 h-4 w-4" />

                          </Link>

                        </Button>

                      </TableCell>

                    </TableRow>

                  ),
                )}


              {!loading &&
                filtered.length ===
                  0 && (

                  <TableRow>

                    <TableCell
                      colSpan={
                        8
                      }
                      className="h-56 text-center"
                    >

                      <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />


                      <p className="mt-4 font-semibold">

                        {
                          sales.length ===
                          0
                            ? "No real sales yet"
                            : "No matching sales"
                        }

                      </p>


                      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">

                        {
                          sales.length ===
                          0
                            ? "Completed transactions automatically appear here."
                            : "Try another receipt number, customer or payment method."
                        }

                      </p>

                    </TableCell>

                  </TableRow>

                )}

            </TableBody>

          </Table>

        </CardContent>

      </Card>

    </AppLayout>
  );
}