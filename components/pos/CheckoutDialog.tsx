"use client";

import * as React from "react";

import {
  BadgePercent,
  Banknote,
  Check,
  CreditCard,
  Landmark,
  Loader2,
  Minus,
  Plus,
  Search,
  Sparkles,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";

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
  ReceiptDialog,
} from "@/components/receipts/ReceiptDialog";

import {
  completeSale,
} from "@/lib/data/checkout";

import {
  lookupCustomerByPhone,
  saveCustomer,
} from "@/lib/data/customers";

import {
  fetchLoyaltySettings,
  type LoyaltySettings,
} from "@/lib/data/loyalty";

import type {
  CustomerDetail,
} from "@/lib/domain/customers";

import type {
  CompleteSaleResult,
} from "@/lib/domain/checkout";

import {
  formatSaleMoney,
  type PaymentMethod,
} from "@/lib/domain/sales";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import type {
  CartItem,
} from "@/store/use-cart";


type CheckoutDialogProps = {
  isOpen: boolean;

  onClose: () => void;

  businessId: string;

  currencyCode: string;

  items: CartItem[];

  discountTotal: number;

  note: string;

  displayTotal: number;

  onCompleted: (
    result:
      CompleteSaleResult,
  ) =>
    void |
    Promise<void>;
};


/* ============================================================
   HELPERS
============================================================ */

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
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


  return "The sale could not be completed.";
}


function roundMoney(
  value: number,
) {
  return Math.round(
    (
      value +
      Number.EPSILON
    ) *
      100,
  ) / 100;
}


/* ============================================================
   CHECKOUT
============================================================ */

