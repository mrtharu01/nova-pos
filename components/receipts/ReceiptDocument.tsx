"use client";

import * as React from "react";

import type {
  ReceiptPaperWidth,
  SaleReceipt,
} from "@/lib/domain/receipts";

import type {
  RefundAwareSaleReceipt,
} from "@/lib/data/receipts";

import {
  paymentMethodLabel,
} from "@/lib/domain/sales";


type ReceiptDocumentProps = {
  receipt:
    SaleReceipt;

  businessName:
    string;

  paperWidth:
    ReceiptPaperWidth;

  isReprint?:
    boolean;
};


/* ============================================================
   MONEY
============================================================ */

function amount(
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
  ).format(
    value,
  );
}


/* ============================================================
   DATE
============================================================ */

function receiptDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "en-LK",
    {
      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


/* ============================================================
   STATUS
============================================================ */

function statusBanner(
  status:
    SaleReceipt["status"],
) {
  switch (
    status
  ) {
    case "partially_refunded":
      return "*** PARTIALLY REFUNDED ***";

    case "refunded":
      return "*** FULLY REFUNDED ***";

    case "voided":
      return "*** VOIDED ***";

    default:
      return null;
  }
}


function statusText(
  value: string,
) {
  return value
    .replace(
      /_/g,
      " ",
    )
    .toUpperCase();
}


/* ============================================================
   RECEIPT
============================================================ */

export function ReceiptDocument({
  receipt,
  businessName,
  paperWidth,
  isReprint = false,
}: ReceiptDocumentProps) {
  const adjustedReceipt =
    receipt as
      RefundAwareSaleReceipt;


  const settings =
    receipt.settings;


  const displayName =
    settings.displayName ??
    businessName;


  const payment =
    receipt.payments[0];


  const specialStatus =
    statusBanner(
      receipt.status,
    );


  /* ==========================================================
     REFUNDED QUANTITY PER ORIGINAL SALE ITEM
  ========================================================== */

  const refundedQuantityByItem =
    React.useMemo(
      () => {
        const map =
          new Map<
            string,
            number
          >();


        adjustedReceipt.refunds
          ?.forEach(
            (refund) => {
              refund.items.forEach(
                (item) => {
                  map.set(
                    item.saleItemId,
                    (
                      map.get(
                        item.saleItemId,
                      ) ??
                      0
                    ) +
                      item.quantity,
                  );
                },
              );
            },
          );


        return map;
      },
      [
        adjustedReceipt.refunds,
      ],
    );


  return (
    <>

      {/* ======================================================
          PRINT CSS
      ======================================================= */}

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

            #nova-print-receipt,
            #nova-print-receipt * {
              visibility: visible !important;
            }

            #nova-print-receipt {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;

              width: ${paperWidth} !important;
              max-width: ${paperWidth} !important;

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
        id="nova-print-receipt"
        style={{
          width:
            paperWidth,
        }}
        className="mx-auto bg-white p-[3mm] font-mono text-[11px] leading-[1.35] text-black"
      >

        {/* ====================================================
            HEADER
        ===================================================== */}

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


          {isReprint && (

            <p className="mt-2 font-black">
              *** REPRINT ***
            </p>

          )}


          {specialStatus && (

            <p className="mt-1 font-black">
              {specialStatus}
            </p>

          )}

        </header>


        <Divider />


        {/* ====================================================
            SALE META
        ===================================================== */}

        <div className="space-y-[2px]">

          <ReceiptPair
            label="Receipt"
            value={
              receipt.receiptNumber
            }
          />


          <ReceiptPair
            label="Date"
            value={
              receiptDate(
                receipt.createdAt,
              )
            }
          />


          <ReceiptPair
            label="Status"
            value={
              statusText(
                receipt.status,
              )
            }
          />


          {settings.showCashier &&
            receipt.cashierLabel && (

              <ReceiptPair
                label="Cashier"
                value={
                  receipt.cashierLabel
                }
              />

            )}

        </div>


        {/* ====================================================
            CUSTOMER
        ===================================================== */}

        {settings.showCustomer &&
          (
            receipt.customerName ||
            receipt.customerPhone ||
            receipt.customerEmail
          ) && (

            <>

              <Divider />


              <div className="space-y-[2px]">

                {receipt.customerName && (

                  <ReceiptPair
                    label="Customer"
                    value={
                      receipt.customerName
                    }
                  />

                )}


                {receipt.customerPhone && (

                  <ReceiptPair
                    label="Phone"
                    value={
                      receipt.customerPhone
                    }
                  />

                )}


                {receipt.customerEmail && (

                  <div className="break-all">
                    {
                      receipt.customerEmail
                    }
                  </div>

                )}

              </div>

            </>

          )}


        <Divider />


        {/* ====================================================
            ORIGINAL SALE ITEMS
        ===================================================== */}

        <section className="space-y-3">

          {receipt.items.map(
            (item) => {
              const refunded =
                refundedQuantityByItem.get(
                  item.id,
                ) ??
                0;


              const remaining =
                Math.max(
                  0,
                  item.quantity -
                    refunded,
                );


              return (
                <div
                  key={
                    item.id
                  }
                >

                  <div className="font-bold">

                    {
                      item.productName
                    }


                    {item.variantName &&
                      item.variantName !==
                        "Standard" && (

                        <>

                          {" "}
                          —{" "}
                          {
                            item.variantName
                          }

                        </>

                      )}

                  </div>


                  {settings.showSku && (

                    <div className="text-[9px]">

                      SKU:{" "}
                      {
                        item.sku
                      }

                    </div>

                  )}


                  <div className="mt-[2px] flex items-start justify-between gap-2">

                    <span>

                      {
                        item.quantity
                      }

                      {" × "}

                      {
                        receipt.currencyCode
                      }

                      {" "}

                      {
                        amount(
                          item.unitPrice,
                        )
                      }

                    </span>


                    <span className="shrink-0 text-right font-bold tabular-nums">

                      {
                        amount(
                          item.lineTotal,
                        )
                      }

                    </span>

                  </div>


                  {item.discountTotal >
                    0 && (

                    <div className="flex justify-between text-[9px]">

                      <span>
                        Item discount
                      </span>


                      <span>
                        -
                        {
                          amount(
                            item.discountTotal,
                          )
                        }
                      </span>

                    </div>

                  )}


                  {refunded >
                    0 && (

                    <div className="mt-[2px] flex justify-between font-bold text-[9px]">

                      <span>
                        Refunded:{" "}
                        {
                          refunded
                        }
                      </span>


                      <span>
                        Remaining:{" "}
                        {
                          remaining
                        }
                      </span>

                    </div>

                  )}

                </div>
              );
            },
          )}

        </section>


        <Divider />


        {/* ====================================================
            TOTALS
        ===================================================== */}

        <section className="space-y-[3px]">

          <MoneyRow
            label="SUBTOTAL"
            value={
              receipt.subtotal
            }
          />


          {receipt.discountTotal >
            0 && (

            <MoneyRow
              label="DISCOUNT"
              value={
                -receipt.discountTotal
              }
            />

          )}


          {receipt.taxTotal >
            0 && (

            <MoneyRow
              label="TAX"
              value={
                receipt.taxTotal
              }
            />

          )}


          <div className="my-1 border-t border-black" />


          <div className="flex items-end justify-between gap-3 text-[15px] font-black">

            <span>
              ORIGINAL TOTAL
            </span>


            <span className="text-right tabular-nums">

              {
                receipt.currencyCode
              }

              {" "}

              {
                amount(
                  receipt.total,
                )
              }

            </span>

          </div>


          {/* ================================================
              REFUNDED TOTAL
          ================================================= */}

          {adjustedReceipt.refundedTotal >
            0 && (

            <MoneyRow
              label="REFUNDED"
              value={
                -adjustedReceipt.refundedTotal
              }
              bold
            />

          )}


          {/* ================================================
              VOIDED TOTAL
          ================================================= */}

          {receipt.status ===
            "voided" && (

            <MoneyRow
              label="VOIDED"
              value={
                -receipt.total
              }
              bold
            />

          )}


          {/* ================================================
              NET TOTAL
          ================================================= */}

          {(receipt.status ===
            "partially_refunded" ||
            receipt.status ===
              "refunded" ||
            receipt.status ===
              "voided") && (

            <>

              <div className="my-1 border-t border-black" />


              <div className="flex items-end justify-between gap-3 text-[15px] font-black">

                <span>
                  NET SALE
                </span>


                <span className="text-right tabular-nums">

                  {
                    receipt.currencyCode
                  }

                  {" "}

                  {
                    amount(
                      adjustedReceipt.netTotal ??
                        0,
                    )
                  }

                </span>

              </div>

            </>

          )}

        </section>


        <Divider />


        {/* ====================================================
            ORIGINAL PAYMENT
        ===================================================== */}

        {payment && (

          <section className="space-y-[3px]">

            <ReceiptPair
              label="Payment"
              value={
                paymentMethodLabel(
                  payment.method,
                )
              }
            />


            <ReceiptPair
              label="Payment Status"
              value={
                statusText(
                  payment.status,
                )
              }
            />


            {payment.referenceNumber && (

              <ReceiptPair
                label="Reference"
                value={
                  payment.referenceNumber
                }
              />

            )}


            {payment.method ===
              "cash" && (

              <>

                <MoneyRow
                  label="CASH"
                  value={
                    payment.cashReceived ??
                    receipt.total
                  }
                />


                <MoneyRow
                  label="CHANGE"
                  value={
                    payment.changeDue ??
                    0
                  }
                  bold
                />

              </>

            )}

          </section>

        )}


        {/* ====================================================
            REFUND HISTORY
        ===================================================== */}

        {adjustedReceipt.refunds.length >
          0 && (

          <>

            <Divider />


            <section>

              <p className="mb-2 text-center font-black">
                REFUND HISTORY
              </p>


              <div className="space-y-3">

                {adjustedReceipt.refunds.map(
                  (refund) => (

                    <div
                      key={
                        refund.id
                      }
                    >

                      <div className="flex justify-between gap-2 font-bold">

                        <span>
                          {
                            refund.refundNumber
                          }
                        </span>


                        <span>
                          -
                          {
                            amount(
                              refund.amount,
                            )
                          }
                        </span>

                      </div>


                      <div className="mt-[2px] text-[9px]">

                        {
                          receiptDate(
                            refund.createdAt,
                          )
                        }

                      </div>


                      <div className="text-[9px]">

                        Refund via{" "}
                        {
                          paymentMethodLabel(
                            refund.method,
                          )
                        }

                      </div>


                      {refund.items.map(
                        (item) => (

                          <div
                            key={
                              item.id
                            }
                            className="mt-[3px] flex justify-between gap-2 text-[9px]"
                          >

                            <span>

                              {
                                item.productName
                              }

                              {" × "}

                              {
                                item.quantity
                              }

                              {" "}

                              {item.restocked
                                ? "(restocked)"
                                : "(not restocked)"}

                            </span>


                            <span className="shrink-0">

                              {
                                amount(
                                  item.lineRefundTotal,
                                )
                              }

                            </span>

                          </div>

                        ),
                      )}


                      {refund.reason && (

                        <div className="mt-[3px] text-[9px]">

                          Reason:{" "}
                          {
                            refund.reason
                          }

                        </div>

                      )}

                    </div>

                  ),
                )}

              </div>

            </section>

          </>

        )}


        {/* ====================================================
            VOID AUDIT
        ===================================================== */}

        {adjustedReceipt.void && (

          <>

            <Divider />


            <section className="text-center">

              <p className="font-black">
                TRANSACTION VOIDED
              </p>


              <p className="mt-1 text-[9px]">

                {
                  receiptDate(
                    adjustedReceipt.void
                      .createdAt,
                  )
                }

              </p>


              {adjustedReceipt.void.reason && (

                <p className="mt-1 text-[9px]">

                  Reason:{" "}
                  {
                    adjustedReceipt.void
                      .reason
                  }

                </p>

              )}


              {adjustedReceipt.void.note && (

                <p className="mt-1 text-[9px]">

                  Note:{" "}
                  {
                    adjustedReceipt.void
                      .note
                  }

                </p>

              )}


              <p className="mt-2 font-black">
                THIS RECEIPT IS VOID
              </p>

            </section>

          </>

        )}


        {/* ====================================================
            SALE NOTE
        ===================================================== */}

        {receipt.note && (

          <>

            <Divider />


            <p>
              Note:{" "}
              {
                receipt.note
              }
            </p>

          </>

        )}


        <Divider />


        {/* ====================================================
            FOOTER
        ===================================================== */}

        <footer className="text-center">

          {receipt.status ===
            "voided" ? (

            <p className="font-black">
              VOID TRANSACTION
            </p>

          ) : receipt.status ===
            "refunded" ? (

            <p className="font-black">
              TRANSACTION FULLY REFUNDED
            </p>

          ) : (

            <p className="font-bold">
              {
                settings.footerMessage
              }
            </p>

          )}


          <p className="mt-2 text-[8px]">
            {
              receipt.receiptNumber
            }
          </p>


          <p className="mt-2 text-[8px]">
            Powered by NOVA POS
          </p>

        </footer>

      </article>

    </>
  );
}


/* ============================================================
   DIVIDER
============================================================ */

function Divider() {
  return (
    <div className="my-2 border-t border-dashed border-black" />
  );
}


/* ============================================================
   RECEIPT PAIR
============================================================ */

function ReceiptPair({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
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


/* ============================================================
   MONEY ROW
============================================================ */

function MoneyRow({
  label,
  value,
  bold = false,
}: {
  label:
    string;

  value:
    number;

  bold?:
    boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-3 ${
        bold
          ? "font-bold"
          : ""
      }`}
    >

      <span>
        {label}
      </span>


      <span className="text-right tabular-nums">

        {value <
          0
          ? "-"
          : ""}

        {
          amount(
            Math.abs(
              value,
            ),
          )
        }

      </span>

    </div>
  );
}