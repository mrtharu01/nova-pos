"use client";

import * as React from "react";

import {
  ArrowLeft,
  Ban,
  Banknote,
  Boxes,
  CheckCircle2,
  CreditCard,
  History,
  Landmark,
  Loader2,
  PackageCheck,
  Printer,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  TriangleAlert,
  User,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ReceiptDialog,
} from "@/components/receipts/ReceiptDialog";

import {
  RefundSaleDialog,
} from "@/components/sales/RefundSaleDialog";

import {
  VoidSaleDialog,
} from "@/components/sales/VoidSaleDialog";

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
  useBusinessAccess,
} from "@/hooks/use-business-access";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  fetchSaleDetail,
} from "@/lib/data/sale-detail";

import {
  fetchSaleRefundItems,
  fetchSaleRefunds,
  fetchSaleVoid,
} from "@/lib/data/refunds";

import type {
  RefundSaleResult,
  SaleRefund,
  SaleRefundItem,
  SaleVoid,
  VoidSaleResult,
} from "@/lib/domain/refunds";

import type {
  SaleDetail,
  SaleDetailPayment,
} from "@/lib/domain/sale-detail";

import {
  formatSaleMoney,
  paymentMethodLabel,
  saleStatusLabel,
  type SaleStatus,
} from "@/lib/domain/sales";


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }


  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;


    if (
      typeof message ===
      "string"
    ) {
      return message;
    }
  }


  return "Sale could not be loaded.";
}


function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-LK",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
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
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "partially_refunded":
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";

    case "refunded":
      return "border-muted-foreground/20 bg-muted text-muted-foreground";

    case "voided":
      return "border-destructive/20 bg-destructive/10 text-destructive";
  }
}


function paymentIcon(
  payment: SaleDetailPayment,
) {
  switch (
    payment.method
  ) {
    case "cash":
      return (
        <Banknote className="h-5 w-5" />
      );

    case "card":
      return (
        <CreditCard className="h-5 w-5" />
      );

    case "bank_transfer":
      return (
        <Landmark className="h-5 w-5" />
      );

    default:
      return (
        <ReceiptText className="h-5 w-5" />
      );
  }
}


