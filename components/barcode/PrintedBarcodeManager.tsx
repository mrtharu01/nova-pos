"use client";

import * as React from "react";

import {
  Barcode,
  Camera,
  CheckCircle2,
  Loader2,
  ScanLine,
  Trash2,
} from "lucide-react";

import {
  RemoteScannerControl,
} from "@/components/pos/RemoteScannerControl";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Scanner,
} from "@/components/ui/scanner";

import type {
  Product,
} from "@/lib/domain/catalog";

import {
  setVariantBarcode,
} from "@/lib/data/catalog-admin";

import {
  parseNovaQrValue,
} from "@/lib/qr/qr-value";

import type {
  RemoteScanResult,
} from "@/lib/remote-scanner/protocol";

type VariantRecord = {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  barcode?: string;
};

function flattenVariants(
  products: Product[],
): VariantRecord[] {
  return products.flatMap(
    (
      product,
    ) =>
      product.variants.map(
        (
          variant,
        ) => ({
          productId:
            product.id,
          productName:
            product.name,
          variantId:
            variant.id,
          variantName:
            variant.name,
          sku:
            variant.sku,
          barcode:
            variant.barcode,
        }),
      ),
  );
}

function validatePrintedBarcode(
  value: string,
  records: VariantRecord[],
  targetVariantId: string,
  staged:
    Map<string, string>,
) {
  const barcode =
    value.trim();


  if (!barcode) {
    return {
      ok:
        false as const,
      message:
        "No barcode value was detected.",
    };
  }


  if (
    barcode.length >
    128
  ) {
    return {
      ok:
        false as const,
      message:
        "Barcode values must be 128 characters or fewer.",
    };
  }


  if (
    parseNovaQrValue(
      barcode,
    )
    ||
    /^ARC1[VB]/i.test(
      barcode,
    )
  ) {
    return {
      ok:
        false as const,
      message:
        "That is an ARC-generated identity. Scan the barcode already printed on the product/package instead.",
    };
  }


  const duplicate =
    records.find(
      (
        record,
      ) =>
        record.variantId !==
          targetVariantId
        &&
        record.barcode?.trim() ===
          barcode,
    );


  if (duplicate) {
    return {
      ok:
        false as const,
      message:
        `That barcode is already assigned to ${duplicate.productName} · ${duplicate.variantName}.`,
    };
  }


  const stagedDuplicate =
    Array.from(
      staged.entries(),
    ).find(
      (
        [
          variantId,
          stagedBarcode,
        ],
      ) =>
        variantId !==
          targetVariantId
        &&
        stagedBarcode ===
          barcode,
    );


  if (
    stagedDuplicate
  ) {
    const record =
      records.find(
        (
          item,
        ) =>
          item.variantId ===
          stagedDuplicate[0],
      );

    return {
      ok:
        false as const,
      message:
        `That barcode is already staged for ${record?.productName ?? "another product"}.`,
    };
  }


  return {
    ok:
      true as const,
    barcode,
  };
}

function getErrorMessage(
  cause: unknown,
) {
  if (
    cause instanceof Error
  ) {
    return cause.message;
  }

  if (
    cause
    &&
    typeof cause ===
      "object"
    &&
    "message" in cause
    &&
    typeof (
      cause as {
        message?: unknown;
      }
    ).message ===
      "string"
  ) {
    return (
      cause as {
        message: string;
      }
    ).message;
  }

  return "ARC could not update the printed barcode.";
}

