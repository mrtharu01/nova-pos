"use client";

import * as React from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  RemoteScannerControl,
} from "@/components/pos/RemoteScannerControl";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  bulkImportProducts,
  type BulkProductImportResult,
} from "@/lib/data/catalog-admin";

import {
  buildCatalogCsvFromImportRows,
  buildCatalogCsvTemplate,
  buildCatalogImportPreview,
  type CatalogImportPreview,
  type CatalogImportPreviewRow,
} from "@/lib/import/catalog-import";

import {
  parseSpreadsheetFile,
} from "@/lib/import/spreadsheet";

import {
  parseNovaQrValue,
} from "@/lib/qr/qr-value";

import type {
  RemoteScanResult,
} from "@/lib/remote-scanner/protocol";


const MAX_ROWS =
  2000;


const IDENTITY_ERROR =
  "Provide a SKU or barcode.";


function refreshIdentityValidation(
  rows:
    CatalogImportPreviewRow[],
) {
  const seenSkus =
    new Map<
      string,
      number
    >();


  const seenBarcodes =
    new Map<
      string,
      number
    >();


  const nextRows =
    rows.map(
      (
        row,
      ) => {
        const sku =
          row.data.sku
            ?.trim()
            .toUpperCase() ??
          "";


        const barcode =
          row.data.barcode
            ?.trim() ??
          "";


        const errors =
          row.errors.filter(
            (
              message,
            ) =>
              message !==
                IDENTITY_ERROR &&
              !message.startsWith(
                "SKU duplicates row ",
              ) &&
              !message.startsWith(
                "Barcode duplicates row ",
              ),
          );


        if (
          !sku &&
          !barcode
        ) {
          errors.push(
            IDENTITY_ERROR,
          );
        }


        if (
          sku
        ) {
          const key =
            sku.toLowerCase();


          const duplicateRow =
            seenSkus.get(
              key,
            );


          if (
            duplicateRow
          ) {
            errors.push(
              `SKU duplicates row ${duplicateRow}.`,
            );
          } else {
            seenSkus.set(
              key,
              row.sourceRow,
            );
          }
        }


        if (
          barcode
        ) {
          const duplicateRow =
            seenBarcodes.get(
              barcode,
            );


          if (
            duplicateRow
          ) {
            errors.push(
              `Barcode duplicates row ${duplicateRow}.`,
            );
          } else {
            seenBarcodes.set(
              barcode,
              row.sourceRow,
            );
          }
        }


        return {
          ...row,

          data: {
            ...row.data,

            sku,

            barcode:
              barcode ||
              undefined,
          },

          errors,
        };
      },
    );


  return {
    rows:
      nextRows,

    validRows:
      nextRows.filter(
        (
          row,
        ) =>
          row.errors.length ===
            0,
      ).length,

    invalidRows:
      nextRows.filter(
        (
          row,
        ) =>
          row.errors.length >
            0,
      ).length,
  };
}


