"use client";

import * as React from "react";

import {
  Ban,
  Loader2,
  TriangleAlert,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  voidSale,
} from "@/lib/data/refunds";

import type {
  VoidSaleResult,
} from "@/lib/domain/refunds";

import type {
  SaleDetail,
} from "@/lib/domain/sale-detail";

import {
  formatSaleMoney,
} from "@/lib/domain/sales";


type VoidSaleDialogProps = {
  isOpen: boolean;

  onClose: () => void;

  sale: SaleDetail;

  onCompleted: (
    result: VoidSaleResult,
  ) => void;
};


const VOID_REASONS = [
  "Accidental transaction",
  "Duplicate transaction",
  "Incorrect checkout",
  "Payment failed",
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

  return "Sale could not be voided.";
}


export function VoidSaleDialog({
  isOpen,
  onClose,
  sale,
  onCompleted,
}: VoidSaleDialogProps) {
  const [
    reason,
    setReason,
  ] =
    React.useState(
      "Accidental transaction",
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


  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    setReason(
      "Accidental transaction",
    );

    setCustomReason("");

    setNote("");

    setError(null);
  }, [
    isOpen,
  ]);


  async function handleVoid() {
    if (
      processing
    ) {
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
        "Enter a reason for voiding this transaction.",
      );

      return;
    }


    setProcessing(true);
    setError(null);


    try {
      const result =
        await voidSale({
          businessId:
            sale.businessId,

          saleId:
            sale.id,

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


  return (
    <Dialog
      isOpen={isOpen}
      onClose={
        processing
          ? () => {}
          : onClose
      }
      title="Void Sale"
      description={`Void ${sale.receiptNumber} and reverse the transaction.`}
      className="max-w-lg"
    >

      <div className="space-y-5">

        <div className="flex items-start gap-3 rounded-[18px] border border-destructive/25 bg-destructive/5 p-4">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-destructive/10 text-destructive">
            <Ban className="h-5 w-5" />
          </div>


          <div>

            <p className="font-semibold text-destructive">
              This transaction will be voided
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              The original transaction remains in the audit trail, its payment becomes voided, and all sold inventory quantities are restored.
            </p>

          </div>

        </div>


        <div className="rounded-[18px] border bg-muted/20 p-4">

          <div className="flex items-center justify-between gap-4">

            <span className="text-sm text-muted-foreground">
              Receipt
            </span>

            <span className="font-semibold">
              {
                sale.receiptNumber
              }
            </span>

          </div>


          <div className="mt-3 flex items-center justify-between gap-4">

            <span className="text-sm text-muted-foreground">
              Transaction total
            </span>

            <span className="font-bold">
              {formatSaleMoney(
                sale.total,
                sale.currencyCode,
              )}
            </span>

          </div>


          <div className="mt-3 flex items-center justify-between gap-4">

            <span className="text-sm text-muted-foreground">
              Inventory restored
            </span>

            <span className="font-semibold">
              {sale.itemQuantityTotal} items
            </span>

          </div>

        </div>


        {error && (
          <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

            {error}

          </div>
        )}


        <div className="space-y-2">

          <label className="text-sm font-semibold">
            Reason
          </label>


          <select
            value={reason}
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

            {VOID_REASONS.map(
              (value) => (
                <option
                  key={value}
                  value={value}
                >
                  {value}
                </option>
              ),
            )}

          </select>

        </div>


        {reason ===
          "Other" && (

          <div className="space-y-2">

            <label className="text-sm font-semibold">
              Void reason
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
              placeholder="Explain why this sale is being voided"
              className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
            />

          </div>

        )}


        <div className="space-y-2">

          <label className="text-sm font-semibold">
            Internal note
          </label>

          <textarea
            value={note}
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


        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

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
            variant="destructive"
            className="rounded-[14px]"
            disabled={
              processing
            }
            onClick={() =>
              void handleVoid()
            }
          >

            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}

            {processing
              ? "Voiding…"
              : "Confirm Void"}

          </Button>

        </div>

      </div>

    </Dialog>
  );
}