export function PrintedBarcodeManager({
  products,
  refresh,
}: {
  products: Product[];
  refresh: () => Promise<void>;
}) {
  const records =
    React.useMemo(
      () =>
        flattenVariants(
          products,
        ),
      [
        products,
      ],
    );

  const missingRecords =
    React.useMemo(
      () =>
        records.filter(
          (
            record,
          ) =>
            !record.barcode,
        ),
      [
        records,
      ],
    );

  const [
    dialogOpen,
    setDialogOpen,
  ] =
    React.useState(
      false,
    );

  const [
    bulkMode,
    setBulkMode,
  ] =
    React.useState(
      false,
    );

  const [
    targetVariantId,
    setTargetVariantId,
  ] =
    React.useState(
      "",
    );

  const [
    value,
    setValue,
  ] =
    React.useState(
      "",
    );

  const [
    staged,
    setStaged,
  ] =
    React.useState<
      Map<
        string,
        string
      >
    >(
      new Map(),
    );

  const [
    scannerOpen,
    setScannerOpen,
  ] =
    React.useState(
      false,
    );

  const [
    saving,
    setSaving,
  ] =
    React.useState(
      false,
    );

  const [
    feedback,
    setFeedback,
  ] =
    React.useState<
      string | null
    >(
      null,
    );

  const [
    feedbackError,
    setFeedbackError,
  ] =
    React.useState(
      false,
    );

  const target =
    records.find(
      (
        record,
      ) =>
        record.variantId ===
        targetVariantId,
    ) ??
    null;


  React.useEffect(
    () => {
      if (
        bulkMode
      ) {
        return;
      }

      setValue(
        target?.barcode ??
        "",
      );
    },
    [
      target,
      bulkMode,
    ],
  );


  function openManage() {
    const first =
      records[0];

    setBulkMode(
      false,
    );

    setTargetVariantId(
      first?.variantId ??
      "",
    );

    setFeedback(
      null,
    );

    setDialogOpen(
      true,
    );
  }


  function openBulkMissing() {
    const first =
      missingRecords[0];

    setStaged(
      new Map(),
    );

    setBulkMode(
      true,
    );

    setTargetVariantId(
      first?.variantId ??
      "",
    );

    setValue(
      "",
    );

    setFeedback(
      null,
    );

    setDialogOpen(
      true,
    );
  }


  function nextMissingTarget(
    currentVariantId: string,
    nextStaged:
      Map<string, string>,
  ) {
    const currentIndex =
      missingRecords.findIndex(
        (
          record,
        ) =>
          record.variantId ===
          currentVariantId,
      );

    const ordered = [
      ...missingRecords.slice(
        currentIndex +
          1,
      ),
      ...missingRecords.slice(
        0,
        Math.max(
          0,
          currentIndex,
        ),
      ),
    ];

    return ordered.find(
      (
        record,
      ) =>
        !nextStaged.has(
          record.variantId,
        ),
    );
  }


  function captureForTarget(
    scanValue: string,
  ): RemoteScanResult {
    if (!target) {
      return {
        accepted:
          false,
        message:
          "Choose a product variant first.",
      };
    }

    const validation =
      validatePrintedBarcode(
        scanValue,
        records,
        target.variantId,
        staged,
      );


    if (
      !validation.ok
    ) {
      setFeedback(
        validation.message,
      );

      setFeedbackError(
        true,
      );

      return {
        accepted:
          false,
        message:
          validation.message,
      };
    }


    if (
      bulkMode
    ) {
      const nextStaged =
        new Map(
          staged,
        );

      nextStaged.set(
        target.variantId,
        validation.barcode,
      );

      setStaged(
        nextStaged,
      );

      const next =
        nextMissingTarget(
          target.variantId,
          nextStaged,
        );

      if (next) {
        setTargetVariantId(
          next.variantId,
        );

        setValue(
          "",
        );

        setFeedback(
          `Captured ${target.productName}. Next: ${next.productName} · ${next.variantName}.`,
        );
      } else {
        setFeedback(
          "All currently missing printed barcodes have been captured. Save assignments when ready.",
        );
      }

      setFeedbackError(
        false,
      );

      return {
        accepted:
          true,
        label:
          `${target.productName} · ${target.variantName}`,
        message:
          "Printed barcode captured.",
      };
    }


    setValue(
      validation.barcode,
    );

    setFeedback(
      `Captured printed barcode for ${target.productName}.`,
    );

    setFeedbackError(
      false,
    );

    return {
      accepted:
        true,
      label:
        `${target.productName} · ${target.variantName}`,
      message:
        "Barcode captured. Save to apply it.",
    };
  }


  async function saveSingle() {
    if (
      !target ||
      saving
    ) {
      return;
    }

    const trimmed =
      value.trim();

    if (trimmed) {
      const validation =
        validatePrintedBarcode(
          trimmed,
          records,
          target.variantId,
          staged,
        );

      if (
        !validation.ok
      ) {
        setFeedback(
          validation.message,
        );

        setFeedbackError(
          true,
        );

        return;
      }
    }


    setSaving(
      true,
    );

    setFeedback(
      null,
    );

    try {
      await setVariantBarcode({
        variantId:
          target.variantId,
        barcode:
          trimmed ||
          null,
      });

      await refresh();

      setFeedback(
        trimmed
          ? "Printed barcode saved. ARC-generated barcode remains valid too."
          : "Printed barcode cleared. ARC QR/SKU/generated barcode are unaffected.",
      );

      setFeedbackError(
        false,
      );
    } catch (
      cause
    ) {
      setFeedback(
        getErrorMessage(
          cause,
        ),
      );

      setFeedbackError(
        true,
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  async function saveBulk() {
    if (
      staged.size ===
        0 ||
      saving
    ) {
      return;
    }

    setSaving(
      true,
    );

    setFeedback(
      null,
    );

    try {
      for (
        const [
          variantId,
          barcode,
        ] of staged
      ) {
        await setVariantBarcode({
          variantId,
          barcode,
        });
      }

      const savedCount =
        staged.size;

      setStaged(
        new Map(),
      );

      await refresh();

      setFeedback(
        `${savedCount} printed barcode${savedCount === 1 ? "" : "s"} saved. Existing ARC-generated labels remain valid.`,
      );

      setFeedbackError(
        false,
      );
    } catch (
      cause
    ) {
      setFeedback(
        getErrorMessage(
          cause,
        ),
      );

      setFeedbackError(
        true,
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <>
      <div className="mb-6 rounded-[24px] border bg-card p-5 sm:p-6">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          <div>
            <div className="flex items-center gap-2">
              <Barcode className="h-5 w-5" />

              <h3 className="font-semibold">
                Printed barcode assignment
              </h3>
            </div>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Use this when a product already has a barcode printed on its package, including products imported without their barcode by mistake. Adding it later never replaces or invalidates ARC&apos;s generated barcode.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={
                openManage
              }
              disabled={
                records.length ===
                0
              }
            >
              Manage printed barcodes
            </Button>

            <Button
              type="button"
              className="rounded-[14px]"
              onClick={
                openBulkMissing
              }
              disabled={
                missingRecords.length ===
                0
              }
            >
              <ScanLine className="mr-2 h-4 w-4" />
              Assign missing ({missingRecords.length})
            </Button>

          </div>

        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">

          <div className="rounded-[16px] border bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Variants
            </p>

            <p className="mt-1 text-lg font-semibold">
              {records.length}
            </p>
          </div>

          <div className="rounded-[16px] border bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Printed barcode assigned
            </p>

            <p className="mt-1 text-lg font-semibold">
              {records.length -
                missingRecords.length}
            </p>
          </div>

          <div className="rounded-[16px] border bg-muted/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              ARC fallback available
            </p>

            <p className="mt-1 text-lg font-semibold">
              {records.length}
            </p>
          </div>

        </div>

      </div>


      <Dialog
        isOpen={
          dialogOpen
        }
        onClose={() =>
          !saving &&
          setDialogOpen(
            false,
          )
        }
        title={
          bulkMode
            ? "Assign missing printed barcodes"
            : "Manage printed barcode"
        }
        description={
          bulkMode
            ? "Scan the barcode already printed on each physical product. ARC advances through products that are missing one."
            : "Add, replace, or clear the product's existing manufacturer/printed barcode."
        }
        className="max-w-2xl"
      >

        <div className="space-y-4">

          {feedback && (
            <div
              className={
                feedbackError
                  ? "rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  : "rounded-[16px] border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"
              }
            >
              {feedback}
            </div>
          )}


          {!bulkMode && (
            <div>

              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Product variant
              </label>

              <select
                value={
                  targetVariantId
                }
                onChange={
                  (
                    event,
                  ) =>
                    setTargetVariantId(
                      event.target.value,
                    )
                }
                className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none"
              >
                {records.map(
                  (
                    record,
                  ) => (
                    <option
                      key={
                        record.variantId
                      }
                      value={
                        record.variantId
                      }
                    >
                      {record.productName} · {record.variantName} · {record.sku}
                    </option>
                  ),
                )}
              </select>

            </div>
          )}


          {target && (
            <div className="rounded-[18px] border bg-muted/20 p-4">

              <div className="flex items-start justify-between gap-4">

                <div>
                  <p className="font-semibold">
                    {target.productName}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {target.variantName} · {target.sku}
                  </p>
                </div>

                {bulkMode && (
                  <div className="rounded-full border bg-background px-3 py-1 text-xs font-semibold">
                    {staged.size}/{missingRecords.length} captured
                  </div>
                )}

              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Current printed barcode
              </p>

              <p className="mt-1 font-mono text-sm font-semibold">
                {target.barcode ??
                  "Not assigned"}
              </p>

            </div>
          )}


          {!bulkMode && (
            <div>

              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Printed / manufacturer barcode
              </label>

              <Input
                value={
                  value
                }
                onChange={
                  (
                    event,
                  ) =>
                    setValue(
                      event.target.value,
                    )
                }
                placeholder="Scan or type the code printed on the product"
              />

              <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
                This is optional and separate from ARC&apos;s permanent generated barcode. Both can scan the same product.
              </p>

            </div>
          )}


          <div className="flex flex-wrap gap-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={() =>
                setScannerOpen(
                  true,
                )
              }
              disabled={
                !target
              }
            >
              <Camera className="mr-2 h-4 w-4" />
              Scan with this device
            </Button>

            <RemoteScannerControl
              onScan={
                captureForTarget
              }
            />

          </div>


          {bulkMode &&
            staged.size >
              0 && (
            <div className="rounded-[18px] border bg-muted/20 p-4">

              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />

                <p className="text-sm font-semibold">
                  Captured assignments
                </p>
              </div>

              <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">

                {Array.from(
                  staged.entries(),
                ).map(
                  (
                    [
                      variantId,
                      barcode,
                    ],
                  ) => {
                    const record =
                      records.find(
                        (
                          item,
                        ) =>
                          item.variantId ===
                          variantId,
                      );

                    return (
                      <div
                        key={
                          variantId
                        }
                        className="flex items-center justify-between gap-3 rounded-[14px] border bg-background px-3 py-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {record?.productName}
                          </p>

                          <p className="mt-0.5 truncate text-muted-foreground">
                            {record?.variantName} · {record?.sku}
                          </p>
                        </div>

                        <p className="shrink-0 font-mono font-semibold">
                          {barcode}
                        </p>
                      </div>
                    );
                  },
                )}

              </div>

            </div>
          )}


          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">

            {!bulkMode &&
              target?.barcode && (
              <Button
                type="button"
                variant="outline"
                className="rounded-[14px] text-destructive"
                disabled={
                  saving
                }
                onClick={() => {
                  setValue(
                    "",
                  );

                  void saveSingle();
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear printed barcode
              </Button>
            )}

            <Button
              type="button"
              className="rounded-[14px]"
              disabled={
                saving
                ||
                (
                  bulkMode
                    ? staged.size ===
                      0
                    : !target
                )
              }
              onClick={() =>
                void (
                  bulkMode
                    ? saveBulk()
                    : saveSingle()
                )
              }
            >
              {saving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              {bulkMode
                ? `Save ${staged.size} assignment${staged.size === 1 ? "" : "s"}`
                : "Save printed barcode"}
            </Button>

          </div>

        </div>

      </Dialog>


      <Scanner
        isOpen={
          scannerOpen
        }
        onClose={() =>
          setScannerOpen(
            false,
          )
        }
        continuous={
          bulkMode
        }
        onScan={
          (
            scanValue,
          ) =>
            captureForTarget(
              scanValue,
            ).accepted
        }
      />
    </>
  );
}
