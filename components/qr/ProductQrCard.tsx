"use client";

import * as React from "react";

import {
  Check,
  Copy,
  Download,
  Printer,
} from "lucide-react";

import {
  QRCodeCanvas,
  QRCodeSVG,
} from "qrcode.react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  buildVariantQrPayload,
} from "@/lib/domain/catalog";

export function qrSvgElementId(
  variantId: string,
) {
  return `nova-qr-svg-${variantId}`;
}

function qrCanvasElementId(
  variantId: string,
) {
  return `nova-qr-canvas-${variantId}`;
}

function escapeHtml(
  value: string,
) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type ProductQrCardProps = {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  qrToken: string;
  selected: boolean;
  onSelectedChange: (
    selected: boolean,
  ) => void;
};

export function ProductQrCard({
  variantId,
  productName,
  variantName,
  sku,
  qrToken,
  selected,
  onSelectedChange,
}: ProductQrCardProps) {
  const [copied, setCopied] =
    React.useState(false);

  const payload =
    buildVariantQrPayload(
      qrToken,
    );

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(
        payload,
      );

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1200);
    } catch {
      console.error(
        "Unable to copy QR payload.",
      );
    }
  }

  function downloadPng() {
    const canvas =
      document.querySelector<HTMLCanvasElement>(
        `#${qrCanvasElementId(
          variantId,
        )}`,
      );

    if (!canvas) {
      console.error(
        "QR canvas could not be found.",
      );

      return;
    }

    const imageData =
      canvas.toDataURL(
        "image/png",
      );

    const link =
      document.createElement("a");

    link.href = imageData;

    link.download = `${
      sku || "nova-product"
    }-qr.png`;

    document.body.appendChild(
      link,
    );

    link.click();

    document.body.removeChild(
      link,
    );
  }

  function printLabel() {
    const svg =
      document.querySelector<SVGSVGElement>(
        `#${qrSvgElementId(
          variantId,
        )}`,
      );

    if (!svg) {
      console.error(
        "QR SVG could not be found.",
      );

      return;
    }

    const printWindow =
      window.open(
        "",
        "_blank",
        "width=520,height=680",
      );

    if (!printWindow) {
      console.error(
        "Print window could not be opened.",
      );

      return;
    }

    const safeProductName =
      escapeHtml(
        productName,
      );

    const safeVariantName =
      escapeHtml(
        variantName,
      );

    const safeSku =
      escapeHtml(
        sku,
      );

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />

          <title>
            ${safeSku} · NOVA QR
          </title>

          <style>
            @page {
              size: 50mm 40mm;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              width: 50mm;
              min-height: 40mm;
              background: #ffffff;
              color: #000000;
              font-family:
                Arial,
                Helvetica,
                sans-serif;
            }

            body {
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 3mm;
            }

            .label {
              width: 100%;
              text-align: center;
            }

            .qr {
              display: flex;
              justify-content: center;
              align-items: center;
            }

            .qr svg {
              width: 25mm;
              height: 25mm;
              display: block;
            }

            .name {
              margin-top: 1.5mm;
              font-size: 9pt;
              font-weight: 700;
              line-height: 1.1;
            }

            .variant {
              margin-top: 0.6mm;
              font-size: 7pt;
              color: #444444;
            }

            .sku {
              margin-top: 1mm;
              font-family:
                monospace;
              font-size: 7pt;
              font-weight: 700;
              letter-spacing: 0.03em;
            }
          </style>
        </head>

        <body>
          <div class="label">
            <div class="qr">
              ${svg.outerHTML}
            </div>

            <div class="name">
              ${safeProductName}
            </div>

            <div class="variant">
              ${safeVariantName}
            </div>

            <div class="sku">
              ${safeSku}
            </div>
          </div>

          <script>
            window.addEventListener(
              "load",
              function () {
                window.print();

                window.onafterprint =
                  function () {
                    window.close();
                  };
              }
            );
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }

  return (
    <Card className="overflow-hidden rounded-[24px]">
      <CardContent className="p-2">
        <div className="rounded-[16px] bg-white p-5 text-center text-black">
          <div className="mb-3 flex justify-end">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
              <input
                type="checkbox"
                checked={selected}
                onChange={(
                  event,
                ) =>
                  onSelectedChange(
                    event.target
                      .checked,
                  )
                }
                className="h-4 w-4"
              />

              Select
            </label>
          </div>

          {/* Visible SVG QR */}
          <div className="mx-auto flex w-fit items-center justify-center rounded-[12px] border border-slate-200 bg-white p-2">
            <QRCodeSVG
              id={qrSvgElementId(
                variantId,
              )}
              value={payload}
              size={184}
              level="H"
              marginSize={4}
              bgColor="#ffffff"
              fgColor="#000000"
              title={`${productName} ${variantName}`}
            />
          </div>

          {/* Hidden high-resolution PNG source */}
          <div
            className="hidden"
            aria-hidden="true"
          >
            <QRCodeCanvas
              id={qrCanvasElementId(
                variantId,
              )}
              value={payload}
              size={720}
              level="H"
              marginSize={4}
              bgColor="#ffffff"
              fgColor="#000000"
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
        </div>

        <div className="space-y-2 p-2 pt-3">
          <div className="flex items-center gap-2 rounded-[16px] border bg-muted/20 p-2">
            <p
              className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground"
              title={payload}
            >
              {payload}
            </p>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-[10px]"
              onClick={() =>
                void copyPayload()
              }
              aria-label="Copy QR payload"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-[14px]"
              onClick={
                printLabel
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={
                downloadPng
              }
            >
              <Download className="mr-2 h-4 w-4" />
              PNG
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}