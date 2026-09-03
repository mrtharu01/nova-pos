"use client";

import * as React from "react";

import {
  Loader2,
  Printer,
  ReceiptText,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  ReceiptDocument,
} from "@/components/receipts/ReceiptDocument";

import {
  fetchSaleReceipt,
} from "@/lib/data/receipts";

import type {
  ReceiptPaperWidth,
  SaleReceipt,
} from "@/lib/domain/receipts";


type ReceiptDialogProps = {
  saleId:
    string | null;

  isOpen:
    boolean;

  onClose:
    () => void;

  businessName:
    string;

  isReprint?:
    boolean;
};


function errorMessage(
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

  return "Receipt could not be loaded.";
}


export function ReceiptDialog({
  saleId,
  isOpen,
  onClose,
  businessName,
  isReprint = false,
}: ReceiptDialogProps) {
  const [
    receipt,
    setReceipt,
  ] =
    React.useState<
      SaleReceipt | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    React.useState(false);

  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);

  const [
    paperWidth,
    setPaperWidth,
  ] =
    React.useState<
      ReceiptPaperWidth
    >(
      "80mm",
    );

  const autoPrintedRef =
    React.useRef<
      string | null
    >(null);


  React.useEffect(() => {
    if (
      !isOpen ||
      !saleId
    ) {
      return;
    }


    let cancelled =
      false;


    async function load() {
      setLoading(
        true,
      );

      setError(
        null,
      );

      setReceipt(
        null,
      );


      try {
        const result =
          await fetchSaleReceipt(
            saleId!,
          );


        if (
          cancelled
        ) {
          return;
        }


        setReceipt(
          result,
        );


        setPaperWidth(
          result.settings
            .paperWidth,
        );
      } catch (cause) {
        if (
          cancelled
        ) {
          return;
        }

        setError(
          errorMessage(
            cause,
          ),
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }


    void load();


    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    saleId,
  ]);


  /*
   * OPTIONAL AUTO PRINT
   *
   * Disabled by default in the DB.
   *
   * If auto_print becomes true,
   * newly completed receipts can
   * immediately open the browser's
   * print dialog.
   */

  React.useEffect(() => {
    if (
      !isOpen ||
      !receipt ||
      isReprint ||
      !receipt.settings
        .autoPrint
    ) {
      return;
    }


    if (
      autoPrintedRef.current ===
      receipt.saleId
    ) {
      return;
    }


    autoPrintedRef.current =
      receipt.saleId;


    const timer =
      window.setTimeout(
        () => {
          window.print();
        },
        350,
      );


    return () =>
      window.clearTimeout(
        timer,
      );
  }, [
    isOpen,
    receipt,
    isReprint,
  ]);


  function printReceipt() {
    window.print();
  }


  return (
    <Dialog
      isOpen={
        isOpen
      }
      onClose={
        onClose
      }
      title={
        isReprint
          ? "Reprint Receipt"
          : "Receipt Ready"
      }
      description={
        receipt
          ? receipt.receiptNumber
          : "Loading completed sale…"
      }
      className="max-w-2xl"
    >

      {loading && (
        <div className="flex min-h-72 flex-col items-center justify-center">

          <Loader2 className="h-8 w-8 animate-spin text-primary" />

          <p className="mt-4 text-sm text-muted-foreground">
            Generating receipt from
            saved sale…
          </p>

        </div>
      )}


      {error && (
        <div className="rounded-[20px] border border-destructive/30 bg-destructive/5 p-5">

          <div className="flex gap-3">

            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

            <div>

              <p className="font-semibold text-destructive">
                Receipt could not
                be generated
              </p>

              <p className="mt-1 text-sm text-destructive">
                {error}
              </p>

            </div>

          </div>

        </div>
      )}


      {receipt && (
        <div className="space-y-4">

          {/* =====================
              TOOLBAR
          ====================== */}

          <div className="flex flex-col gap-3 rounded-[20px] border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex gap-2">

              <Button
                type="button"
                size="sm"
                variant={
                  paperWidth ===
                  "58mm"
                    ? "default"
                    : "outline"
                }
                className="rounded-[12px]"
                onClick={() =>
                  setPaperWidth(
                    "58mm",
                  )
                }
              >
                58mm
              </Button>


              <Button
                type="button"
                size="sm"
                variant={
                  paperWidth ===
                  "80mm"
                    ? "default"
                    : "outline"
                }
                className="rounded-[12px]"
                onClick={() =>
                  setPaperWidth(
                    "80mm",
                  )
                }
              >
                80mm
              </Button>

            </div>


            <div className="flex gap-2">

              <Button
                type="button"
                variant="outline"
                className="rounded-[12px]"
                onClick={
                  onClose
                }
              >
                <X className="mr-2 h-4 w-4" />

                Close
              </Button>


              <Button
                type="button"
                className="rounded-[12px]"
                onClick={
                  printReceipt
                }
              >
                <Printer className="mr-2 h-4 w-4" />

                {isReprint
                  ? "Reprint"
                  : "Print Receipt"}
              </Button>

            </div>

          </div>


          {/* =====================
              PREVIEW
          ====================== */}

          <div className="max-h-[65vh] overflow-auto rounded-[24px] bg-muted/60 p-6">

            <ReceiptDocument
              receipt={
                receipt
              }
              businessName={
                businessName
              }
              paperWidth={
                paperWidth
              }
              isReprint={
                isReprint
              }
            />

          </div>


          <div className="flex items-start gap-2 rounded-[16px] border bg-muted/20 p-3 text-xs text-muted-foreground">

            <ReceiptText className="mt-0.5 h-4 w-4 shrink-0" />

            Choose the same paper
            width as your thermal
            printer before printing.

          </div>

        </div>
      )}

    </Dialog>
  );
}