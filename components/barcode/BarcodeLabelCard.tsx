"use client";

import * as React from "react";

import {
  Check,
  Copy,
  Download,
  Printer,
} from "lucide-react";

import {
  Code128Barcode,
} from "@/components/barcode/Code128Barcode";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  printHtmlDocument,
} from "@/lib/print/print-html-document";

function safeDomId(
  value: string,
) {
  return value.replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
}

export function barcodeSvgElementId(
  labelKey: string,
) {
  return `arc-barcode-svg-${safeDomId(
    labelKey,
  )}`;
}

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

type BarcodeLabelCardProps = {
  labelKey: string;
  payload: string;
  productName: string;
  variantName: string;
  sku: string;
  detail?: string;
  badge?: string;
  fileName: string;
  selected: boolean;
  onSelectedChange: (
    selected: boolean,
  ) => void;
};

export function BarcodeLabelCard({
  labelKey,
  payload,
  productName,
  variantName,
  sku,
  detail,
  badge,
  fileName,
  selected,
  onSelectedChange,
}: BarcodeLabelCardProps) {
  const [
    copied,
    setCopied,
  ] =
    React.useState(
      false,
    );

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(
        payload,
      );

      setCopied(
        true,
      );

      window.setTimeout(
        () =>
          setCopied(
            false,
          ),
        1200,
      );
    } catch {
      console.error(
        "Unable to copy barcode value.",
      );
    }
  }

  async function downloadPng() {
    const svg =
      document.getElementById(
        barcodeSvgElementId(
          labelKey,
        ),
      ) as SVGSVGElement | null;

    if (!svg) {
      return;
    }

    const clone =
      svg.cloneNode(
        true,
      ) as SVGSVGElement;

    clone.setAttribute(
      "width",
      "1600",
    );

    clone.setAttribute(
      "height",
      "420",
    );

    const xml =
      new XMLSerializer()
        .serializeToString(
          clone,
        );

    const blob =
      new Blob(
        [
          xml,
        ],
        {
          type:
            "image/svg+xml;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    try {
      const image =
        new Image();

      await new Promise<void>(
        (
          resolve,
          reject,
        ) => {
          image.onload =
            () =>
              resolve();

          image.onerror =
            () =>
              reject(
                new Error(
                  "Unable to render barcode.",
                ),
              );

          image.src =
            url;
        },
      );

      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width =
        1600;

      canvas.height =
        420;

      const context =
        canvas.getContext(
          "2d",
        );

      if (!context) {
        return;
      }

      context.fillStyle =
        "#ffffff";

      context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      const link =
        document.createElement(
          "a",
        );

      link.href =
        canvas.toDataURL(
          "image/png",
        );

      link.download =
        `${fileName}-barcode.png`;

      document.body.appendChild(
        link,
      );

      link.click();

      document.body.removeChild(
        link,
      );
    } finally {
      URL.revokeObjectURL(
        url,
      );
    }
  }

  function printLabel() {
    const svg =
      document.getElementById(
        barcodeSvgElementId(
          labelKey,
        ),
      ) as SVGSVGElement | null;

    if (!svg) {
      return;
    }

    const safeName =
      escapeHtml(
        productName,
      );

    const safeVariant =
      escapeHtml(
        variantName,
      );

    const safeSku =
      escapeHtml(
        sku,
      );

    const safeDetail =
      detail
        ? escapeHtml(
            detail,
          )
        : "";

    const safeBadge =
      badge
        ? escapeHtml(
            badge,
          )
        : "";

    printHtmlDocument(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safeSku} · ARC Barcode</title>
          <style>
            @page {
              size: 70mm 34mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            html,
            body {
              width: 70mm;
              min-height: 34mm;
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: Arial, Helvetica, sans-serif;
            }
            body {
              padding: 3mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label {
              width: 100%;
              text-align: center;
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
          <div class="label">
            <div class="barcode">
              ${svg.outerHTML}
            </div>
            <div class="name">${safeName}</div>
            <div class="meta">${safeVariant} · ${safeSku}</div>
            ${safeDetail ? `<div class="detail">${safeDetail}</div>` : ""}
            ${safeBadge ? `<div class="badge">${safeBadge}</div>` : ""}
          </div>
        </body>
      </html>
    `);
  }

  return (
    <Card className="overflow-hidden rounded-[24px]">
      <CardContent className="p-2">
        <div className="rounded-[16px] bg-white p-5 text-center text-black">

          <div className="mb-3 flex items-center justify-between gap-3">

            <div className="min-w-0 text-left">
              {badge && (
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  {badge}
                </p>
              )}
            </div>

            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={
                  selected
                }
                onChange={
                  (
                    event,
                  ) =>
                    onSelectedChange(
                      event.target.checked,
                    )
                }
                className="h-4 w-4"
              />
              Select
            </label>

          </div>

          <div className="rounded-[12px] border border-slate-200 bg-white p-3">
            <Code128Barcode
              id={
                barcodeSvgElementId(
                  labelKey,
                )
              }
              value={
                payload
              }
              className="h-[92px] w-full"
              title={
                `${productName} ${variantName}`
              }
            />
          </div>

          <p className="mt-4 line-clamp-1 text-sm font-bold">
            {productName}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {variantName}
          </p>

          <p className="mt-2 font-mono text-xs font-semibold">
            {sku}
          </p>

          {detail && (
            <p className="mt-2 text-xs font-bold">
              {detail}
            </p>
          )}

        </div>

        <div className="space-y-2 p-2 pt-3">

          <div className="flex items-center gap-2 rounded-[16px] border bg-muted/20 p-2">

            <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
              {payload}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-[10px]"
              onClick={
                () =>
                  void copyPayload()
              }
            >
              {copied
                ? (
                  <Check className="h-3.5 w-3.5" />
                )
                : (
                  <Copy className="h-3.5 w-3.5" />
                )}
            </Button>

          </div>

          <div className="grid grid-cols-2 gap-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={
                () =>
                  void downloadPng()
              }
            >
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>

            <Button
              type="button"
              className="rounded-[14px]"
              onClick={
                printLabel
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>

          </div>

        </div>
      </CardContent>
    </Card>
  );
}
