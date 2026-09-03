"use client";

import * as React from "react";

import type {
  ReceiptSettingsForm,
} from "@/lib/domain/receipt-settings";

type ReceiptSettingsPreviewProps = {
  settings:
    ReceiptSettingsForm;

  businessName:
    string;

  currencyCode:
    string;
};

function money(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-LK",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    },
  ).format(value);
}

export function ReceiptSettingsPreview({
  settings,
  businessName,
  currencyCode,
}: ReceiptSettingsPreviewProps) {
  const displayName =
    settings.displayName
      .trim() ||
    businessName;

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              margin: 0;
            }

            html,
            body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }

            body * {
              visibility: hidden !important;
            }

            #nova-settings-test-receipt,
            #nova-settings-test-receipt * {
              visibility: visible !important;
            }

            #nova-settings-test-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;

              width: ${settings.paperWidth} !important;
              max-width: ${settings.paperWidth} !important;

              margin: 0 !important;
              padding: 3mm !important;

              border: 0 !important;
              border-radius: 0 !important;
              box-shadow: none !important;

              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>

      <article
        id="nova-settings-test-receipt"
        style={{
          width:
            settings.paperWidth,
        }}
        className="mx-auto bg-white p-[3mm] font-mono text-[11px] leading-[1.35] text-black shadow-xl"
      >
        {/* HEADER */}

        <header className="text-center">
          <h1 className="text-[16px] font-black uppercase leading-tight">
            {displayName}
          </h1>

          {settings.addressLine1 && (
            <p className="mt-1">
              {
                settings.addressLine1
              }
            </p>
          )}

          {settings.addressLine2 && (
            <p>
              {
                settings.addressLine2
              }
            </p>
          )}

          {settings.phone && (
            <p>
              Tel:{" "}
              {
                settings.phone
              }
            </p>
          )}

          {settings.email && (
            <p>
              {
                settings.email
              }
            </p>
          )}

          {settings.taxRegistrationNumber && (
            <p>
              Tax No:{" "}
              {
                settings.taxRegistrationNumber
              }
            </p>
          )}
        </header>

        <Divider />

        {/* META */}

        <ReceiptPair
          label="Receipt"
          value="RCT-TEST"
        />

        <ReceiptPair
          label="Date"
          value="30/08/2026 12:30"
        />

        {settings.showCashier && (
          <ReceiptPair
            label="Cashier"
            value="Cashier 01"
          />
        )}

        {settings.showCustomer && (
          <>
            <Divider />

            <ReceiptPair
              label="Customer"
              value="Walk-in Customer"
            />
          </>
        )}

        <Divider />

        {/* ITEMS */}

        <section className="space-y-3">
          <PreviewItem
            name="Baby cream"
            sku="TEST-001"
            quantity={2}
            price={1500}
            total={3000}
            currencyCode={
              currencyCode
            }
            showSku={
              settings.showSku
            }
          />

          <PreviewItem
            name="Shampoo"
            sku="TEST-002"
            quantity={1}
            price={850}
            total={850}
            currencyCode={
              currencyCode
            }
            showSku={
              settings.showSku
            }
          />
        </section>

        <Divider />

        {/* TOTAL */}

        <MoneyRow
          label="SUBTOTAL"
          value={3850}
        />

        <div className="my-1 border-t border-black" />

        <div className="flex items-end justify-between gap-2 text-[15px] font-black">
          <span>
            TOTAL
          </span>

          <span className="text-right tabular-nums">
            {currencyCode}{" "}
            {money(
              3850,
            )}
          </span>
        </div>

        <Divider />

        {/* PAYMENT */}

        <ReceiptPair
          label="Payment"
          value="Cash"
        />

        <MoneyRow
          label="CASH"
          value={5000}
        />

        <MoneyRow
          label="CHANGE"
          value={1150}
          bold
        />

        <Divider />

        {/* FOOTER */}

        <footer className="text-center">
          <p className="font-bold">
            {
              settings.footerMessage
            }
          </p>

          <p className="mt-2 text-[8px]">
            RCT-TEST
          </p>

          <p className="mt-2 text-[8px]">
            Powered by NOVA POS
          </p>
        </footer>
      </article>
    </>
  );
}

function PreviewItem({
  name,
  sku,
  quantity,
  price,
  total,
  currencyCode,
  showSku,
}: {
  name: string;

  sku: string;

  quantity: number;

  price: number;

  total: number;

  currencyCode: string;

  showSku: boolean;
}) {
  return (
    <div>
      <div className="font-bold">
        {name}
      </div>

      {showSku && (
        <div className="text-[9px]">
          SKU: {sku}
        </div>
      )}

      <div className="mt-[2px] flex items-start justify-between gap-2">
        <span>
          {quantity}
          {" × "}
          {currencyCode}{" "}
          {money(
            price,
          )}
        </span>

        <span className="shrink-0 text-right font-bold tabular-nums">
          {money(
            total,
          )}
        </span>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-2 border-t border-dashed border-black" />
  );
}

function ReceiptPair({
  label,
  value,
}: {
  label: string;

  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span>
        {label}
      </span>

      <span className="min-w-0 text-right">
        {value}
      </span>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  bold = false,
}: {
  label: string;

  value: number;

  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        bold
          ? "font-bold"
          : ""
      }`}
    >
      <span>
        {label}
      </span>

      <span className="tabular-nums">
        {money(
          value,
        )}
      </span>
    </div>
  );
}