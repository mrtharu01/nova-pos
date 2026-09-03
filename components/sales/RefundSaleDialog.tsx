"use client";

import * as React from "react";

import {
  CheckCircle2,
  Loader2,
  Minus,
  PackageCheck,
  PackageX,
  Plus,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  refundSale,
} from "@/lib/data/refunds";

import type {
  RefundSaleResult,
  SaleRefundItem,
} from "@/lib/domain/refunds";

import type {
  SaleDetail,
  SaleDetailItem,
} from "@/lib/domain/sale-detail";

import {
  formatSaleMoney,
  paymentMethodLabel,
  type PaymentMethod,
} from "@/lib/domain/sales";


type RefundLineState = {
  quantity: number;
  restock: boolean;
};


type RefundSaleDialogProps = {
  isOpen: boolean;

  onClose: () => void;

  sale: SaleDetail;

  refundItems: SaleRefundItem[];

  onCompleted: (
    result: RefundSaleResult,
  ) => void;
};


const REFUND_REASONS = [
  "Customer return",
  "Damaged item",
  "Wrong item",
  "Quality issue",
  "Expired item",
  "Other",
] as const;


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Refund could not be completed.";
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


export function RefundSaleDialog({
  isOpen,
  onClose,
  sale,
  refundItems,
  onCompleted,
}: RefundSaleDialogProps) {
  const [
    lines,
    setLines,
  ] =
    React.useState<
      Record<
        string,
        RefundLineState
      >
    >({});


  const [
    refundMethod,
    setRefundMethod,
  ] =
    React.useState<PaymentMethod>(
      sale.payments[0]?.method ??
        "cash",
    );


  const [
    reason,
    setReason,
  ] =
    React.useState(
      "Customer return",
    );


  const [
    customReason,
    setCustomReason,
  ] =
    React.useState("");


  const [
    note,
    setNote,
  ] =
    React.useState("");


  const [
    processing,
    setProcessing,
  ] =
    React.useState(false);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  /* ==========================================================
     PREVIOUS REFUNDS
  ========================================================== */

  const refundedByItem =
    React.useMemo(() => {
      const map =
        new Map<
          string,
          {
            quantity: number;
            amount: number;
          }
        >();


      refundItems.forEach(
        (item) => {
          const current =
            map.get(
              item.saleItemId,
            ) ?? {
              quantity: 0,
              amount: 0,
            };


          current.quantity +=
            item.quantity;


          current.amount +=
            item.lineRefundTotal;


          map.set(
            item.saleItemId,
            current,
          );
        },
      );


      return map;
    }, [
      refundItems,
    ]);


  /* ==========================================================
     RESET WHEN OPENED
  ========================================================== */

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }


    const initial: Record<
      string,
      RefundLineState
    > = {};


    sale.items.forEach(
      (item) => {
        initial[item.id] = {
          quantity: 0,

          restock:
            Boolean(
              item.variantId,
            ),
        };
      },
    );


    setLines(
      initial,
    );


    setRefundMethod(
      sale.payments[0]?.method ??
        "cash",
    );


    setReason(
      "Customer return",
    );


    setCustomReason("");


    setNote("");


    setError(null);
  }, [
    isOpen,
    sale,
  ]);


  /* ==========================================================
     ITEM HELPERS
  ========================================================== */

  function refundedQuantity(
    item: SaleDetailItem,
  ) {
    return (
      refundedByItem.get(
        item.id,
      )?.quantity ??
      0
    );
  }


  function refundedAmount(
    item: SaleDetailItem,
  ) {
    return (
      refundedByItem.get(
        item.id,
      )?.amount ??
      0
    );
  }


  function remainingQuantity(
    item: SaleDetailItem,
  ) {
    return Math.max(
      0,
      item.quantity -
        refundedQuantity(
          item,
        ),
    );
  }


  function calculateRefundAmount(
    item: SaleDetailItem,
    quantity: number,
  ) {
    if (
      quantity <= 0
    ) {
      return 0;
    }


    const remainingQty =
      remainingQuantity(
        item,
      );


    const remainingAmount =
      Math.max(
        0,
        item.lineTotal -
          refundedAmount(
            item,
          ),
      );


    if (
      quantity ===
      remainingQty
    ) {
      return roundMoney(
        remainingAmount,
      );
    }


    return roundMoney(
      (
        item.lineTotal *
        quantity
      ) /
        item.quantity,
    );
  }


  /* ==========================================================
     SELECTED ITEMS
  ========================================================== */

  const selectedItems =
    React.useMemo(
      () =>
        sale.items
          .map(
            (item) => ({
              item,

              state:
                lines[
                  item.id
                ] ?? {
                  quantity: 0,

                  restock:
                    Boolean(
                      item.variantId,
                    ),
                },
            }),
          )
          .filter(
            ({
              state,
            }) =>
              state.quantity >
              0,
          ),
      [
        lines,
        sale.items,
      ],
    );


  const refundTotal =
    selectedItems.reduce(
      (
        total,
        {
          item,
          state,
        },
      ) =>
        total +
        calculateRefundAmount(
          item,
          state.quantity,
        ),
      0,
    );


  const refundQuantity =
    selectedItems.reduce(
      (
        total,
        {
          state,
        },
      ) =>
        total +
        state.quantity,
      0,
    );


  /* ==========================================================
     UPDATE QUANTITY
  ========================================================== */

  function updateQuantity(
    item: SaleDetailItem,
    quantity: number,
  ) {
    const maximum =
      remainingQuantity(
        item,
      );


    const next =
      Math.max(
        0,
        Math.min(
          maximum,
          quantity,
        ),
      );


    setLines(
      (current) => ({
        ...current,

        [item.id]: {
          quantity:
            next,

          restock:
            current[
              item.id
            ]?.restock ??
            Boolean(
              item.variantId,
            ),
        },
      }),
    );


    setError(null);
  }


  /* ==========================================================
     UPDATE RESTOCK
  ========================================================== */

  function updateRestock(
    item: SaleDetailItem,
    restock: boolean,
  ) {
    if (
      !item.variantId
    ) {
      return;
    }


    setLines(
      (current) => ({
        ...current,

        [item.id]: {
          quantity:
            current[
              item.id
            ]?.quantity ??
            0,

          restock,
        },
      }),
    );
  }


  /* ==========================================================
     COMPLETE REFUND
  ========================================================== */

  async function handleRefund() {
    if (
      processing
    ) {
      return;
    }


    if (
      selectedItems.length ===
      0
    ) {
      setError(
        "Select at least one item to refund.",
      );

      return;
    }


    const finalReason =
      reason ===
      "Other"
        ? customReason.trim()
        : reason;


    if (
      !finalReason
    ) {
      setError(
        "Enter a refund reason.",
      );

      return;
    }


    setProcessing(true);
    setError(null);


    try {
      const result =
        await refundSale({
          businessId:
            sale.businessId,

          saleId:
            sale.id,

          items:
            selectedItems.map(
              ({
                item,
                state,
              }) => ({
                saleItemId:
                  item.id,

                quantity:
                  state.quantity,

                restock:
                  state.restock,
              }),
            ),

          refundMethod,

          reason:
            finalReason,

          note:
            note.trim(),
        });


      onCompleted(
        result,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setProcessing(false);
    }
  }


  const hasRefundableItems =
    sale.items.some(
      (item) =>
        remainingQuantity(
          item,
        ) >
        0,
    );


  return (
    <Dialog
      isOpen={isOpen}
      onClose={
        processing
          ? () => {}
          : onClose
      }
      title="Refund Items"
      description={`Create a refund against ${sale.receiptNumber}. The original transaction will remain in the audit history.`}
      className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-hidden"
    >

      {/* ======================================================
          SCROLLABLE DIALOG BODY
      ======================================================= */}

      <div className="flex max-h-[calc(100vh-10rem)] flex-col">

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">

          <div className="space-y-5 pb-5">

            {/* ==================================================
                ERROR
            =================================================== */}

            {error && (

              <div className="flex items-start gap-3 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

                <span>
                  {error}
                </span>

              </div>

            )}


            {/* ==================================================
                ITEMS
            =================================================== */}

            {hasRefundableItems ? (

              <div className="space-y-3">

                <div>

                  <h3 className="font-semibold">
                    Select items
                  </h3>


                  <p className="mt-1 text-xs text-muted-foreground">
                    Set the quantity to refund. Returned items can optionally be placed back into sellable inventory.
                  </p>

                </div>


                {sale.items.map(
                  (item) => {
                    const alreadyRefunded =
                      refundedQuantity(
                        item,
                      );


                    const remaining =
                      remainingQuantity(
                        item,
                      );


                    const state =
                      lines[
                        item.id
                      ] ?? {
                        quantity: 0,

                        restock:
                          Boolean(
                            item.variantId,
                          ),
                      };


                    const amount =
                      calculateRefundAmount(
                        item,
                        state.quantity,
                      );


                    return (
                      <div
                        key={
                          item.id
                        }
                        className={`rounded-[18px] border p-4 ${
                          remaining <= 0
                            ? "bg-muted/30 opacity-60"
                            : state.quantity > 0
                              ? "border-primary/40 bg-primary/[0.04]"
                              : "bg-background"
                        }`}
                      >

                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                          {/* ITEM DETAILS */}

                          <div className="min-w-0">

                            <p className="font-semibold">
                              {
                                item.productName
                              }
                            </p>


                            <p className="mt-1 text-xs text-muted-foreground">

                              {
                                item.variantName
                              }

                              {item.sku && (
                                <>
                                  {" · "}
                                  {
                                    item.sku
                                  }
                                </>
                              )}

                            </p>


                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">

                              <span>
                                Purchased:{" "}
                                <strong className="text-foreground">
                                  {
                                    item.quantity
                                  }
                                </strong>
                              </span>


                              <span>
                                Refunded:{" "}
                                <strong className="text-foreground">
                                  {
                                    alreadyRefunded
                                  }
                                </strong>
                              </span>


                              <span>
                                Remaining:{" "}
                                <strong className="text-foreground">
                                  {
                                    remaining
                                  }
                                </strong>
                              </span>

                            </div>

                          </div>


                          {remaining >
                          0 ? (

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                              {/* QUANTITY */}

                              <div className="flex items-center rounded-[14px] border bg-background p-1">

                                <button
                                  type="button"
                                  disabled={
                                    processing ||
                                    state.quantity <=
                                      0
                                  }
                                  onClick={() =>
                                    updateQuantity(
                                      item,
                                      state.quantity -
                                        1,
                                    )
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>


                                <span className="min-w-10 text-center text-sm font-bold">
                                  {
                                    state.quantity
                                  }
                                </span>


                                <button
                                  type="button"
                                  disabled={
                                    processing ||
                                    state.quantity >=
                                      remaining
                                  }
                                  onClick={() =>
                                    updateQuantity(
                                      item,
                                      state.quantity +
                                        1,
                                    )
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>

                              </div>


                              {/* RESTOCK */}

                              <button
                                type="button"
                                disabled={
                                  processing ||
                                  !item.variantId ||
                                  state.quantity ===
                                    0
                                }
                                onClick={() =>
                                  updateRestock(
                                    item,
                                    !state.restock,
                                  )
                                }
                                className={`flex min-w-[150px] items-center gap-2 rounded-[14px] border px-3 py-2 text-left text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                  state.restock &&
                                  state.quantity >
                                    0
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "bg-background text-muted-foreground"
                                }`}
                              >

                                {state.restock ? (
                                  <PackageCheck className="h-4 w-4" />
                                ) : (
                                  <PackageX className="h-4 w-4" />
                                )}


                                {state.restock
                                  ? "Restock item"
                                  : "Do not restock"}

                              </button>


                              {/* AMOUNT */}

                              <div className="min-w-[120px] text-right">

                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  Refund
                                </p>


                                <p className="mt-1 font-bold">
                                  {formatSaleMoney(
                                    amount,
                                    sale.currencyCode,
                                  )}
                                </p>

                              </div>

                            </div>

                          ) : (

                            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                              Fully refunded
                            </span>

                          )}

                        </div>

                      </div>
                    );
                  },
                )}

              </div>

            ) : (

              <div className="rounded-[18px] border border-dashed bg-muted/20 p-8 text-center">

                <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />


                <p className="mt-3 font-semibold">
                  Nothing left to refund
                </p>


                <p className="mt-1 text-sm text-muted-foreground">
                  Every item in this transaction has already been refunded.
                </p>

              </div>

            )}


            {hasRefundableItems && (

              <>

                {/* ==============================================
                    REFUND DETAILS
                =============================================== */}

                <div className="grid gap-4 md:grid-cols-2">

                  {/* REFUND METHOD */}

                  <div className="space-y-2">

                    <label className="text-sm font-semibold">
                      Refund method
                    </label>


                    <select
                      value={
                        refundMethod
                      }
                      disabled={
                        processing
                      }
                      onChange={(
                        event,
                      ) =>
                        setRefundMethod(
                          event.target
                            .value as
                            PaymentMethod,
                        )
                      }
                      className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
                    >

                      <option value="cash">
                        {paymentMethodLabel(
                          "cash",
                        )}
                      </option>


                      <option value="card">
                        {paymentMethodLabel(
                          "card",
                        )}
                      </option>


                      <option value="bank_transfer">
                        {paymentMethodLabel(
                          "bank_transfer",
                        )}
                      </option>


                      <option value="other">
                        {paymentMethodLabel(
                          "other",
                        )}
                      </option>

                    </select>

                  </div>


                  {/* REASON */}

                  <div className="space-y-2">

                    <label className="text-sm font-semibold">
                      Reason
                    </label>


                    <select
                      value={
                        reason
                      }
                      disabled={
                        processing
                      }
                      onChange={(
                        event,
                      ) =>
                        setReason(
                          event.target.value,
                        )
                      }
                      className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
                    >

                      {REFUND_REASONS.map(
                        (value) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {
                              value
                            }
                          </option>
                        ),
                      )}

                    </select>

                  </div>


                  {/* CUSTOM REASON */}

                  {reason ===
                    "Other" && (

                    <div className="space-y-2 md:col-span-2">

                      <label className="text-sm font-semibold">
                        Refund reason
                      </label>


                      <input
                        value={
                          customReason
                        }
                        disabled={
                          processing
                        }
                        onChange={(
                          event,
                        ) =>
                          setCustomReason(
                            event.target.value,
                          )
                        }
                        placeholder="Explain why this item is being refunded"
                        className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
                      />

                    </div>

                  )}


                  {/* NOTE */}

                  <div className="space-y-2 md:col-span-2">

                    <label className="text-sm font-semibold">
                      Internal note
                    </label>


                    <textarea
                      value={
                        note
                      }
                      disabled={
                        processing
                      }
                      onChange={(
                        event,
                      ) =>
                        setNote(
                          event.target.value,
                        )
                      }
                      rows={3}
                      maxLength={500}
                      placeholder="Optional information for the audit trail"
                      className="w-full resize-none rounded-[14px] border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
                    />

                  </div>

                </div>


                {/* ==============================================
                    SUMMARY
                =============================================== */}

                <div className="rounded-[18px] border bg-muted/20 p-4">

                  <div className="flex items-center justify-between gap-4">

                    <div>

                      <p className="text-xs text-muted-foreground">
                        Items being refunded
                      </p>


                      <p className="mt-1 text-xl font-bold">
                        {
                          refundQuantity
                        }
                      </p>

                    </div>


                    <div className="text-right">

                      <p className="text-xs text-muted-foreground">
                        Refund total
                      </p>


                      <p className="mt-1 text-2xl font-bold text-primary">
                        {formatSaleMoney(
                          refundTotal,
                          sale.currencyCode,
                        )}
                      </p>

                    </div>

                  </div>

                </div>


                {/* ==============================================
                    WARNING
                =============================================== */}

                <div className="flex items-start gap-3 rounded-[16px] border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-700 dark:text-amber-300">

                  <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />


                  <p>
                    Confirming creates a permanent refund audit record. Items marked for restocking will immediately be added back to inventory.
                  </p>

                </div>

              </>

            )}

          </div>

        </div>


        {/* ====================================================
            STICKY ACTION BAR
        ===================================================== */}

        {hasRefundableItems && (

          <div className="shrink-0 border-t bg-background/95 pt-4 backdrop-blur">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="text-xs text-muted-foreground">
                  Refund total
                </p>


                <p className="text-lg font-bold text-primary">
                  {formatSaleMoney(
                    refundTotal,
                    sale.currencyCode,
                  )}
                </p>

              </div>


              <div className="flex flex-col-reverse gap-2 sm:flex-row">

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-[14px]"
                  disabled={
                    processing
                  }
                  onClick={
                    onClose
                  }
                >
                  Cancel
                </Button>


                <Button
                  type="button"
                  className="rounded-[14px]"
                  disabled={
                    processing ||
                    selectedItems.length ===
                      0
                  }
                  onClick={() =>
                    void handleRefund()
                  }
                >

                  {processing ? (

                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                  ) : (

                    <RotateCcw className="mr-2 h-4 w-4" />

                  )}


                  {processing
                    ? "Processing…"
                    : `Confirm Refund · ${formatSaleMoney(
                        refundTotal,
                        sale.currencyCode,
                      )}`}

                </Button>

              </div>

            </div>

          </div>

        )}

      </div>

    </Dialog>
  );
}