export function CheckoutDialog({
  isOpen,
  onClose,
  businessId,
  currencyCode,
  items,
  discountTotal,
  note,
  displayTotal,
  onCompleted,
}: CheckoutDialogProps) {
  const {
    business,
  } =
    useCurrentBusiness();


  /* ==========================================================
     PAYMENT
  ========================================================== */

  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    React.useState<
      PaymentMethod
    >(
      "cash",
    );


  const [
    cashReceived,
    setCashReceived,
  ] =
    React.useState("");


  const [
    referenceNumber,
    setReferenceNumber,
  ] =
    React.useState("");


  /* ==========================================================
     CUSTOMER
  ========================================================== */

  const [
    customerName,
    setCustomerName,
  ] =
    React.useState("");


  const [
    customerEmail,
    setCustomerEmail,
  ] =
    React.useState("");


  const [
    customerPhone,
    setCustomerPhone,
  ] =
    React.useState("");


  const [
    selectedCustomer,
    setSelectedCustomer,
  ] =
    React.useState<
      CustomerDetail | null
    >(null);


  const [
    customerSearching,
    setCustomerSearching,
  ] =
    React.useState(false);


  const [
    customerRegistering,
    setCustomerRegistering,
  ] =
    React.useState(false);


  const [
    customerMessage,
    setCustomerMessage,
  ] =
    React.useState<
      string | null
    >(null);


  /* ==========================================================
     LOYALTY
  ========================================================== */

  const [
    loyaltySettings,
    setLoyaltySettings,
  ] =
    React.useState<
      LoyaltySettings | null
    >(null);


  const [
    loyaltyLoading,
    setLoyaltyLoading,
  ] =
    React.useState(false);


  const [
    loyaltyPointsToRedeem,
    setLoyaltyPointsToRedeem,
  ] =
    React.useState(0);


  /* ==========================================================
     CHECKOUT STATE
  ========================================================== */

  const [
    submitting,
    setSubmitting,
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
    receiptSaleId,
    setReceiptSaleId,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    receiptOpen,
    setReceiptOpen,
  ] =
    React.useState(false);


  const checkoutKeyRef =
    React.useRef(
      crypto.randomUUID(),
    );


  /* ==========================================================
     LOYALTY SETTINGS
  ========================================================== */

  React.useEffect(() => {
    if (
      !isOpen ||
      !businessId
    ) {
      return;
    }


    let cancelled =
      false;


    async function load() {
      setLoyaltyLoading(
        true,
      );


      try {
        const result =
          await fetchLoyaltySettings(
            businessId,
          );


        if (
          !cancelled
        ) {
          setLoyaltySettings(
            result,
          );
        }
      } catch {
        if (
          !cancelled
        ) {
          setLoyaltySettings(
            null,
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoyaltyLoading(
            false,
          );
        }
      }
    }


    void load();


    return () => {
      cancelled =
        true;
    };
  }, [
    businessId,
    isOpen,
  ]);


  /* ==========================================================
     CUSTOMER DISCOUNT
  ========================================================== */

  const customerDiscountPercent =
    selectedCustomer
      ?.customer
      .defaultDiscountPercent ??
    0;


  const estimatedCustomerDiscount =
    roundMoney(
      Math.max(
        0,
        displayTotal,
      ) *
        customerDiscountPercent /
        100,
    );


  const estimatedBeforeLoyalty =
    Math.max(
      0,
      roundMoney(
        displayTotal -
        estimatedCustomerDiscount,
      ),
    );


  /* ==========================================================
     LOYALTY LIMITS
  ========================================================== */

  const availablePoints =
    selectedCustomer
      ?.loyaltyPoints ??
    0;


  const redeemBlock =
    Math.max(
      1,
      loyaltySettings
        ?.redeemPoints ??
        100,
    );


  const redeemValue =
    Math.max(
      0,
      loyaltySettings
        ?.redeemValue ??
        0,
    );


  const maximumLoyaltyValue =
    loyaltySettings
      ? roundMoney(
          estimatedBeforeLoyalty *
            loyaltySettings
              .maximumDiscountPercent /
            100,
        )
      : 0;


  const maximumBlocksByValue =
    redeemValue >
    0
      ? Math.floor(
          maximumLoyaltyValue /
          redeemValue,
        )
      : 0;


  const maximumPointsByValue =
    maximumBlocksByValue *
    redeemBlock;


  const availableRoundedPoints =
    Math.floor(
      availablePoints /
      redeemBlock,
    ) *
    redeemBlock;


  const maximumRedeemablePoints =
    Math.max(
      0,
      Math.min(
        availableRoundedPoints,
        maximumPointsByValue,
      ),
    );


  const estimatedLoyaltyDiscount =
    loyaltySettings &&
    redeemValue >
      0
      ? roundMoney(
          (
            loyaltyPointsToRedeem /
            redeemBlock
          ) *
            redeemValue,
        )
      : 0;


  const estimatedFinalTotal =
    Math.max(
      0,
      roundMoney(
        estimatedBeforeLoyalty -
        estimatedLoyaltyDiscount,
      ),
    );


  /* ==========================================================
     CASH
  ========================================================== */

  const parsedCash =
    Number(
      cashReceived ||
      0,
    );


  const displayChange =
    paymentMethod ===
    "cash"
      ? Math.max(
          0,
          parsedCash -
            estimatedFinalTotal,
        )
      : 0;


  const cashSuggestions =
    React.useMemo(
      () => {
        const total =
          estimatedFinalTotal;


        const values = [
          total,

          Math.ceil(
            total /
            100,
          ) *
            100,

          Math.ceil(
            total /
            500,
          ) *
            500,

          Math.ceil(
            total /
            1000,
          ) *
            1000,

          1000,
          2000,
          5000,
          10000,
        ]
          .filter(
            (value) =>
              value >=
                total &&
              value >
                0,
          )
          .map(
            (value) =>
              roundMoney(
                value,
              ),
          );


        return Array.from(
          new Set(
            values,
          ),
        ).slice(
          0,
          4,
        );
      },
      [
        estimatedFinalTotal,
      ],
    );


  /* ==========================================================
     CHECKOUT AVAILABILITY
  ========================================================== */

  const customerBusy =
    customerSearching ||
    customerRegistering;


  const checkoutBusy =
    submitting ||
    customerBusy;


  const cashIsValid =
    paymentMethod !==
      "cash" ||
    (
      Boolean(
        cashReceived,
      ) &&
      Number.isFinite(
        parsedCash,
      ) &&
      parsedCash >=
        estimatedFinalTotal
    );


  const canCompleteSale =
    !checkoutBusy &&
    items.length >
      0 &&
    cashIsValid;


  /* ==========================================================
     RESET
  ========================================================== */

  React.useEffect(() => {
    if (isOpen) {
      return;
    }


    checkoutKeyRef.current =
      crypto.randomUUID();


    setPaymentMethod(
      "cash",
    );


    setCashReceived("");


    setReferenceNumber("");


    setCustomerName("");


    setCustomerEmail("");


    setCustomerPhone("");


    setSelectedCustomer(
      null,
    );


    setCustomerMessage(
      null,
    );


    setLoyaltyPointsToRedeem(
      0,
    );


    setError(null);
  }, [
    isOpen,
  ]);


  /* ==========================================================
     CUSTOMER PHONE CHANGE
  ========================================================== */

  function handleCustomerPhoneChange(
    value: string,
  ) {
    setCustomerPhone(
      value,
    );


    setSelectedCustomer(
      null,
    );


    setLoyaltyPointsToRedeem(
      0,
    );


    setCustomerMessage(
      null,
    );


    setError(
      null,
    );
  }


  /* ==========================================================
     CUSTOMER LOOKUP
  ========================================================== */

  async function handleCustomerLookup() {
    if (
      !customerPhone.trim() ||
      customerSearching ||
      submitting
    ) {
      return;
    }


    setCustomerSearching(
      true,
    );


    setCustomerMessage(
      null,
    );


    setError(
      null,
    );


    try {
      const result =
        await lookupCustomerByPhone({
          businessId,

          phone:
            customerPhone.trim(),
        });


      if (!result) {
        setSelectedCustomer(
          null,
        );


        setCustomerMessage(
          "No registered customer found. Enter their name to register them, or continue as a walk-in customer.",
        );


        return;
      }


      setSelectedCustomer(
        result,
      );


      setCustomerName(
        result.customer.name,
      );


      setCustomerEmail(
        result.customer.email ??
        "",
      );


      setCustomerPhone(
        result.customer.phone,
      );


      setLoyaltyPointsToRedeem(
        0,
      );


      setCustomerMessage(
        null,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setCustomerSearching(
        false,
      );
    }
  }


  /* ==========================================================
     CUSTOMER SEARCH ENTER
  ========================================================== */

  function handleCustomerSearchKeyDown(
    event:
      React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key !==
        "Enter" ||
      event.nativeEvent.isComposing
    ) {
      return;
    }


    event.preventDefault();


    if (
      !customerPhone.trim() ||
      customerSearching ||
      submitting
    ) {
      return;
    }


    void handleCustomerLookup();
  }


  /* ==========================================================
     QUICK REGISTER
  ========================================================== */

  async function handleQuickRegister() {
    if (
      customerRegistering ||
      submitting
    ) {
      return;
    }


    if (
      !customerName.trim()
    ) {
      setError(
        "Enter the customer's name before registering.",
      );

      return;
    }


    if (
      !customerPhone.trim()
    ) {
      setError(
        "Enter the customer's mobile number before registering.",
      );

      return;
    }


    if (
      customerEmail.trim() &&
      !customerEmail.includes(
        "@",
      )
    ) {
      setError(
        "Enter a valid customer email address.",
      );

      return;
    }


    setCustomerRegistering(
      true,
    );


    setError(
      null,
    );


    try {
      const customerId =
        await saveCustomer({
          businessId,

          name:
            customerName.trim(),

          phone:
            customerPhone.trim(),

          email:
            customerEmail.trim(),

          defaultDiscountPercent:
            0,
        });


      const result =
        await lookupCustomerByPhone({
          businessId,

          phone:
            customerPhone.trim(),
        });


      if (!result) {
        throw new Error(
          `Customer ${customerId} was created but could not be loaded.`,
        );
      }


      setSelectedCustomer(
        result,
      );


      setCustomerName(
        result.customer.name,
      );


      setCustomerEmail(
        result.customer.email ??
        "",
      );


      setCustomerPhone(
        result.customer.phone,
      );


      setLoyaltyPointsToRedeem(
        0,
      );


      setCustomerMessage(
        "Customer registered and selected.",
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setCustomerRegistering(
        false,
      );
    }
  }


  /* ==========================================================
     LOYALTY
  ========================================================== */

  function changeLoyaltyPoints(
    delta: number,
  ) {
    const next =
      Math.max(
        0,
        Math.min(
          maximumRedeemablePoints,
          loyaltyPointsToRedeem +
            delta,
        ),
      );


    setLoyaltyPointsToRedeem(
      next,
    );
  }


  /* ==========================================================
     COMPLETE SALE
  ========================================================== */

  async function handleCompleteSale() {
    if (
      submitting ||
      customerBusy ||
      items.length ===
        0
    ) {
      return;
    }


    if (
      paymentMethod ===
      "cash"
    ) {
      if (
        !Number.isFinite(
          parsedCash,
        ) ||
        parsedCash <
          estimatedFinalTotal
      ) {
        setError(
          "Enter enough cash to cover the estimated sale total.",
        );

        return;
      }
    }


    if (
      customerEmail.trim() &&
      !customerEmail.includes(
        "@",
      )
    ) {
      setError(
        "Enter a valid customer email address.",
      );

      return;
    }


    if (
      loyaltyPointsToRedeem >
        0 &&
      !selectedCustomer
    ) {
      setError(
        "Select a registered customer before redeeming loyalty points.",
      );

      return;
    }


    setSubmitting(
      true,
    );


    setError(
      null,
    );


    try {
      const result =
        await completeSale({
          businessId,

          checkoutKey:
            checkoutKeyRef.current,

          items:
            items.map(
              (item) => ({
                variantId:
                  item.variant.id,

                quantity:
                  item.quantity,
              }),
            ),

          paymentMethod,

          cashReceived:
            paymentMethod ===
            "cash"
              ? parsedCash
              : undefined,

          referenceNumber,

          discountTotal,

          customerId:
            selectedCustomer
              ?.customer.id ??
            null,

          loyaltyPointsToRedeem,

          customerName,

          customerEmail,

          customerPhone,

          note,
        });


      await onCompleted(
        result,
      );


      onClose();


      setReceiptSaleId(
        result.saleId,
      );


      setReceiptOpen(
        true,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }


  /* ==========================================================
     PAYMENT ENTER
  ========================================================== */

  function handlePaymentKeyDown(
    event:
      React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key !==
        "Enter" ||
      event.nativeEvent.isComposing
    ) {
      return;
    }


    event.preventDefault();


    if (
      checkoutBusy
    ) {
      return;
    }


    /*
     * Calling the real submit handler even when the cash
     * amount is invalid is intentional.
     *
     * It gives the cashier the proper validation message
     * instead of making Enter appear broken.
     */

    void handleCompleteSale();
  }


  return (
    <>

      <Dialog
        isOpen={
          isOpen
        }
        onClose={() => {
          if (
            !checkoutBusy
          ) {
            onClose();
          }
        }}
        title="Payment"
        description="NOVA verifies live price, stock, customer discounts and loyalty inside PostgreSQL before committing the sale."
        className="w-[calc(100vw-1rem)] max-h-[calc(100dvh-1rem)] max-w-2xl overflow-hidden sm:w-full"
      >

        <div className="flex min-h-0 max-h-[calc(100dvh-9rem)] flex-col">

          {/* ==================================================
              SCROLLABLE CONTENT
          =================================================== */}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [scrollbar-gutter:stable]">

            <div className="space-y-5 pb-6">

              {/* ==============================================
                  TOTAL
              =============================================== */}

              <div className="rounded-[20px] bg-muted/50 px-5 py-6 text-center">

                <p className="text-sm font-medium text-muted-foreground">
                  Estimated payable total
                </p>


                <p className="mt-1 text-4xl font-bold tracking-tight text-primary">

                  {formatSaleMoney(
                    estimatedFinalTotal,
                    currencyCode,
                  )}

                </p>


                {(estimatedCustomerDiscount >
                  0 ||
                  estimatedLoyaltyDiscount >
                    0) && (

                  <div className="mx-auto mt-4 max-w-sm space-y-1.5 text-xs">

                    <EstimateRow
                      label="Before customer benefits"
                      value={
                        formatSaleMoney(
                          displayTotal,
                          currencyCode,
                        )
                      }
                    />


                    {estimatedCustomerDiscount >
                      0 && (

                      <EstimateRow
                        label={`Customer discount (${customerDiscountPercent}%)`}
                        value={`-${formatSaleMoney(
                          estimatedCustomerDiscount,
                          currencyCode,
                        )}`}
                      />

                    )}


                    {estimatedLoyaltyDiscount >
                      0 && (

                      <EstimateRow
                        label={`Loyalty (${loyaltyPointsToRedeem} points)`}
                        value={`-${formatSaleMoney(
                          estimatedLoyaltyDiscount,
                          currencyCode,
                        )}`}
                      />

                    )}

                  </div>

                )}


                <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                  PostgreSQL recalculates the authoritative total using current prices and loyalty rules before saving.
                </p>

              </div>


              {/* ==============================================
                  CUSTOMER
              =============================================== */}

              <details className="rounded-[20px] border bg-muted/20 p-4">

                <summary className="cursor-pointer select-none text-sm font-semibold">
                  Customer & Loyalty — optional
                </summary>


                <div className="mt-4 space-y-4">

                  {/* ==========================================
                      PHONE LOOKUP
                  =========================================== */}

                  <div>

                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Mobile number
                    </label>


                    <div className="flex gap-2">

                      <Input
                        value={
                          customerPhone
                        }
                        onChange={(
                          event,
                        ) =>
                          handleCustomerPhoneChange(
                            event.target.value,
                          )
                        }
                        onKeyDown={
                          handleCustomerSearchKeyDown
                        }
                        inputMode="tel"
                        placeholder="077 123 4567"
                        disabled={
                          submitting
                        }
                        className="h-12 min-w-0 flex-1 rounded-[14px]"
                      />


                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-12 shrink-0 rounded-[14px] p-0"
                        disabled={
                          customerSearching ||
                          submitting ||
                          !customerPhone.trim()
                        }
                        onClick={() =>
                          void handleCustomerLookup()
                        }
                        aria-label="Search customer"
                        title="Search customer"
                      >

                        {customerSearching ? (

                          <Loader2 className="h-4 w-4 animate-spin" />

                        ) : (

                          <Search className="h-4 w-4" />

                        )}

                      </Button>

                    </div>


                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Press Enter or use the search button to find a registered customer.
                    </p>

                  </div>


                  {/* ==========================================
                      SELECTED CUSTOMER
                  =========================================== */}

                  {selectedCustomer ? (

                    <div className="rounded-[18px] border border-primary/20 bg-primary/[0.04] p-4">

                      <div className="flex items-start justify-between gap-3">

                        <div className="flex min-w-0 items-center gap-3">

                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-primary/10 text-primary">

                            <UserRound className="h-5 w-5" />

                          </div>


                          <div className="min-w-0">

                            <p className="truncate font-semibold">
                              {
                                selectedCustomer
                                  .customer
                                  .name
                              }
                            </p>


                            <p className="mt-1 text-xs text-muted-foreground">
                              {
                                selectedCustomer
                                  .customer
                                  .phone
                              }
                            </p>

                          </div>

                        </div>


                        <button
                          type="button"
                          disabled={
                            submitting
                          }
                          onClick={() => {
                            setSelectedCustomer(
                              null,
                            );


                            setLoyaltyPointsToRedeem(
                              0,
                            );
                          }}
                          className="rounded-[10px] p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                          aria-label="Remove selected customer"
                        >

                          <X className="h-4 w-4" />

                        </button>

                      </div>


                      <div className="mt-4 grid grid-cols-3 gap-3">

                        <CustomerStat
                          label="Points"
                          value={
                            selectedCustomer
                              .loyaltyPoints
                              .toLocaleString()
                          }
                        />


                        <CustomerStat
                          label="Visits"
                          value={
                            selectedCustomer
                              .visits
                              .toString()
                          }
                        />


                        <CustomerStat
                          label="Discount"
                          value={`${selectedCustomer.customer.defaultDiscountPercent}%`}
                        />

                      </div>

                    </div>

                  ) : (

                    /* ==========================================
                       WALK-IN / QUICK REGISTER
                    ========================================== */

                    <div className="grid gap-3">

                      <div>

                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Customer name
                        </label>


                        <Input
                          value={
                            customerName
                          }
                          disabled={
                            submitting
                          }
                          onChange={(
                            event,
                          ) =>
                            setCustomerName(
                              event.target.value,
                            )
                          }
                          className="h-12 rounded-[14px]"
                        />

                      </div>


                      <div>

                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Email
                        </label>


                        <Input
                          type="email"
                          value={
                            customerEmail
                          }
                          disabled={
                            submitting
                          }
                          onChange={(
                            event,
                          ) =>
                            setCustomerEmail(
                              event.target.value,
                            )
                          }
                          className="h-12 rounded-[14px]"
                        />

                      </div>


                      {customerPhone.trim() &&
                        customerName.trim() && (

                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full rounded-[14px]"
                          disabled={
                            customerRegistering ||
                            submitting
                          }
                          onClick={() =>
                            void handleQuickRegister()
                          }
                        >

                          {customerRegistering ? (

                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />

                          ) : (

                            <UserRound className="mr-2 h-4 w-4" />

                          )}


                          Register & Use Customer

                        </Button>

                      )}

                    </div>

                  )}


                  {customerMessage && (

                    <p className="rounded-[12px] bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      {
                        customerMessage
                      }
                    </p>

                  )}


                  {/* ==========================================
                      LOYALTY
                  =========================================== */}

                  {selectedCustomer && (

                    <div className="rounded-[18px] border p-4">

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex items-center gap-2">

                          <Sparkles className="h-5 w-5 text-primary" />


                          <div>

                            <p className="font-semibold">
                              Loyalty
                            </p>


                            <p className="mt-0.5 text-xs text-muted-foreground">

                              {
                                selectedCustomer
                                  .loyaltyPoints
                              }{" "}
                              points available

                            </p>

                          </div>

                        </div>


                        {loyaltyLoading && (

                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />

                        )}

                      </div>


                      {!loyaltyLoading &&
                        loyaltySettings &&
                        !loyaltySettings.enabled && (

                        <p className="mt-4 rounded-[12px] bg-muted p-3 text-xs leading-5 text-muted-foreground">
                          Loyalty is currently disabled for this business. The customer will still be attached to the sale.
                        </p>

                      )}


                      {loyaltySettings?.enabled && (

                        <>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">

                            <div className="rounded-[14px] bg-muted/40 p-3">

                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Earn rule
                              </p>


                              <p className="mt-1 text-sm font-semibold">

                                {
                                  loyaltySettings
                                    .pointsEarned
                                }{" "}
                                point
                                {loyaltySettings.pointsEarned ===
                                1
                                  ? ""
                                  : "s"}{" "}
                                per{" "}
                                {formatSaleMoney(
                                  loyaltySettings
                                    .spendAmountPerEarn,
                                  currencyCode,
                                )}

                              </p>

                            </div>


                            <div className="rounded-[14px] bg-muted/40 p-3">

                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Redemption
                              </p>


                              <p className="mt-1 text-sm font-semibold">

                                {
                                  loyaltySettings
                                    .redeemPoints
                                }{" "}
                                points ={" "}
                                {formatSaleMoney(
                                  loyaltySettings
                                    .redeemValue,
                                  currencyCode,
                                )}

                              </p>

                            </div>

                          </div>


                          {maximumRedeemablePoints >
                          0 ? (

                            <div className="mt-4">

                              <div className="flex items-center justify-between gap-3">

                                <p className="text-sm font-semibold">
                                  Redeem points
                                </p>


                                <button
                                  type="button"
                                  disabled={
                                    submitting
                                  }
                                  onClick={() =>
                                    setLoyaltyPointsToRedeem(
                                      maximumRedeemablePoints,
                                    )
                                  }
                                  className="text-xs font-semibold text-primary disabled:opacity-50"
                                >
                                  Use maximum
                                </button>

                              </div>


                              <div className="mt-2 flex items-center gap-3">

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 shrink-0 rounded-[12px]"
                                  disabled={
                                    submitting ||
                                    loyaltyPointsToRedeem <=
                                      0
                                  }
                                  onClick={() =>
                                    changeLoyaltyPoints(
                                      -redeemBlock,
                                    )
                                  }
                                >

                                  <Minus className="h-4 w-4" />

                                </Button>


                                <div className="flex-1 rounded-[14px] border bg-background p-3 text-center">

                                  <p className="text-lg font-bold">

                                    {
                                      loyaltyPointsToRedeem
                                    }{" "}
                                    pts

                                  </p>


                                  <p className="text-xs text-muted-foreground">

                                    {loyaltyPointsToRedeem >
                                    0
                                      ? `-${formatSaleMoney(
                                          estimatedLoyaltyDiscount,
                                          currencyCode,
                                        )}`
                                      : "No points redeemed"}

                                  </p>

                                </div>


                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 shrink-0 rounded-[12px]"
                                  disabled={
                                    submitting ||
                                    loyaltyPointsToRedeem >=
                                      maximumRedeemablePoints
                                  }
                                  onClick={() =>
                                    changeLoyaltyPoints(
                                      redeemBlock,
                                    )
                                  }
                                >

                                  <Plus className="h-4 w-4" />

                                </Button>

                              </div>


                              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">

                                Maximum available for this transaction:{" "}

                                {
                                  maximumRedeemablePoints.toLocaleString()
                                }{" "}

                                points.

                              </p>

                            </div>

                          ) : (

                            <p className="mt-4 text-xs leading-5 text-muted-foreground">
                              The customer does not currently have enough redeemable points for this transaction.
                            </p>

                          )}

                        </>

                      )}

                    </div>

                  )}

                </div>

              </details>


              {/* ==============================================
                  PAYMENT METHOD
              =============================================== */}

              <div>

                <p className="mb-2 text-sm font-semibold">
                  Payment method
                </p>


                <div className="grid grid-cols-3 gap-2">

                  <PaymentButton
                    active={
                      paymentMethod ===
                      "cash"
                    }
                    label="Cash"
                    icon={
                      <Banknote className="h-4 w-4" />
                    }
                    disabled={
                      submitting
                    }
                    onClick={() =>
                      setPaymentMethod(
                        "cash",
                      )
                    }
                  />


                  <PaymentButton
                    active={
                      paymentMethod ===
                      "card"
                    }
                    label="Card"
                    icon={
                      <CreditCard className="h-4 w-4" />
                    }
                    disabled={
                      submitting
                    }
                    onClick={() =>
                      setPaymentMethod(
                        "card",
                      )
                    }
                  />


                  <PaymentButton
                    active={
                      paymentMethod ===
                      "bank_transfer"
                    }
                    label="Bank"
                    icon={
                      <Landmark className="h-4 w-4" />
                    }
                    disabled={
                      submitting
                    }
                    onClick={() =>
                      setPaymentMethod(
                        "bank_transfer",
                      )
                    }
                  />

                </div>

              </div>


              {/* ==============================================
                  CASH
              =============================================== */}

              {paymentMethod ===
              "cash" ? (

                <div className="space-y-3">

                  <label className="text-sm font-medium">
                    Cash received
                  </label>


                  <div className="relative">

                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-medium text-muted-foreground">
                      {
                        currencyCode
                      }
                    </span>


                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        cashReceived
                      }
                      disabled={
                        submitting
                      }
                      onChange={(
                        event,
                      ) => {
                        setCashReceived(
                          event.target.value,
                        );


                        setError(
                          null,
                        );
                      }}
                      onKeyDown={
                        handlePaymentKeyDown
                      }
                      className="h-14 rounded-[14px] pl-14 pr-4 text-lg font-medium"
                      placeholder="0.00"
                    />

                  </div>


                  <p className="text-[10px] text-muted-foreground">
                    Press Enter to complete the sale when enough cash has been entered.
                  </p>


                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">

                    {cashSuggestions.map(
                      (value) => (

                        <Button
                          key={
                            value
                          }
                          type="button"
                          variant="outline"
                          className="min-h-11 rounded-[12px] px-2 text-sm"
                          disabled={
                            submitting
                          }
                          onClick={() => {
                            setCashReceived(
                              value.toString(),
                            );


                            setError(
                              null,
                            );
                          }}
                        >

                          {formatSaleMoney(
                            value,
                            currencyCode,
                          )}

                        </Button>

                      ),
                    )}

                  </div>


                  {parsedCash >=
                    estimatedFinalTotal &&
                    estimatedFinalTotal >
                      0 && (

                    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-emerald-500/20 bg-emerald-500/5 p-4">

                      <span className="text-sm text-muted-foreground">
                        Estimated change
                      </span>


                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">

                        {formatSaleMoney(
                          displayChange,
                          currencyCode,
                        )}

                      </span>

                    </div>

                  )}

                </div>

              ) : (

                /* ============================================
                   CARD / BANK
                ============================================= */

                <div className="space-y-2">

                  <label className="block text-sm font-medium">

                    Reference number{" "}

                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>

                  </label>


                  <Input
                    value={
                      referenceNumber
                    }
                    disabled={
                      submitting
                    }
                    onChange={(
                      event,
                    ) => {
                      setReferenceNumber(
                        event.target.value,
                      );


                      setError(
                        null,
                      );
                    }}
                    onKeyDown={
                      handlePaymentKeyDown
                    }
                    placeholder={
                      paymentMethod ===
                      "card"
                        ? "Card terminal reference"
                        : "Transfer reference"
                    }
                    className="h-12 rounded-[14px] px-4"
                  />


                  <p className="text-[10px] text-muted-foreground">
                    Press Enter to complete the sale.
                  </p>

                </div>

              )}


              {/* ==============================================
                  CUSTOMER BENEFITS
              =============================================== */}

              {selectedCustomer &&
                (
                  estimatedCustomerDiscount >
                    0 ||
                  loyaltyPointsToRedeem >
                    0
                ) && (

                <div className="rounded-[18px] border bg-muted/20 p-4">

                  <div className="flex items-center gap-2">

                    <BadgePercent className="h-4 w-4 text-primary" />


                    <p className="font-semibold">
                      Customer Benefits
                    </p>

                  </div>


                  <div className="mt-3 space-y-2">

                    {estimatedCustomerDiscount >
                      0 && (

                      <EstimateRow
                        label="Permanent discount"
                        value={`-${formatSaleMoney(
                          estimatedCustomerDiscount,
                          currencyCode,
                        )}`}
                      />

                    )}


                    {estimatedLoyaltyDiscount >
                      0 && (

                      <EstimateRow
                        label={`${loyaltyPointsToRedeem} loyalty points`}
                        value={`-${formatSaleMoney(
                          estimatedLoyaltyDiscount,
                          currencyCode,
                        )}`}
                      />

                    )}

                  </div>

                </div>

              )}


              {/* ==============================================
                  ERROR
              =============================================== */}

              {error && (

                <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm leading-5 text-destructive">

                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />


                  <span className="min-w-0 break-words">
                    {
                      error
                    }
                  </span>

                </div>

              )}

            </div>

          </div>


          {/* ==================================================
              FIXED CHECKOUT FOOTER
          =================================================== */}

          <div className="relative z-10 shrink-0 border-t bg-background pt-4">

            <div className="mb-3 flex items-center justify-between gap-4">

              <span className="text-sm text-muted-foreground">
                Payable
              </span>


              <span className="text-xl font-bold text-primary sm:text-2xl">

                {formatSaleMoney(
                  estimatedFinalTotal,
                  currencyCode,
                )}

              </span>

            </div>


            <Button
              type="button"
              className="h-14 w-full rounded-[16px] text-base font-semibold"
              disabled={
                !canCompleteSale
              }
              onClick={() =>
                void handleCompleteSale()
              }
            >

              {submitting ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : (

                <Check className="mr-2 h-4 w-4" />

              )}


              {submitting
                ? "Completing Sale…"
                : "Complete Sale"}

            </Button>

          </div>

        </div>

      </Dialog>


      {/* ======================================================
          RECEIPT
      ======================================================= */}

      <ReceiptDialog
        saleId={
          receiptSaleId
        }
        isOpen={
          receiptOpen
        }
        onClose={() =>
          setReceiptOpen(
            false,
          )
        }
        businessName={
          business?.name ??
          "NOVA POS"
        }
      />

    </>
  );
}


/* ============================================================
   PAYMENT BUTTON
============================================================ */

function PaymentButton({
  active,
  label,
  icon,
  disabled = false,
  onClick,
}: {
  active:
    boolean;

  label:
    string;

  icon:
    React.ReactNode;

  disabled?:
    boolean;

  onClick:
    () => void;
}) {
  return (
    <button
      type="button"
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className={`flex h-12 items-center justify-center gap-2 rounded-[14px] border px-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "bg-background hover:bg-muted"
      }`}
    >

      {
        icon
      }


      {
        label
      }

    </button>
  );
}


/* ============================================================
   CUSTOMER STAT
============================================================ */

function CustomerStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="min-w-0 rounded-[12px] bg-background p-3">

      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {
          label
        }
      </p>


      <p className="mt-1 truncate text-sm font-bold">
        {
          value
        }
      </p>

    </div>
  );
}


/* ============================================================
   ESTIMATE ROW
============================================================ */

function EstimateRow({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">

      <span className="min-w-0 text-muted-foreground">
        {
          label
        }
      </span>


      <span className="shrink-0 font-semibold">
        {
          value
        }
      </span>

    </div>
  );
}