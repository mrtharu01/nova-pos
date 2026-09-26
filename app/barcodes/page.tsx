"use client";

import * as React from "react";

import {
  Barcode,
  Layers3,
  Package,
  Printer,
  Search,
  SquareCheckBig,
} from "lucide-react";

import {
  BarcodeLabelCard,
  barcodeSvgElementId,
} from "@/components/barcode/BarcodeLabelCard";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  useCatalog,
} from "@/hooks/use-catalog";

import {
  buildArcBatchBarcodePayload,
  buildArcVariantBarcodePayload,
} from "@/lib/barcode/code128";

import {
  formatMoney,
} from "@/lib/domain/catalog";

import {
  printHtmlDocument,
} from "@/lib/print/print-html-document";

type BarcodeMode =
  | "product"
  | "batch";

type BarcodeItem = {
  key: string;
  payload: string;
  productName: string;
  variantName: string;
  sku: string;
  detail?: string;
  badge: string;
  fileName: string;
};

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}

export default function BarcodesPage() {
  const {
    products,
    loading,
    error,
  } =
    useCatalog();

  const [
    mode,
    setMode,
  ] =
    React.useState<BarcodeMode>(
      "product",
    );

  const [
    search,
    setSearch,
  ] =
    React.useState(
      "",
    );

  const [
    selected,
    setSelected,
  ] =
    React.useState<Set<string>>(
      new Set(),
    );

  const productItems =
    React.useMemo<BarcodeItem[]>(
      () =>
        products.flatMap(
          (
            product,
          ) =>
            product.variants
              .filter(
                (
                  variant,
                ) =>
                  Boolean(
                    variant.qrToken,
                  ),
              )
              .map(
                (
                  variant,
                ) => ({
                  key:
                    `product:${variant.id}`,
                  payload:
                    buildArcVariantBarcodePayload(
                      variant.qrToken!,
                    ),
                  productName:
                    product.name,
                  variantName:
                    variant.name,
                  sku:
                    variant.sku,
                  detail:
                    variant.barcode
                      ? `Manufacturer: ${variant.barcode}`
                      : undefined,
                  badge:
                    "ARC product barcode",
                  fileName:
                    `${variant.sku}-arc-product`,
                }),
              ),
        ),
      [
        products,
      ],
    );

  const batchItems =
    React.useMemo<BarcodeItem[]>(
      () =>
        products.flatMap(
          (
            product,
          ) =>
            product.variants.flatMap(
              (
                variant,
              ) =>
                (
                  variant.priceBatches ??
                  []
                ).map(
                  (
                    batch,
                    index,
                  ) => ({
                    key:
                      `batch:${batch.id}`,
                    payload:
                      buildArcBatchBarcodePayload(
                        batch.id,
                      ),
                    productName:
                      product.name,
                    variantName:
                      variant.name,
                    sku:
                      variant.sku,
                    detail:
                      `${batch.quantity} left · ${formatMoney(
                        batch.price,
                      )}`,
                    badge:
                      index ===
                      0
                        ? "Selling now"
                        : `Price batch #${index + 1}`,
                    fileName:
                      `${variant.sku}-batch-${index + 1}`,
                  }),
                ),
            ),
        ),
      [
        products,
      ],
    );

  const activeItems =
    mode ===
      "product"
      ? productItems
      : batchItems;

  const visibleItems =
    React.useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();

        if (!term) {
          return activeItems;
        }

        return activeItems.filter(
          (
            item,
          ) =>
            item.productName
              .toLowerCase()
              .includes(
                term,
              )
            ||
            item.variantName
              .toLowerCase()
              .includes(
                term,
              )
            ||
            item.sku
              .toLowerCase()
              .includes(
                term,
              )
            ||
            item.payload
              .toLowerCase()
              .includes(
                term,
              )
            ||
            item.detail
              ?.toLowerCase()
              .includes(
                term,
              ),
        );
      },
      [
        activeItems,
        search,
      ],
    );

  React.useEffect(
    () => {
      setSelected(
        new Set(),
      );
    },
    [
      mode,
    ],
  );

  const visibleKeys =
    visibleItems.map(
      (
        item,
      ) =>
        item.key,
    );

  const allVisibleSelected =
    visibleKeys.length >
      0
    &&
    visibleKeys.every(
      (
        key,
      ) =>
        selected.has(
          key,
        ),
    );

  function toggleSelected(
    key: string,
    checked: boolean,
  ) {
    setSelected(
      (
        current,
      ) => {
        const next =
          new Set(
            current,
          );

        if (checked) {
          next.add(
            key,
          );
        } else {
          next.delete(
            key,
          );
        }

        return next;
      },
    );
  }

  function toggleAllVisible() {
    setSelected(
      (
        current,
      ) => {
        const next =
          new Set(
            current,
          );

        visibleKeys.forEach(
          (
            key,
          ) => {
            if (
              allVisibleSelected
            ) {
              next.delete(
                key,
              );
            } else {
              next.add(
                key,
              );
            }
          },
        );

        return next;
      },
    );
  }

  function bulkPrint() {
    const items =
      visibleItems.filter(
        (
          item,
        ) =>
          selected.has(
            item.key,
          ),
      );

    if (
      items.length ===
      0
    ) {
      return;
    }

    const labels =
      items.map(
        (
          item,
        ) => {
          const svg =
            document.getElementById(
              barcodeSvgElementId(
                item.key,
              ),
            ) as SVGSVGElement | null;

          if (!svg) {
            return "";
          }

          return `
            <div class="label">
              <div class="barcode">${svg.outerHTML}</div>
              <div class="name">${escapeHtml(item.productName)}</div>
              <div class="meta">${escapeHtml(item.variantName)} · ${escapeHtml(item.sku)}</div>
              ${item.detail ? `<div class="detail">${escapeHtml(item.detail)}</div>` : ""}
              <div class="badge">${escapeHtml(item.badge)}</div>
            </div>
          `;
        },
      )
      .filter(
        Boolean,
      )
      .join(
        "",
      );

    if (!labels) {
      return;
    }

    printHtmlDocument(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>ARC Barcode Labels</title>
          <style>
            @page {
              margin: 6mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              margin: 0;
              color: #000;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              display: grid;
              grid-template-columns: repeat(auto-fill, 70mm);
              gap: 4mm;
              align-items: start;
            }
            .label {
              width: 70mm;
              min-height: 34mm;
              padding: 3mm;
              border: 1px dashed #bbb;
              text-align: center;
              break-inside: avoid;
            }
            .barcode svg {
              display: block;
              width: 64mm;
              height: 14mm;
              margin: 0 auto;
            }
            .name {
              margin-top: 1.3mm;
              font-size: 9pt;
              font-weight: 700;
              line-height: 1.05;
            }
            .meta {
              margin-top: .6mm;
              font-size: 6.5pt;
              color: #333;
            }
            .detail {
              margin-top: .6mm;
              font-size: 7pt;
              font-weight: 700;
            }
            .badge {
              margin-top: .6mm;
              font-size: 6pt;
              text-transform: uppercase;
              letter-spacing: .08em;
            }
          </style>
        </head>
        <body>
          ${labels}
        </body>
      </html>
    `);
  }

  return (
    <AppLayout title="Barcodes">

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

        <div>
          <h2 className="text-lg font-semibold">
            Optional ARC barcode labels
          </h2>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Keep manufacturer barcodes when products already have them. ARC product labels are optional, while price-batch labels can identify the exact old or new stock price automatically at checkout.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <Button
            type="button"
            variant="outline"
            className="rounded-[14px]"
            onClick={
              toggleAllVisible
            }
            disabled={
              visibleKeys.length ===
              0
            }
          >
            <SquareCheckBig className="mr-2 h-4 w-4" />
            {allVisibleSelected
              ? "Clear visible"
              : "Select visible"}
          </Button>

          <Button
            type="button"
            className="rounded-[14px]"
            onClick={
              bulkPrint
            }
            disabled={
              selected.size ===
              0
            }
          >
            <Printer className="mr-2 h-4 w-4" />
            Print selected ({selected.size})
          </Button>

        </div>

      </div>

      <div className="mb-5 flex w-fit rounded-[16px] border bg-muted/30 p-1">

        <button
          type="button"
          onClick={() =>
            setMode(
              "product",
            )
          }
          className={
            `flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold transition-colors ${
              mode ===
              "product"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <Package className="h-4 w-4" />
          Product labels
        </button>

        <button
          type="button"
          onClick={() =>
            setMode(
              "batch",
            )
          }
          className={
            `flex items-center gap-2 rounded-[12px] px-4 py-2 text-sm font-semibold transition-colors ${
              mode ===
              "batch"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`
          }
        >
          <Layers3 className="h-4 w-4" />
          Price batches
        </button>

      </div>

      <div className="relative mb-5 max-w-xl">

        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />

        <Input
          value={
            search
          }
          onChange={
            (
              event,
            ) =>
              setSearch(
                event.target.value,
              )
          }
          placeholder="Search product, SKU, price, or barcode…"
          className="h-11 bg-card pl-9"
        />

      </div>

      {error && (
        <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Barcode catalog could not be loaded: {error}
        </div>
      )}

      {loading
        ? (
          <div className="py-20 text-center text-muted-foreground">
            Loading barcode labels…
          </div>
        )
        : visibleItems.length >
          0
          ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">

              {visibleItems.map(
                (
                  item,
                ) => (
                  <BarcodeLabelCard
                    key={
                      item.key
                    }
                    labelKey={
                      item.key
                    }
                    payload={
                      item.payload
                    }
                    productName={
                      item.productName
                    }
                    variantName={
                      item.variantName
                    }
                    sku={
                      item.sku
                    }
                    detail={
                      item.detail
                    }
                    badge={
                      item.badge
                    }
                    fileName={
                      item.fileName
                    }
                    selected={
                      selected.has(
                        item.key,
                      )
                    }
                    onSelectedChange={
                      (
                        checked,
                      ) =>
                        toggleSelected(
                          item.key,
                          checked,
                        )
                    }
                  />
                ),
              )}

            </div>
          )
          : (
            <div className="rounded-[24px] border bg-card px-6 py-16 text-center">

              <Barcode className="mx-auto h-8 w-8 text-muted-foreground" />

              <p className="mt-4 font-semibold">
                {mode ===
                "batch"
                  ? "No live price batches found"
                  : "No barcode labels found"}
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                {mode ===
                "batch"
                  ? "Stock In a priced delivery to create a batch label."
                  : "Saved product variants automatically have a stable ARC barcode identity available here."}
              </p>

            </div>
          )}

    </AppLayout>
  );
}
