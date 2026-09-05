"use client";

import * as React from "react";

import {
  Minus,
  PackageOpen,
  Plus,
  ScanLine,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  CheckoutDialog,
} from "@/components/pos/CheckoutDialog";

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

import {
  useCatalog,
} from "@/hooks/use-catalog";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  findVariantByScanValue,
  formatMoney,
  type Product,
} from "@/lib/domain/catalog";

import type {
  CompleteSaleResult,
} from "@/lib/domain/checkout";

import type {
  RemoteScanResult,
} from "@/lib/remote-scanner/protocol";

import {
  cn,
} from "@/lib/utils";

import {
  useCart,
  type CartState,
} from "@/store/use-cart";


/* ============================================================
   POS PAGE
============================================================ */

export default function POSPage() {
  const [
    activeCategory,
    setActiveCategory,
  ] =
    React.useState(
      "All",
    );


  const [
    searchQuery,
    setSearchQuery,
  ] =
    React.useState("");


  const [
    scannerOpen,
    setScannerOpen,
  ] =
    React.useState(false);


  const [
    mobileCartOpen,
    setMobileCartOpen,
  ] =
    React.useState(false);


  const [
    checkoutOpen,
    setCheckoutOpen,
  ] =
    React.useState(false);


  const [
    selectedProduct,
    setSelectedProduct,
  ] =
    React.useState<
      Product | null
    >(null);


  const cart =
    useCart();


  const {
    business,
  } =
    useCurrentBusiness();


  const {
    products,

    loading:
      catalogLoading,

    error:
      catalogError,

    refresh:
      refreshCatalog,
  } =
    useCatalog();


  const currencyCode =
    business?.currency_code ??
    "LKR";


  /* ==========================================================
     SELLABLE PRODUCTS
  ========================================================== */

  const sellableProducts =
    React.useMemo(
      () =>
        products

          .filter(
            (product) =>
              product.status ===
              "Active",
          )

          .map(
            (product) => ({
              ...product,

              variants:
                product.variants.filter(
                  (variant) =>
                    variant.active !==
                    false,
                ),
            }),
          )

          .filter(
            (product) =>
              product.variants.length >
              0,
          ),

      [
        products,
      ],
    );


  /* ==========================================================
     CATEGORIES
  ========================================================== */

  const categories =
    React.useMemo(
      () => [
        "All",

        ...Array.from(
          new Set(
            sellableProducts.map(
              (product) =>
                product.category,
            ),
          ),
        ).sort(),
      ],

      [
        sellableProducts,
      ],
    );


  /* ==========================================================
     FILTER PRODUCTS
  ========================================================== */

  const filteredProducts =
    React.useMemo(
      () =>
        sellableProducts.filter(
          (product) => {
            if (
              activeCategory !==
                "All" &&
              product.category !==
                activeCategory
            ) {
              return false;
            }


            const query =
              searchQuery
                .trim()
                .toLowerCase();


            if (!query) {
              return true;
            }


            return (
              product.name
                .toLowerCase()
                .includes(
                  query,
                )
              ||
              product.variants.some(
                (variant) =>
                  variant.sku
                    .toLowerCase()
                    .includes(
                      query,
                    ),
              )
            );
          },
        ),

      [
        activeCategory,
        searchQuery,
        sellableProducts,
      ],
    );


  /* ==========================================================
     PRODUCT CLICK
  ========================================================== */

  function handleProductClick(
    product: Product,
  ) {
    if (
      product.variants.length ===
      1
    ) {
      const variant =
        product.variants[0];


      if (
        variant.stock <=
        0
      ) {
        return;
      }


      cart.addItem(
        product,
        variant,
      );


      return;
    }


    setSelectedProduct(
      product,
    );
  }


  /* ==========================================================
     SHARED SCANNER RESOLVER

     Used by:
     - laptop camera
     - phone remote scanner
     - SKU / NOVA QR input
  ========================================================== */

  const processScan =
    React.useCallback(
      (
        value: string,
      ): RemoteScanResult => {
        const match =
          findVariantByScanValue(
            products,
            value,
          );


        if (!match) {
          return {
            accepted:
              false,

            message:
              "Product was not found.",
          };
        }


        if (
          match.variant.stock <=
          0
        ) {
          return {
            accepted:
              false,

            label:
              `${match.product.name} · ${match.variant.name}`,

            message:
              "This product is out of stock.",
          };
        }


        cart.addItem(
          match.product,
          match.variant,
        );


        return {
          accepted:
            true,

          label:
            `${match.product.name} · ${match.variant.name}`,
        };
      },

      [
        cart,
        products,
      ],
    );


  const handleLocalScan =
    React.useCallback(
      (
        value: string,
      ) =>
        processScan(
          value,
        ).accepted,

      [
        processScan,
      ],
    );


  const handleRemoteScan =
    React.useCallback(
      (
        value: string,
      ) =>
        processScan(
          value,
        ),

      [
        processScan,
      ],
    );


  /* ==========================================================
     CHECKOUT
  ========================================================== */

  function handleCheckout() {
    if (
      !business?.id ||
      cart.items.length ===
        0
    ) {
      return;
    }


    setCheckoutOpen(
      true,
    );
  }


  async function handleSaleCompleted(
    _result:
      CompleteSaleResult,
  ) {
    /*
     * Database transaction already
     * committed before this runs.
     */

    cart.clearCart();


    setMobileCartOpen(
      false,
    );


    /*
     * Refresh catalog so newly reduced
     * stock immediately appears in POS.
     */

    await refreshCatalog();
  }


  const total =
    cart.getTotal();


  return (
    <AppLayout
      title="New Sale"
      noPadding
    >

      {/* ======================================================
          RESPONSIVE POS SHELL

          MOBILE:
          Natural full-page scrolling.

          DESKTOP:
          Fixed-height POS with independent product/cart scroll.
      ======================================================= */}

      <div
        className="
          min-h-full
          w-full
          bg-muted/30

          md:flex
          md:h-full
          md:min-h-0
          md:flex-row
          md:overflow-hidden
        "
      >

        {/* ====================================================
            PRODUCT AREA
        ===================================================== */}

        <div
          className="
            flex
            min-w-0
            flex-col
            p-4
            pb-32

            sm:p-6

            md:h-full
            md:min-h-0
            md:flex-1
            md:overflow-hidden
            md:pb-6
          "
        >

          {/* ==================================================
              SEARCH + SCANNERS
          =================================================== */}

          <div className="mb-6 flex gap-2">

            <div className="relative min-w-0 flex-1">

              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />


              <Input
                placeholder="Search products, SKU..."
                className="h-11 rounded-xl bg-background pl-10 text-base shadow-sm"
                value={
                  searchQuery
                }
                onChange={(
                  event,
                ) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
              />

            </div>


            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0 rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() =>
                setScannerOpen(
                  true,
                )
              }
              title="Use this device camera"
              aria-label="Use this device camera"
            >

              <ScanLine className="h-5 w-5" />

            </Button>


            <RemoteScannerControl
              onScan={
                handleRemoteScan
              }
            />

          </div>


          {/* ==================================================
              CATEGORIES
          =================================================== */}

          <div
            className="
              flex
              shrink-0
              snap-x
              gap-2
              overflow-x-auto
              pb-4
              [-webkit-overflow-scrolling:touch]
            "
          >

            {categories.map(
              (
                category,
              ) => (

                <button
                  key={
                    category
                  }
                  type="button"
                  onClick={() =>
                    setActiveCategory(
                      category,
                    )
                  }
                  className={cn(
                    `
                      snap-start
                      whitespace-nowrap
                      rounded-[12px]
                      px-5
                      py-2
                      text-sm
                      font-semibold
                      transition-all
                    `,

                    activeCategory ===
                      category
                      ? `
                        bg-foreground
                        text-background
                        shadow-md
                      `
                      : `
                        border
                        bg-background
                        text-muted-foreground
                        hover:bg-muted
                      `,
                  )}
                >

                  {category}

                </button>

              ),
            )}

          </div>


          {/* ==================================================
              PRODUCT GRID

              Mobile:
              no inner vertical scrollbar — AppLayout scrolls.

              Desktop:
              independently scrollable product catalog.
          =================================================== */}

          <div
            className="
              mt-2
              min-w-0

              md:min-h-0
              md:flex-1
              md:overflow-y-auto
              md:overscroll-contain
              md:pr-2
            "
          >

            {/* ================================================
                CATALOG ERROR
            ================================================= */}

            {catalogError && (

              <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

                Catalog could not be loaded:{" "}

                {
                  catalogError
                }

              </div>

            )}


            {/* ================================================
                LOADING
            ================================================= */}

            {catalogLoading ? (

              <div
                className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4"
                aria-label="Loading products"
              >

                {Array.from({
                  length: 8,
                }).map(
                  (
                    _,
                    index,
                  ) => (

                    <div
                      key={
                        index
                      }
                      className="animate-pulse rounded-[16px] border bg-background p-2"
                    >

                      <div className="aspect-square rounded-[12px] bg-muted" />


                      <div className="mx-2 mt-3 h-4 rounded bg-muted" />


                      <div className="mx-2 mb-2 mt-2 h-3 w-2/3 rounded bg-muted" />

                    </div>

                  ),
                )}

              </div>

            ) : (

              /* ==============================================
                 PRODUCTS
              =============================================== */

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">

                <AnimatePresence mode="popLayout">

                  {filteredProducts.map(
                    (
                      product,
                    ) => (

                      <motion.div
                        layout
                        initial={{
                          opacity:
                            0,

                          scale:
                            0.9,
                        }}
                        animate={{
                          opacity:
                            1,

                          scale:
                            1,
                        }}
                        exit={{
                          opacity:
                            0,

                          scale:
                            0.9,
                        }}
                        transition={{
                          duration:
                            0.2,
                        }}
                        key={
                          product.id
                        }
                        className="
                          group
                          cursor-pointer
                          rounded-[16px]
                          border
                          bg-background
                          p-2
                          shadow-sm
                          transition-all
                          hover:shadow-md
                          hover:ring-2
                          hover:ring-primary/20
                        "
                        onClick={() =>
                          handleProductClick(
                            product,
                          )
                        }
                      >

                        {/* ====================================
                            PRODUCT IMAGE
                        ===================================== */}

                        <div className="relative mb-3 aspect-square w-full overflow-hidden rounded-[12px] bg-muted">

                          <img
                            src={
                              product.image
                            }
                            alt={
                              product.name
                            }
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />


                          <div className="absolute right-2 top-2 rounded-[8px] bg-background/90 px-2 py-1 text-xs font-bold shadow-sm backdrop-blur-sm">

                            {formatMoney(
                              product
                                .variants[0]
                                .price,

                              currencyCode,
                            )}

                          </div>

                        </div>


                        {/* ====================================
                            PRODUCT INFO
                        ===================================== */}

                        <div className="px-2 pb-2">

                          <p className="line-clamp-2 text-sm font-semibold leading-tight">

                            {
                              product.name
                            }

                          </p>


                          <p className="mt-1 text-xs font-medium text-muted-foreground">

                            {
                              product
                                .variants[0]
                                .stock
                            }{" "}

                            in stock

                          </p>

                        </div>

                      </motion.div>

                    ),
                  )}

                </AnimatePresence>

              </div>

            )}


            {/* ================================================
                EMPTY STATE
            ================================================= */}

            {!catalogLoading &&
              filteredProducts.length ===
                0 && (

                <div className="flex h-64 flex-col items-center justify-center text-center">

                  <PackageOpen className="mb-4 h-12 w-12 text-muted-foreground/50" />


                  <h3 className="text-lg font-medium">
                    No products found
                  </h3>


                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your search or category filter.
                  </p>

                </div>

              )}

          </div>

        </div>


        {/* ====================================================
            DESKTOP CART
        ===================================================== */}

        <div
          className="
            z-10
            hidden
            h-full
            min-h-0
            w-[380px]
            flex-col
            border-l
            bg-background
            shadow-xl
            shadow-slate-200/50

            md:flex
          "
        >

          <CartContent
            cart={
              cart
            }
            currencyCode={
              currencyCode
            }
            checkoutReady={
              Boolean(
                business?.id,
              )
            }
            onCheckout={
              handleCheckout
            }
          />

        </div>


        {/* ====================================================
            MOBILE CART BUTTON

            Positioned ABOVE the mobile navigation
            and iPhone safe area.
        ===================================================== */}

        <div
          className="
            pointer-events-none
            fixed
            bottom-[calc(4.75rem+env(safe-area-inset-bottom))]
            left-0
            right-0
            z-30
            p-4

            md:hidden
          "
        >

          <div className="flex justify-end">

            <Button
              type="button"
              className="pointer-events-auto relative h-14 w-14 rounded-full shadow-xl"
              onClick={() =>
                setMobileCartOpen(
                  true,
                )
              }
            >

              <ShoppingBag className="h-6 w-6" />


              {cart.items.length >
                0 && (

                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-destructive text-[11px] font-bold text-white">

                  {cart.items.reduce(
                    (
                      sum,
                      item,
                    ) =>
                      sum +
                      item.quantity,

                    0,
                  )}

                </span>

              )}

            </Button>

          </div>

        </div>


        {/* ====================================================
            MOBILE CART SHEET
        ===================================================== */}

        <AnimatePresence>

          {mobileCartOpen && (

            <>

              {/* ==============================================
                  BACKDROP
              =============================================== */}

              <motion.div
                initial={{
                  opacity:
                    0,
                }}
                animate={{
                  opacity:
                    1,
                }}
                exit={{
                  opacity:
                    0,
                }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
                onClick={() =>
                  setMobileCartOpen(
                    false,
                  )
                }
              />


              {/* ==============================================
                  CART SHEET
              =============================================== */}

              <motion.div
                initial={{
                  y:
                    "100%",
                }}
                animate={{
                  y:
                    0,
                }}
                exit={{
                  y:
                    "100%",
                }}
                transition={{
                  type:
                    "spring",

                  damping:
                    25,

                  stiffness:
                    200,
                }}
                className="
                  fixed
                  bottom-0
                  left-0
                  right-0
                  z-50
                  flex
                  h-[85dvh]
                  max-h-[85dvh]
                  flex-col
                  overflow-hidden
                  rounded-t-[32px]
                  bg-background
                  pb-[env(safe-area-inset-bottom)]
                  shadow-2xl

                  md:hidden
                "
              >

                <div className="flex shrink-0 justify-center p-3">

                  <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />

                </div>


                <CartContent
                  cart={
                    cart
                  }
                  currencyCode={
                    currencyCode
                  }
                  checkoutReady={
                    Boolean(
                      business?.id,
                    )
                  }
                  onCheckout={
                    handleCheckout
                  }
                  onClose={() =>
                    setMobileCartOpen(
                      false,
                    )
                  }
                />

              </motion.div>

            </>

          )}

        </AnimatePresence>

      </div>


      {/* ======================================================
          LOCAL CAMERA SCANNER
      ======================================================= */}

      <Scanner
        isOpen={
          scannerOpen
        }
        onClose={() =>
          setScannerOpen(
            false,
          )
        }
        onScan={
          handleLocalScan
        }
        continuous
      />


      {/* ======================================================
          VARIANT PICKER
      ======================================================= */}

      <Dialog
        isOpen={
          Boolean(
            selectedProduct,
          )
        }
        onClose={() =>
          setSelectedProduct(
            null,
          )
        }
        title={
          selectedProduct
            ? `Choose ${selectedProduct.name} variant`
            : "Choose variant"
        }
        description="Select the exact variant to add to this sale."
      >

        <div className="space-y-2">

          {selectedProduct?.variants.map(
            (
              variant,
            ) => (

              <button
                key={
                  variant.id
                }
                type="button"
                disabled={
                  variant.stock <=
                  0
                }
                onClick={() => {
                  cart.addItem(
                    selectedProduct,
                    variant,
                  );


                  setSelectedProduct(
                    null,
                  );
                }}
                className="
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-[16px]
                  border
                  bg-background
                  p-4
                  text-left
                  transition-colors
                  hover:border-primary/40
                  hover:bg-muted/40
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                <div>

                  <p className="font-semibold">

                    {
                      variant.name
                    }

                  </p>


                  <p className="mt-1 font-mono text-xs text-muted-foreground">

                    {
                      variant.sku
                    }

                  </p>

                </div>


                <div className="text-right">

                  <p className="font-bold text-primary">

                    {formatMoney(
                      variant.price,
                      currencyCode,
                    )}

                  </p>


                  <p className="mt-1 text-xs text-muted-foreground">

                    {
                      variant.stock
                    }{" "}

                    in stock

                  </p>

                </div>

              </button>

            ),
          )}

        </div>

      </Dialog>


      {/* ======================================================
          REAL DATABASE CHECKOUT
      ======================================================= */}

      {business?.id && (

        <CheckoutDialog
          isOpen={
            checkoutOpen
          }
          onClose={() =>
            setCheckoutOpen(
              false,
            )
          }
          businessId={
            business.id
          }
          currencyCode={
            currencyCode
          }
          items={
            cart.items
          }
          discountTotal={
            cart.discount
          }
          note={
            cart.note
          }
          displayTotal={
            total
          }
          onCompleted={
            handleSaleCompleted
          }
        />

      )}

    </AppLayout>
  );
}


/* ============================================================
   CART CONTENT
============================================================ */

function CartContent({
  cart,
  currencyCode,
  checkoutReady,
  onCheckout,
  onClose,
}: {
  cart:
    CartState;

  currencyCode:
    string;

  checkoutReady:
    boolean;

  onCheckout:
    () => void;

  onClose?:
    () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">

      {/* ======================================================
          CART HEADER
      ======================================================= */}

      <div className="flex shrink-0 items-center justify-between border-b bg-background p-4 sm:p-6">

        <h2 className="text-lg font-bold">
          Current Order
        </h2>


        <div className="flex items-center gap-2">

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={
              cart.clearCart
            }
          >

            Clear

          </Button>


          {onClose && (

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={
                onClose
              }
              className="md:hidden"
            >

              <X className="h-5 w-5" />

            </Button>

          )}

        </div>

      </div>


      {/* ======================================================
          CART ITEMS
      ======================================================= */}

      <div
        className="
          min-h-0
          flex-1
          overflow-y-auto
          overscroll-contain
          p-2
          [-webkit-overflow-scrolling:touch]

          sm:p-4
        "
      >

        {cart.items.length ===
        0 ? (

          <div className="flex h-full flex-col items-center justify-center space-y-3 text-muted-foreground">

            <ShoppingBag className="h-12 w-12 opacity-20" />


            <p className="font-medium">
              Cart is empty
            </p>

          </div>

        ) : (

          <AnimatePresence initial={false}>

            {cart.items.map(
              (
                item,
              ) => (

                <motion.div
                  key={
                    item.id
                  }
                  layout
                  initial={{
                    opacity:
                      0,

                    x:
                      -20,
                  }}
                  animate={{
                    opacity:
                      1,

                    x:
                      0,
                  }}
                  exit={{
                    opacity:
                      0,

                    scale:
                      0.95,
                  }}
                  transition={{
                    duration:
                      0.2,
                  }}
                  className="mb-2 flex items-center gap-3 rounded-[16px] border bg-card p-3 shadow-sm"
                >

                  <div className="min-w-0 flex-1">

                    <p className="truncate text-sm font-semibold">

                      {
                        item.product.name
                      }

                    </p>


                    <p className="text-xs text-muted-foreground">

                      {
                        item.variant.name
                      }

                    </p>


                    <p className="mt-1 text-sm font-medium text-primary">

                      {formatMoney(
                        item.variant.price,

                        currencyCode,
                      )}

                    </p>

                  </div>


                  <div className="flex shrink-0 flex-col items-end gap-2">

                    <div className="flex items-center rounded-lg border bg-muted">

                      <button
                        type="button"
                        className="rounded-l-lg p-1.5 transition-colors hover:bg-background disabled:opacity-50"
                        onClick={() =>
                          item.quantity >
                          1
                            ? cart.updateQuantity(
                                item.id,

                                item.quantity -
                                  1,
                              )
                            : cart.removeItem(
                                item.id,
                              )
                        }
                        aria-label={`Reduce ${item.product.name}`}
                      >

                        <Minus className="h-3.5 w-3.5" />

                      </button>


                      <span className="w-8 text-center text-sm font-medium">

                        {
                          item.quantity
                        }

                      </span>


                      <button
                        type="button"
                        className="rounded-r-lg p-1.5 transition-colors hover:bg-background disabled:opacity-40"
                        disabled={
                          item.quantity >=
                          item.variant.stock
                        }
                        onClick={() =>
                          cart.updateQuantity(
                            item.id,

                            item.quantity +
                              1,
                          )
                        }
                        aria-label={`Add another ${item.product.name}`}
                      >

                        <Plus className="h-3.5 w-3.5" />

                      </button>

                    </div>

                  </div>

                </motion.div>

              ),
            )}

          </AnimatePresence>

        )}

      </div>


      {/* ======================================================
          TOTALS
      ======================================================= */}

      <div className="shrink-0 border-t bg-muted/30 p-4 sm:p-6">

        <div className="mb-4 space-y-2 text-sm">

          <div className="flex justify-between text-muted-foreground">

            <span>
              Subtotal
            </span>


            <span>

              {formatMoney(
                cart.getSubtotal(),

                currencyCode,
              )}

            </span>

          </div>


          {cart.discount >
            0 && (

            <div className="flex justify-between text-destructive">

              <span>
                Discount
              </span>


              <span>

                -

                {formatMoney(
                  cart.discount,

                  currencyCode,
                )}

              </span>

            </div>

          )}


          <div className="flex justify-between border-t border-border/50 pt-2 text-lg font-bold">

            <span>
              Total
            </span>


            <span>

              {formatMoney(
                cart.getTotal(),

                currencyCode,
              )}

            </span>

          </div>

        </div>


        <Button
          type="button"
          className="h-14 w-full rounded-[16px] text-sm font-bold"
          disabled={
            cart.items.length ===
              0 ||
            !checkoutReady
          }
          onClick={
            onCheckout
          }
        >

          CHARGE —{" "}

          {formatMoney(
            cart.getTotal(),

            currencyCode,
          )}

        </Button>

      </div>

    </div>
  );
}