"use client";

import * as React from "react";

import {
  Download,
  Printer,
} from "lucide-react";

import {
  QRCodeCanvas,
  QRCodeSVG,
} from "qrcode.react";

import {
  createNovaQrValue,
} from "@/lib/qr/qr-value";

type ProductQrCodeProps = {
  qrToken: string;

  sku: string;

  productName: string;

  variantName?: string;
};

export function ProductQrCode({
  qrToken,
  sku,
  productName,
  variantName,
}: ProductQrCodeProps) {
  const canvasRef =
    React.useRef<HTMLDivElement>(
      null,
    );

  const qrValue =
    createNovaQrValue(qrToken);

  function downloadQr() {
    const canvas =
      canvasRef.current?.querySelector(
        "canvas",
      );

    if (!canvas) return;

    const image =
      canvas.toDataURL(
        "image/png",
      );

    const link =
      document.createElement("a");

    link.href = image;

    link.download = `${sku}-qr.png`;

    link.click();
  }

  function printQr() {
    const printWindow =
      window.open(
        "",
        "_blank",
        "width=500,height=700",
      );

    if (!printWindow) {
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>

      <html>
        <head>
          <title>${sku}</title>

          <style>
            @page {
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 16px;

              font-family:
                Arial,
                Helvetica,
                sans-serif;

              display: flex;

              justify-content: center;
              align-items: flex-start;
            }

            .label {
              width: 50mm;

              padding: 4mm;

              text-align: center;
            }

            .product {
              margin-top: 3mm;

              font-size: 11px;

              font-weight: 700;
            }

            .variant {
              margin-top: 1mm;

              font-size: 9px;

              color: #444;
            }

            .sku {
              margin-top: 2mm;

              font-size: 10px;

              font-family: monospace;

              font-weight: 700;

              letter-spacing: 0.04em;
            }

            svg {
              width: 32mm;
              height: 32mm;
            }
          </style>
        </head>

        <body>
          <div class="label">

            <div id="qr"></div>

            <div class="product">
              ${escapeHtml(
                productName,
              )}
            </div>

            ${
              variantName
                ? `
                    <div class="variant">
                      ${escapeHtml(
                        variantName,
                      )}
                    </div>
                  `
                : ""
            }

            <div class="sku">
              ${escapeHtml(sku)}
            </div>

          </div>
        </body>
      </html>
    `);

    const svg =
      document.getElementById(
        `qr-svg-${qrToken}`,
      );

    const target =
      printWindow.document.getElementById(
        "qr",
      );

    if (svg && target) {
      target.innerHTML =
        svg.outerHTML;
    }

    printWindow.document.close();

    printWindow.focus();

    setTimeout(() => {
      printWindow.print();

      printWindow.close();
    }, 250);
  }

  return (
    <div
      className="
        rounded-[24px]
        border
        bg-background
        p-2
      "
    >
      <div
        className="
          rounded-[16px]
          bg-white
          p-5
        "
      >
        <div
          ref={canvasRef}
          className="
            flex
            justify-center
          "
        >
          <QRCodeCanvas
            value={qrValue}
            size={220}
            level="H"
            marginSize={1}
          />
        </div>

        {/*
          Hidden SVG is used for
          high-quality printing.
        */}

        <div className="hidden">
          <QRCodeSVG
            id={`qr-svg-${qrToken}`}
            value={qrValue}
            size={300}
            level="H"
            marginSize={1}
          />
        </div>

        <div className="mt-5 text-center">
          <p className="font-semibold">
            {productName}
          </p>

          {variantName && (
            <p className="mt-1 text-sm text-muted-foreground">
              {variantName}
            </p>
          )}

          <p
            className="
              mt-2
              font-mono
              text-xs
              font-semibold
              tracking-wider
            "
          >
            {sku}
          </p>
        </div>
      </div>

      <div
        className="
          grid
          grid-cols-2
          gap-2
          pt-2
        "
      >
        <button
          type="button"
          onClick={downloadQr}
          className="
            flex
            items-center
            justify-center
            gap-2

            rounded-[16px]

            border

            px-4
            py-3

            text-sm
            font-semibold

            transition

            hover:bg-muted
          "
        >
          <Download className="h-4 w-4" />

          Download
        </button>

        <button
          type="button"
          onClick={printQr}
          className="
            flex
            items-center
            justify-center
            gap-2

            rounded-[16px]

            bg-primary

            px-4
            py-3

            text-sm
            font-semibold

            text-primary-foreground

            transition

            hover:opacity-90
          "
        >
          <Printer className="h-4 w-4" />

          Print
        </button>
      </div>
    </div>
  );
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