export function BulkProductImport() {
  const inputRef =
    React.useRef<
      HTMLInputElement |
      null
    >(
      null,
    );


  const [
    fileName,
    setFileName,
  ] =
    React.useState(
      "",
    );


  const [
    preview,
    setPreview,
  ] =
    React.useState<
      CatalogImportPreview |
      null
    >(
      null,
    );


  const [
    parsing,
    setParsing,
  ] =
    React.useState(
      false,
    );


  const [
    importing,
    setImporting,
  ] =
    React.useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string |
      null
    >(
      null,
    );


  const [
    result,
    setResult,
  ] =
    React.useState<
      BulkProductImportResult |
      null
    >(
      null,
    );


  const [
    captureTargetSourceRow,
    setCaptureTargetSourceRow,
  ] =
    React.useState<
      number |
      null
    >(
      null,
    );


  function reset() {
    setFileName(
      "",
    );

    setPreview(
      null,
    );

    setError(
      null,
    );

    setResult(
      null,
    );


    setCaptureTargetSourceRow(
      null,
    );


    if (
      inputRef.current
    ) {
      inputRef.current.value =
        "";
    }
  }


  function downloadTemplate() {
    const blob =
      new Blob(
        [
          buildCatalogCsvTemplate(),
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
      "nova-product-import-template.csv";


    document.body
      .appendChild(
        anchor,
      );


    anchor.click();

    anchor.remove();


    URL.revokeObjectURL(
      url,
    );
  }


  function downloadWorkingCopy() {
    if (
      !preview
    ) {
      return;
    }


    const blob =
      new Blob(
        [
          buildCatalogCsvFromImportRows(
            preview.rows.map(
              (
                row,
              ) =>
                row.data,
            ),
          ),
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


    const baseName =
      (
        fileName ||
        "nova-products"
      )
        .replace(
          /\.[^.]+$/,
          "",
        )
        .replace(
          /[^a-z0-9-_]+/gi,
          "-",
        );


    anchor.href =
      url;

    anchor.download =
      `${baseName}-with-barcodes.csv`;


    document.body
      .appendChild(
        anchor,
      );


    anchor.click();

    anchor.remove();


    URL.revokeObjectURL(
      url,
    );
  }


  function captureBarcode(
    value:
      string,
  ): RemoteScanResult {
    if (
      !preview
    ) {
      return {
        accepted:
          false,

        message:
          "Upload a spreadsheet before scanning barcodes.",
      };
    }


    const barcode =
      value.trim();


    if (
      !barcode
    ) {
      return {
        accepted:
          false,

        message:
          "No barcode value was detected.",
      };
    }


    if (
      parseNovaQrValue(
        barcode,
      )
    ) {
      return {
        accepted:
          false,

        message:
          "That is a NOVA QR code. Scan the manufacturer barcode printed on the product.",
      };
    }


    const targetSourceRow =
      captureTargetSourceRow ??
      preview.rows.find(
        (
          row,
        ) =>
          !row.data.barcode,
      )?.sourceRow;


    if (
      !targetSourceRow
    ) {
      return {
        accepted:
          false,

        message:
          "Every spreadsheet row already has a barcode.",
      };
    }


    const target =
      preview.rows.find(
        (
          row,
        ) =>
          row.sourceRow ===
          targetSourceRow,
      );


    if (
      !target
    ) {
      return {
        accepted:
          false,

        message:
          "The selected spreadsheet row could not be found.",
      };
    }


    const duplicate =
      preview.rows.find(
        (
          row,
        ) =>
          row.sourceRow !==
            targetSourceRow &&
          row.data.barcode
            ?.trim() ===
            barcode,
      );


    if (
      duplicate
    ) {
      return {
        accepted:
          false,

        message:
          `That barcode is already assigned to row ${duplicate.sourceRow}: ${duplicate.data.product_name}.`,
      };
    }


    const changedRows =
      preview.rows.map(
        (
          row,
        ) =>
          row.sourceRow ===
            targetSourceRow
            ? {
                ...row,

                data: {
                  ...row.data,

                  barcode,

                  sku:
                    row.data.sku
                      ?.trim()
                      .toUpperCase() ||
                    `BC-${barcode}`
                      .toUpperCase(),
                },
              }
            : row,
      );


    const refreshed =
      refreshIdentityValidation(
        changedRows,
      );


    const currentIndex =
      refreshed.rows.findIndex(
        (
          row,
        ) =>
          row.sourceRow ===
          targetSourceRow,
      );


    const nextTarget =
      refreshed.rows
        .slice(
          currentIndex +
            1,
        )
        .find(
          (
            row,
          ) =>
            !row.data.barcode,
        ) ??
      refreshed.rows.find(
        (
          row,
        ) =>
          !row.data.barcode,
      );


    setPreview({
      ...preview,

      rows:
        refreshed.rows,

      validRows:
        refreshed.validRows,

      invalidRows:
        refreshed.invalidRows,
    });


    setCaptureTargetSourceRow(
      nextTarget?.sourceRow ??
      null,
    );


    return {
      accepted:
        true,

      label:
        target.data.product_name,

      message:
        nextTarget
          ? `Barcode saved for ${target.data.product_name}. Next: row ${nextTarget.sourceRow} · ${nextTarget.data.product_name}.`
          : `Barcode saved for ${target.data.product_name}. All spreadsheet rows now have barcodes.`,
    };
  }


  async function chooseFile(
    file?:
      File,
  ) {
    if (
      !file ||
      parsing ||
      importing
    ) {
      return;
    }


    setParsing(
      true,
    );

    setError(
      null,
    );

    setResult(
      null,
    );


    try {
      const parsed =
        await parseSpreadsheetFile(
          file,
        );


      const nextPreview =
        buildCatalogImportPreview(
          parsed.rows,
        );


      if (
        nextPreview.rows.length ===
          0
      ) {
        throw new Error(
          "No product rows were found in this file.",
        );
      }


      if (
        nextPreview.rows.length >
          MAX_ROWS
      ) {
        throw new Error(
          `This file has ${nextPreview.rows.length} product rows. NOVA imports up to ${MAX_ROWS} rows at a time.`,
        );
      }


      if (
        !nextPreview
          .recognizedColumns
          .includes(
            "product_name",
          )
      ) {
        throw new Error(
          "NOVA could not find a Product Name column.",
        );
      }


      if (
        !nextPreview
          .recognizedColumns
          .includes(
            "price",
          )
      ) {
        throw new Error(
          "NOVA could not find a Price column.",
        );
      }


      setFileName(
        parsed.fileName,
      );

      setPreview(
        nextPreview,
      );


      setCaptureTargetSourceRow(
        nextPreview.rows.find(
          (
            row,
          ) =>
            !row.data.barcode,
        )?.sourceRow ??
        null,
      );
    } catch (
      cause
    ) {
      setFileName(
        "",
      );

      setPreview(
        null,
      );

      setError(
        cause instanceof Error
          ? cause.message
          : "NOVA could not read this spreadsheet.",
      );
    } finally {
      setParsing(
        false,
      );
    }
  }


  async function runImport() {
    if (
      !preview ||
      importing ||
      preview.invalidRows >
        0 ||
      preview.rows.length ===
        0
    ) {
      return;
    }


    setImporting(
      true,
    );

    setError(
      null,
    );

    setResult(
      null,
    );


    try {
      const importResult =
        await bulkImportProducts(
          preview.rows.map(
            (
              row,
            ) =>
              row.data,
          ),
        );


      setResult(
        importResult,
      );
    } catch (
      cause
    ) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The product import failed.",
      );
    } finally {
      setImporting(
        false,
      );
    }
  }


  const canImport =
    Boolean(
      preview,
    ) &&
    (
      preview?.invalidRows ??
      0
    ) ===
      0 &&
    (
      preview?.rows.length ??
      0
    ) >
      0 &&
    !importing;


  const shownRows =
    preview?.rows.slice(
      0,
      30,
    ) ??
    [];


  const capturedBarcodeCount =
    preview?.rows.filter(
      (
        row,
      ) =>
        Boolean(
          row.data.barcode,
        ),
    ).length ??
    0;


  const activeCaptureRow =
    preview?.rows.find(
      (
        row,
      ) =>
        row.sourceRow ===
        captureTargetSourceRow,
    ) ??
    null;


  return (
    <div className="space-y-6">

      <Card className="rounded-[24px]">

        <CardHeader>

          <CardTitle>
            Import Products
          </CardTitle>


          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Upload a CSV or modern Excel workbook (.xlsx). NOVA validates the sheet first, shows a preview, then imports the catalog and starting stock in one transaction.
          </p>

        </CardHeader>


        <CardContent className="space-y-5">

          <div className="grid gap-3 md:grid-cols-3">

            <div className="rounded-[18px] border bg-muted/10 p-4">

              <p className="text-sm font-semibold">
                One row = one variant
              </p>


              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Most shop products can simply use one row with Variant Name = Standard.
              </p>

            </div>


            <div className="rounded-[18px] border bg-muted/10 p-4">

              <p className="text-sm font-semibold">
                Group variants
              </p>


              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Give several rows the same Product Key to create one product with multiple variants.
              </p>

            </div>


            <div className="rounded-[18px] border bg-muted/10 p-4">

              <p className="text-sm font-semibold">
                SKU or barcode
              </p>


              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                If SKU is blank but Barcode exists, NOVA automatically creates a SKU from the barcode.
              </p>

            </div>

          </div>


          <div className="rounded-[18px] border border-dashed p-5">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <div className="flex items-center gap-2">

                  <FileSpreadsheet className="h-5 w-5" />


                  <p className="font-semibold">
                    CSV / Excel file
                  </p>

                </div>


                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Accepted: .csv, .tsv and .xlsx. For barcodes or SKUs with leading zeroes, format those Excel columns as Text before saving.
                </p>

              </div>


              <div className="flex flex-wrap gap-2">

                <Button
                  type="button"
                  variant="outline"
                  onClick={
                    downloadTemplate
                  }
                >
                  <Download className="mr-2 h-4 w-4" />

                  Download Template
                </Button>


                <Button
                  type="button"
                  disabled={
                    parsing ||
                    importing
                  }
                  onClick={() =>
                    inputRef.current
                      ?.click()
                  }
                >
                  {parsing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}

                  {parsing
                    ? "Reading..."
                    : "Choose File"}
                </Button>

              </div>

            </div>


            <input
              ref={
                inputRef
              }
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={
                (
                  event,
                ) =>
                  void chooseFile(
                    event.target.files?.[0],
                  )
              }
            />


            {fileName ? (

              <div className="mt-4 rounded-[14px] border bg-muted/20 px-4 py-3 text-sm">

                <span className="font-semibold">
                  {fileName}
                </span>


                {preview ? (
                  <span className="ml-2 text-muted-foreground">
                    · {preview.rows.length} row{preview.rows.length === 1 ? "" : "s"}
                  </span>
                ) : null}

              </div>

            ) : null}

          </div>


          <div className="rounded-[18px] border bg-muted/10 p-4">

            <p className="text-sm font-semibold">
              Recommended columns
            </p>


            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Product Name and Price are required. Add either SKU or Barcode. Optional columns: Product Key, Category, Description, Variant Name, Cost, Stock, Low Stock Threshold and Status.
            </p>


            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              Categories that do not already exist are created automatically. Blank Stock defaults to 0, Cost to 0, Low Stock Threshold to 5, Variant Name to Standard and Status to Active.
            </p>

          </div>

        </CardContent>

      </Card>


      {error ? (

        <div className="rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>

      ) : null}


      {result ? (

        <Card className="rounded-[24px] border-primary/30">

          <CardContent className="p-6">

            <div className="flex items-start gap-3">

              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />


              <div>

                <p className="font-semibold">
                  Import completed
                </p>


                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {result.productsCreated} products, {result.variantsCreated} variants and {result.categoriesCreated} new categories were created from {result.rowsImported} spreadsheet rows.
                </p>


                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={
                    reset
                  }
                >
                  Import Another File
                </Button>

              </div>

            </div>

          </CardContent>

        </Card>

      ) : null}


      {preview ? (

        <Card className="overflow-hidden rounded-[24px]">

          <CardHeader>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

              <div>

                <CardTitle>
                  Import Preview
                </CardTitle>


                <p className="mt-2 text-sm text-muted-foreground">
                  {preview.validRows} valid · {preview.invalidRows} with errors
                </p>

              </div>


              <Button
                type="button"
                disabled={
                  !canImport
                }
                onClick={() =>
                  void runImport()
                }
              >
                {importing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}

                {importing
                  ? "Importing..."
                  : `Import ${preview.rows.length} Rows`}
              </Button>

            </div>

          </CardHeader>


          <CardContent className="space-y-4">

            {preview.ignoredColumns.length >
            0 ? (

              <div className="rounded-[14px] border bg-muted/20 p-3 text-xs text-muted-foreground">
                Ignored columns: {preview.ignoredColumns.join(", ")}
              </div>

            ) : null}


            {preview.invalidRows >
            0 ? (

              <div className="flex gap-3 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />


                Fix the rows marked below and upload the sheet again. NOVA will not partially import a file with validation errors.

              </div>

            ) : null}


            <div className="overflow-x-auto">

              <table className="w-full min-w-[980px] text-left text-sm">

                <thead>

                  <tr className="border-b text-xs text-muted-foreground">

                    <th className="px-3 py-3">
                      Row
                    </th>

                    <th className="px-3 py-3">
                      Product
                    </th>

                    <th className="px-3 py-3">
                      Variant
                    </th>

                    <th className="px-3 py-3">
                      SKU
                    </th>

                    <th className="px-3 py-3">
                      Barcode
                    </th>

                    <th className="px-3 py-3">
                      Price
                    </th>

                    <th className="px-3 py-3">
                      Stock
                    </th>

                    <th className="px-3 py-3">
                      Status
                    </th>

                    <th className="px-3 py-3">
                      Validation
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {shownRows.map(
                    (
                      row,
                    ) => (

                      <tr
                        key={
                          row.sourceRow
                        }
                        className="border-b last:border-0"
                      >

                        <td className="px-3 py-3 font-mono text-xs">
                          {row.sourceRow}
                        </td>


                        <td className="px-3 py-3">

                          <p className="font-medium">
                            {row.data.product_name ||
                              "—"}
                          </p>


                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.data.category ||
                              "Uncategorized"}
                          </p>

                        </td>


                        <td className="px-3 py-3">
                          {row.data.variant_name ||
                            "Standard"}
                        </td>


                        <td className="px-3 py-3 font-mono text-xs">
                          {row.data.sku ||
                            "—"}
                        </td>


                        <td className="px-3 py-3 font-mono text-xs">
                          {row.data.barcode ||
                            "—"}
                        </td>


                        <td className="px-3 py-3">
                          {row.data.price}
                        </td>


                        <td className="px-3 py-3">
                          {row.data.stock ??
                            0}
                        </td>


                        <td className="px-3 py-3 capitalize">
                          {row.data.status ??
                            "active"}
                        </td>


                        <td className="max-w-[280px] px-3 py-3">

                          {row.errors.length ===
                          0 ? (

                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ready
                            </span>

                          ) : (

                            <ul className="space-y-1 text-xs text-destructive">

                              {row.errors.map(
                                (
                                  message,
                                ) => (
                                  <li
                                    key={
                                      message
                                    }
                                  >
                                    {message}
                                  </li>
                                ),
                              )}

                            </ul>

                          )}

                        </td>

                      </tr>

                    ),
                  )}

                </tbody>

              </table>

            </div>


            {preview.rows.length >
            shownRows.length ? (

              <p className="text-center text-xs text-muted-foreground">
                Showing the first {shownRows.length} rows. The remaining {preview.rows.length - shownRows.length} rows will also be imported.
              </p>

            ) : null}

          </CardContent>

        </Card>

      ) : null}

    </div>
  );
}