export function SaleDetailsClient({
  saleId,
}: {
  saleId: string;
}) {
  const router =
    useRouter();


  const {
    business,
    demo,
  } =
    useCurrentBusiness();


  const {
    access,
    loading:
      accessLoading,
  } =
    useBusinessAccess(
      demo
        ? undefined
        : business?.id,
    );


  const [
    sale,
    setSale,
  ] =
    React.useState<
      SaleDetail | null
    >(null);


  const [
    refunds,
    setRefunds,
  ] =
    React.useState<
      SaleRefund[]
    >([]);


  const [
    refundItems,
    setRefundItems,
  ] =
    React.useState<
      SaleRefundItem[]
    >([]);


  const [
    saleVoid,
    setSaleVoid,
  ] =
    React.useState<
      SaleVoid | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    React.useState(true);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    success,
    setSuccess,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    receiptOpen,
    setReceiptOpen,
  ] =
    React.useState(false);


  const [
    refundOpen,
    setRefundOpen,
  ] =
    React.useState(false);


  const [
    voidOpen,
    setVoidOpen,
  ] =
    React.useState(false);


  /* ==========================================================
     LOAD TRANSACTION
  ========================================================== */

  const loadTransaction =
    React.useCallback(
      async (
        initial =
          false,
      ) => {
        if (!saleId) {
          setError(
            "No sale was selected.",
          );

          setLoading(false);

          return;
        }


        if (initial) {
          setLoading(true);
        }


        setError(null);


        try {
          const [
            saleResult,
            refundsResult,
            refundItemsResult,
            voidResult,
          ] =
            await Promise.all([
              fetchSaleDetail(
                saleId,
              ),

              fetchSaleRefunds(
                saleId,
              ),

              fetchSaleRefundItems(
                saleId,
              ),

              fetchSaleVoid(
                saleId,
              ),
            ]);


          setSale(
            saleResult,
          );

          setRefunds(
            refundsResult,
          );

          setRefundItems(
            refundItemsResult,
          );

          setSaleVoid(
            voidResult,
          );
        } catch (cause) {
          setError(
            getErrorMessage(
              cause,
            ),
          );
        } finally {
          if (initial) {
            setLoading(false);
          }
        }
      },
      [
        saleId,
      ],
    );


  React.useEffect(() => {
    void loadTransaction(
      true,
    );
  }, [
    loadTransaction,
  ]);


  /* ==========================================================
     REFUND SUMMARIES
  ========================================================== */

  const refundedQuantityByItem =
    React.useMemo(
      () => {
        const map =
          new Map<
            string,
            number
          >();


        refundItems.forEach(
          (item) => {
            map.set(
              item.saleItemId,
              (
                map.get(
                  item.saleItemId,
                ) ??
                0
              ) +
                item.quantity,
            );
          },
        );


        return map;
      },
      [
        refundItems,
      ],
    );


  const totalRefunded =
    React.useMemo(
      () =>
        refunds.reduce(
          (
            total,
            refund,
          ) =>
            total +
            refund.amount,
          0,
        ),
      [
        refunds,
      ],
    );


  const totalRefundedQuantity =
    React.useMemo(
      () =>
        refundItems.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.quantity,
          0,
        ),
      [
        refundItems,
      ],
    );


  const remainingRefundableQuantity =
    sale
      ? Math.max(
          0,
          sale.itemQuantityTotal -
            totalRefundedQuantity,
        )
      : 0;


  /* ==========================================================
     INVENTORY NAMES
  ========================================================== */

  const movementNames =
    React.useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();


        sale?.items.forEach(
          (item) => {
            if (
              item.variantId
            ) {
              map.set(
                item.variantId,
                `${item.productName} · ${item.variantName}`,
              );
            }
          },
        );


        return map;
      },
      [
        sale,
      ],
    );


  /* ==========================================================
     PERMISSIONS
  ========================================================== */

  const canManageReturns =
    !demo &&
    Boolean(
      access?.permissions
        .refundSales,
    );


  const canRefund =
    canManageReturns &&
    Boolean(sale) &&
    (
      sale?.status ===
        "completed" ||
      sale?.status ===
        "partially_refunded"
    ) &&
    remainingRefundableQuantity >
      0;


  const canVoid =
    canManageReturns &&
    sale?.status ===
      "completed" &&
    refunds.length ===
      0 &&
    !saleVoid;


  /* ==========================================================
     COMPLETION
  ========================================================== */

  async function handleRefundCompleted(
    result: RefundSaleResult,
  ) {
    setRefundOpen(false);


    setSuccess(
      `${result.refundNumber} created — ${formatSaleMoney(
        result.amount,
        sale?.currencyCode ??
          "LKR",
      )} refunded.`,
    );


    await loadTransaction();


    window.setTimeout(
      () => {
        setSuccess(null);
      },
      4000,
    );
  }


  async function handleVoidCompleted(
    result: VoidSaleResult,
  ) {
    setVoidOpen(false);


    setSuccess(
      `${result.receiptNumber} was voided and ${result.restoredQuantity} inventory item${
        result.restoredQuantity ===
        1
          ? ""
          : "s"
      } restored.`,
    );


    await loadTransaction();


    window.setTimeout(
      () => {
        setSuccess(null);
      },
      4000,
    );
  }


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <AppLayout title="Sale Details">

        <div className="flex min-h-[60vh] flex-col items-center justify-center">

          <Loader2 className="h-8 w-8 animate-spin text-primary" />

          <p className="mt-4 text-sm text-muted-foreground">
            Loading transaction…
          </p>

        </div>

      </AppLayout>
    );
  }


  /* ==========================================================
     ERROR
  ========================================================== */

  if (
    error ||
    !sale
  ) {
    return (
      <AppLayout title="Sale Details">

        <div className="mx-auto max-w-xl rounded-[24px] border border-destructive/30 bg-destructive/5 p-6">

          <TriangleAlert className="h-7 w-7 text-destructive" />


          <h2 className="mt-4 text-lg font-bold">
            Sale could not be loaded
          </h2>


          <p className="mt-2 text-sm text-destructive">
            {error ??
              "Transaction not found."}
          </p>


          <Button
            type="button"
            variant="outline"
            className="mt-5 rounded-[14px]"
            onClick={() =>
              router.push(
                "/sales",
              )
            }
          >

            <ArrowLeft className="mr-2 h-4 w-4" />

            Back to Sales

          </Button>

        </div>

      </AppLayout>
    );
  }


  const netTotal =
    Math.max(
      0,
      sale.total -
        totalRefunded,
    );


  return (
    <AppLayout title="Sale Details">

      {/* ======================================================
          SUCCESS
      ======================================================= */}

      {success && (

        <div className="mb-5 flex items-start gap-3 rounded-[18px] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">

          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

          {success}

        </div>

      )}


      {/* ======================================================
          TOP ACTIONS
      ======================================================= */}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <Button
          type="button"
          variant="ghost"
          className="w-fit rounded-[12px]"
          onClick={() =>
            router.push(
              "/sales",
            )
          }
        >

          <ArrowLeft className="mr-2 h-4 w-4" />

          Sales

        </Button>


        <div className="flex flex-wrap gap-2">

          {canRefund && (

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={() =>
                setRefundOpen(
                  true,
                )
              }
            >

              <RotateCcw className="mr-2 h-4 w-4" />

              Refund Items

            </Button>

          )}


          {canVoid && (

            <Button
              type="button"
              variant="destructive"
              className="rounded-[14px]"
              onClick={() =>
                setVoidOpen(
                  true,
                )
              }
            >

              <Ban className="mr-2 h-4 w-4" />

              Void Sale

            </Button>

          )}


          <Button
            type="button"
            className="rounded-[14px]"
            onClick={() =>
              setReceiptOpen(
                true,
              )
            }
          >

            <Printer className="mr-2 h-4 w-4" />

            Reprint Receipt

          </Button>

        </div>

      </div>


      {/* ======================================================
          RECEIPT HEADER
      ======================================================= */}

      <Card className="overflow-hidden rounded-[24px]">

        <CardContent className="p-0">

          <div className="p-6 sm:p-8">

            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">

              <div>

                <div className="flex flex-wrap items-center gap-3">

                  <h1 className="text-3xl font-bold tracking-tight">
                    {
                      sale.receiptNumber
                    }
                  </h1>


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

                </div>


                <p className="mt-2 text-sm text-muted-foreground">
                  {formatDate(
                    sale.createdAt,
                  )}
                </p>

              </div>


              <div className="md:text-right">

                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Original Total
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {formatSaleMoney(
                    sale.total,
                    sale.currencyCode,
                  )}
                </p>


                {totalRefunded >
                  0 && (

                  <>

                    <p className="mt-3 text-xs text-muted-foreground">
                      Refunded{" "}
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        -
                        {formatSaleMoney(
                          totalRefunded,
                          sale.currencyCode,
                        )}
                      </span>
                    </p>


                    <p className="mt-1 text-sm font-bold text-primary">
                      Net{" "}
                      {formatSaleMoney(
                        netTotal,
                        sale.currencyCode,
                      )}
                    </p>

                  </>

                )}

              </div>

            </div>

          </div>


          <div className="grid gap-px border-t bg-border sm:grid-cols-2 lg:grid-cols-4">

            <SummaryCell
              icon={
                <ShoppingBag className="h-5 w-5" />
              }
              label="Items sold"
              value={`${sale.itemQuantityTotal}`}
            />


            <SummaryCell
              icon={
                <RotateCcw className="h-5 w-5" />
              }
              label="Items refunded"
              value={`${totalRefundedQuantity}`}
            />


            <SummaryCell
              icon={
                <User className="h-5 w-5" />
              }
              label="Cashier"
              value={
                sale.cashierLabel ??
                "Unknown"
              }
            />


            <SummaryCell
              icon={
                <PackageCheck className="h-5 w-5" />
              }
              label="Inventory entries"
              value={
                sale.inventoryMovements.length.toString()
              }
            />

          </div>

        </CardContent>

      </Card>


      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* ====================================================
            LEFT
        ===================================================== */}

        <div className="space-y-5">

          {/* ==================================================
              ITEMS
          =================================================== */}

          <Card className="overflow-hidden rounded-[24px]">

            <CardHeader>

              <CardTitle>
                Sale Items
              </CardTitle>

            </CardHeader>


            <CardContent className="p-0">

              <Table>

                <TableHeader>

                  <TableRow>

                    <TableHead>
                      Product
                    </TableHead>

                    <TableHead>
                      SKU
                    </TableHead>

                    <TableHead className="text-center">
                      Qty
                    </TableHead>

                    <TableHead className="text-center">
                      Refunded
                    </TableHead>

                    <TableHead className="text-right">
                      Unit
                    </TableHead>

                    <TableHead className="text-right">
                      Total
                    </TableHead>

                  </TableRow>

                </TableHeader>


                <TableBody>

                  {sale.items.map(
                    (item) => {
                      const refunded =
                        refundedQuantityByItem.get(
                          item.id,
                        ) ??
                        0;


                      return (
                        <TableRow
                          key={
                            item.id
                          }
                        >

                          <TableCell>

                            <p className="font-semibold">
                              {
                                item.productName
                              }
                            </p>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {
                                item.variantName
                              }
                            </p>

                          </TableCell>


                          <TableCell className="font-mono text-xs">
                            {
                              item.sku
                            }
                          </TableCell>


                          <TableCell className="text-center font-medium">
                            {
                              item.quantity
                            }
                          </TableCell>


                          <TableCell className="text-center">

                            {refunded >
                            0 ? (

                              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                                {refunded}
                              </span>

                            ) : (

                              <span className="text-muted-foreground">
                                —
                              </span>

                            )}

                          </TableCell>


                          <TableCell className="text-right">
                            {formatSaleMoney(
                              item.unitPrice,
                              sale.currencyCode,
                            )}
                          </TableCell>


                          <TableCell className="text-right font-semibold">
                            {formatSaleMoney(
                              item.lineTotal,
                              sale.currencyCode,
                            )}
                          </TableCell>

                        </TableRow>
                      );
                    },
                  )}

                </TableBody>

              </Table>


              <div className="ml-auto max-w-sm space-y-2 border-t p-5">

                <MoneyLine
                  label="Subtotal"
                  value={
                    formatSaleMoney(
                      sale.subtotal,
                      sale.currencyCode,
                    )
                  }
                />


                {sale.discountTotal >
                  0 && (

                  <MoneyLine
                    label="Discount"
                    value={`-${formatSaleMoney(
                      sale.discountTotal,
                      sale.currencyCode,
                    )}`}
                  />

                )}


                {sale.taxTotal >
                  0 && (

                  <MoneyLine
                    label="Tax"
                    value={
                      formatSaleMoney(
                        sale.taxTotal,
                        sale.currencyCode,
                      )
                    }
                  />

                )}


                <div className="mt-3 flex items-center justify-between border-t pt-3">

                  <span className="font-bold">
                    Original Total
                  </span>

                  <span className="text-xl font-bold">
                    {formatSaleMoney(
                      sale.total,
                      sale.currencyCode,
                    )}
                  </span>

                </div>


                {totalRefunded >
                  0 && (

                  <>

                    <MoneyLine
                      label="Refunded"
                      value={`-${formatSaleMoney(
                        totalRefunded,
                        sale.currencyCode,
                      )}`}
                    />


                    <div className="flex items-center justify-between border-t pt-3">

                      <span className="font-bold">
                        Net
                      </span>

                      <span className="text-xl font-bold text-primary">
                        {formatSaleMoney(
                          netTotal,
                          sale.currencyCode,
                        )}
                      </span>

                    </div>

                  </>

                )}

              </div>

            </CardContent>

          </Card>


          {/* ==================================================
              REFUND HISTORY
          =================================================== */}

          {(refunds.length >
            0 ||
            saleVoid) && (

            <Card className="rounded-[24px]">

              <CardHeader>

                <div className="flex items-center gap-2">

                  <History className="h-5 w-5" />

                  <CardTitle>
                    Returns & Audit History
                  </CardTitle>

                </div>

              </CardHeader>


              <CardContent className="space-y-3">

                {refunds.map(
                  (refund) => {
                    const items =
                      refundItems.filter(
                        (item) =>
                          item.refundId ===
                          refund.id,
                      );


                    const quantity =
                      items.reduce(
                        (
                          total,
                          item,
                        ) =>
                          total +
                          item.quantity,
                        0,
                      );


                    return (
                      <div
                        key={
                          refund.id
                        }
                        className="rounded-[18px] border bg-amber-500/[0.03] p-4"
                      >

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="font-bold">
                                {
                                  refund.refundNumber
                                }
                              </span>

                              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                Refund
                              </span>

                            </div>


                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatDate(
                                refund.createdAt,
                              )}
                            </p>

                          </div>


                          <div className="sm:text-right">

                            <p className="font-bold text-amber-700 dark:text-amber-300">
                              -
                              {formatSaleMoney(
                                refund.amount,
                                sale.currencyCode,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {paymentMethodLabel(
                                refund.refundMethod,
                              )}
                              {" · "}
                              {quantity} item
                              {quantity ===
                              1
                                ? ""
                                : "s"}
                            </p>

                          </div>

                        </div>


                        <div className="mt-4 space-y-2 border-t pt-3">

                          {items.map(
                            (item) => (

                              <div
                                key={
                                  item.id
                                }
                                className="flex items-center justify-between gap-4 text-sm"
                              >

                                <div className="min-w-0">

                                  <p className="truncate font-medium">
                                    {
                                      item.productName
                                    }
                                  </p>

                                  <p className="text-xs text-muted-foreground">
                                    Qty{" "}
                                    {
                                      item.quantity
                                    }
                                    {" · "}
                                    {item.restocked
                                      ? "Restocked"
                                      : "Not restocked"}
                                  </p>

                                </div>


                                <span className="shrink-0 font-semibold">
                                  {formatSaleMoney(
                                    item.lineRefundTotal,
                                    sale.currencyCode,
                                  )}
                                </span>

                              </div>

                            ),
                          )}

                        </div>


                        <div className="mt-3 border-t pt-3 text-xs">

                          <span className="font-semibold">
                            Reason:
                          </span>{" "}

                          <span className="text-muted-foreground">
                            {
                              refund.reason ||
                              "—"
                            }
                          </span>


                          {refund.note && (
                            <p className="mt-2 text-muted-foreground">
                              {
                                refund.note
                              }
                            </p>
                          )}

                        </div>

                      </div>
                    );
                  },
                )}


                {saleVoid && (

                  <div className="rounded-[18px] border border-destructive/20 bg-destructive/[0.03] p-4">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                      <div>

                        <div className="flex items-center gap-2">

                          <span className="font-bold">
                            Sale Voided
                          </span>

                          <span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
                            Void
                          </span>

                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(
                            saleVoid.createdAt,
                          )}
                        </p>

                      </div>


                      <Ban className="h-5 w-5 text-destructive" />

                    </div>


                    <div className="mt-3 border-t pt-3 text-xs">

                      <span className="font-semibold">
                        Reason:
                      </span>{" "}

                      <span className="text-muted-foreground">
                        {
                          saleVoid.reason ||
                          "—"
                        }
                      </span>


                      {saleVoid.note && (
                        <p className="mt-2 text-muted-foreground">
                          {
                            saleVoid.note
                          }
                        </p>
                      )}

                    </div>

                  </div>

                )}

              </CardContent>

            </Card>

          )}


          {/* ==================================================
              INVENTORY IMPACT
          =================================================== */}

          <Card className="overflow-hidden rounded-[24px]">

            <CardHeader>

              <div className="flex items-center gap-2">

                <Boxes className="h-5 w-5" />

                <CardTitle>
                  Inventory Impact
                </CardTitle>

              </div>

            </CardHeader>


            <CardContent>

              {sale.inventoryMovements.length >
              0 ? (

                <div className="space-y-2">

                  {sale.inventoryMovements.map(
                    (movement) => {
                      const positive =
                        movement.quantityDelta >
                        0;


                      return (
                        <div
                          key={
                            movement.id
                          }
                          className="rounded-[16px] border bg-muted/20 p-4"
                        >

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                            <div>

                              <p className="font-semibold">
                                {
                                  movementNames.get(
                                    movement.variantId,
                                  ) ??
                                  "Product variant"
                                }
                              </p>


                              <p className="mt-1 text-xs text-muted-foreground">
                                {
                                  movement.reason ||
                                  movement.movementType
                                }
                                {" · "}
                                {
                                  movement.note ||
                                  sale.receiptNumber
                                }
                              </p>


                              {movement.referenceType && (
                                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {
                                    movement.referenceType.replace(
                                      /_/g,
                                      " ",
                                    )
                                  }
                                </p>
                              )}

                            </div>


                            <div className="flex items-center gap-3">

                              <div className="rounded-[12px] bg-background px-3 py-2 text-center">

                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Before
                                </p>

                                <p className="font-bold">
                                  {
                                    movement.quantityBefore
                                  }
                                </p>

                              </div>


                              <span className="text-muted-foreground">
                                →
                              </span>


                              <div className="rounded-[12px] bg-background px-3 py-2 text-center">

                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  After
                                </p>

                                <p className="font-bold">
                                  {
                                    movement.quantityAfter
                                  }
                                </p>

                              </div>


                              <span
                                className={`rounded-full px-2.5 py-1 text-sm font-bold ${
                                  positive
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "bg-destructive/10 text-destructive"
                                }`}
                              >
                                {positive
                                  ? "+"
                                  : ""}
                                {
                                  movement.quantityDelta
                                }
                              </span>

                            </div>

                          </div>

                        </div>
                      );
                    },
                  )}

                </div>

              ) : (

                <p className="text-sm text-muted-foreground">
                  No inventory movement was recorded for this transaction.
                </p>

              )}

            </CardContent>

          </Card>

        </div>


        {/* ====================================================
            RIGHT COLUMN
        ===================================================== */}

        <div className="space-y-5">

          {/* PAYMENT */}

          <Card className="rounded-[24px]">

            <CardHeader>
              <CardTitle>
                Payment
              </CardTitle>
            </CardHeader>


            <CardContent className="space-y-3">

              {sale.payments.map(
                (payment) => (

                  <div
                    key={
                      payment.id
                    }
                    className="rounded-[16px] border bg-muted/20 p-4"
                  >

                    <div className="flex items-center gap-3">

                      <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-background">
                        {paymentIcon(
                          payment,
                        )}
                      </div>


                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center justify-between gap-2">

                          <p className="font-semibold">
                            {paymentMethodLabel(
                              payment.method,
                            )}
                          </p>

                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {
                              payment.status.replace(
                                /_/g,
                                " ",
                              )
                            }
                          </span>

                        </div>


                        <p className="text-xs text-muted-foreground">
                          {formatSaleMoney(
                            payment.amount,
                            sale.currencyCode,
                          )}
                        </p>

                      </div>

                    </div>


                    {payment.method ===
                      "cash" && (

                      <div className="mt-4 space-y-2 border-t pt-3">

                        <MoneyLine
                          label="Cash received"
                          value={
                            formatSaleMoney(
                              payment.cashReceived ??
                                payment.amount,
                              sale.currencyCode,
                            )
                          }
                        />

                        <MoneyLine
                          label="Change"
                          value={
                            formatSaleMoney(
                              payment.changeDue ??
                                0,
                              sale.currencyCode,
                            )
                          }
                        />

                      </div>

                    )}


                    {payment.referenceNumber && (

                      <div className="mt-3 border-t pt-3">

                        <p className="text-xs text-muted-foreground">
                          Reference
                        </p>

                        <p className="mt-1 break-all font-mono text-xs">
                          {
                            payment.referenceNumber
                          }
                        </p>

                      </div>

                    )}

                  </div>

                ),
              )}

            </CardContent>

          </Card>


          {/* CUSTOMER */}

          <Card className="rounded-[24px]">

            <CardHeader>
              <CardTitle>
                Customer
              </CardTitle>
            </CardHeader>


            <CardContent className="space-y-3">

              <DetailLine
                label="Name"
                value={
                  sale.customerName ??
                  "Walk-in customer"
                }
              />

              <DetailLine
                label="Email"
                value={
                  sale.customerEmail ??
                  "—"
                }
              />

              <DetailLine
                label="Phone"
                value={
                  sale.customerPhone ??
                  "—"
                }
              />

            </CardContent>

          </Card>


          {/* TRANSACTION */}

          <Card className="rounded-[24px]">

            <CardHeader>
              <CardTitle>
                Transaction
              </CardTitle>
            </CardHeader>


            <CardContent className="space-y-3">

              <DetailLine
                label="Receipt"
                value={
                  sale.receiptNumber
                }
              />

              <DetailLine
                label="Sequence"
                value={
                  sale.receiptSequence.toString()
                }
              />

              <DetailLine
                label="Cashier"
                value={
                  sale.cashierLabel ??
                  "Unknown"
                }
              />

              <DetailLine
                label="Created"
                value={
                  formatDate(
                    sale.createdAt,
                  )
                }
              />


              {sale.note && (

                <div className="border-t pt-3">

                  <p className="text-xs font-medium text-muted-foreground">
                    Note
                  </p>

                  <p className="mt-1 text-sm">
                    {
                      sale.note
                    }
                  </p>

                </div>

              )}

            </CardContent>

          </Card>


          {/* ACTIONS */}

          <Card className="rounded-[24px]">

            <CardHeader>
              <CardTitle>
                Actions
              </CardTitle>
            </CardHeader>


            <CardContent className="space-y-2">

              {accessLoading &&
              !demo ? (

                <div className="flex items-center justify-center rounded-[14px] border p-4 text-xs text-muted-foreground">

                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  Checking permissions…

                </div>

              ) : (

                <>

                  {canRefund && (

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-[14px]"
                      onClick={() =>
                        setRefundOpen(
                          true,
                        )
                      }
                    >

                      <RotateCcw className="mr-2 h-4 w-4" />

                      Refund Items

                    </Button>

                  )}


                  {canVoid && (

                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full rounded-[14px]"
                      onClick={() =>
                        setVoidOpen(
                          true,
                        )
                      }
                    >

                      <Ban className="mr-2 h-4 w-4" />

                      Void Sale

                    </Button>

                  )}

                </>

              )}


              <Button
                type="button"
                className="w-full rounded-[14px]"
                onClick={() =>
                  setReceiptOpen(
                    true,
                  )
                }
              >

                <Printer className="mr-2 h-4 w-4" />

                Reprint Receipt

              </Button>


              <Button
                type="button"
                variant="outline"
                className="w-full rounded-[14px]"
                onClick={() =>
                  router.push(
                    "/sales",
                  )
                }
              >

                <ArrowLeft className="mr-2 h-4 w-4" />

                Back to Sales

              </Button>


              {!canManageReturns &&
              !accessLoading &&
              !demo && (

                <p className="pt-2 text-center text-[11px] leading-5 text-muted-foreground">
                  Refund and void operations require manager access.
                </p>

              )}


              {sale.status ===
                "refunded" && (

                <p className="pt-2 text-center text-[11px] leading-5 text-muted-foreground">
                  This transaction has been fully refunded.
                </p>

              )}


              {sale.status ===
                "voided" && (

                <p className="pt-2 text-center text-[11px] leading-5 text-muted-foreground">
                  This transaction has been voided and cannot be modified further.
                </p>

              )}

            </CardContent>

          </Card>

        </div>

      </div>


      {/* ======================================================
          RECEIPT
      ======================================================= */}

      <ReceiptDialog
        saleId={sale.id}
        isOpen={receiptOpen}
        onClose={() =>
          setReceiptOpen(
            false,
          )
        }
        businessName={
          business?.name ??
          "NOVA POS"
        }
        isReprint
      />


      {/* ======================================================
          REFUND DIALOG
      ======================================================= */}

      <RefundSaleDialog
        isOpen={refundOpen}
        onClose={() =>
          setRefundOpen(
            false,
          )
        }
        sale={sale}
        refundItems={
          refundItems
        }
        onCompleted={
          handleRefundCompleted
        }
      />


      {/* ======================================================
          VOID DIALOG
      ======================================================= */}

      <VoidSaleDialog
        isOpen={voidOpen}
        onClose={() =>
          setVoidOpen(
            false,
          )
        }
        sale={sale}
        onCompleted={
          handleVoidCompleted
        }
      />

    </AppLayout>
  );
}


/* ============================================================
   SMALL COMPONENTS
============================================================ */

function SummaryCell({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;

  label:
    string;

  value:
    string;
}) {
  return (
    <div className="bg-card p-5">

      <div className="flex items-center gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-muted">
          {icon}
        </div>


        <div className="min-w-0">

          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>

          <p className="mt-1 truncate font-semibold">
            {value}
          </p>

        </div>

      </div>

    </div>
  );
}


function MoneyLine({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">

      <span className="text-muted-foreground">
        {label}
      </span>

      <span className="font-medium">
        {value}
      </span>

    </div>
  );
}


function DetailLine({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <span className="text-sm text-muted-foreground">
        {label}
      </span>

      <span className="max-w-[65%] break-words text-right text-sm font-medium">
        {value}
      </span>

    </div>
  );
}