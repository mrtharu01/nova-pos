"use client";

import * as React from "react";

import {
  useRouter,
} from "next/navigation";

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
  useBusinessAccess,
} from "@/hooks/use-business-access";

import {
  useCatalog,
} from "@/hooks/use-catalog";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  findVariantByScanValue,
  formatMoney,
  priceVariantQuantity,
  type Product,
  type ProductVariant,
} from "@/lib/domain/catalog";

import {
  breakInventoryUnit,
  fetchDefaultInventoryLocation,
} from "@/lib/data/catalog-admin";

import {
  fetchCatalogProducts,
} from "@/lib/data/catalog";

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
    unknownScanValue,
    setUnknownScanValue,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


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

  const [
    unitBreakRequest,
    setUnitBreakRequest,
  ] =
    React.useState<{
      product: Product;
      variant: ProductVariant;
    } | null>(
      null,
    );


  const [
    breakingUnit,
    setBreakingUnit,
  ] =
    React.useState(
      false,
    );


  const [
    unitBreakError,
    setUnitBreakError,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const cart =
    useCart();


  const router =
    useRouter();


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


  const {
    access,
  } =
    useBusinessAccess(
      business?.id,
    );


  const canManageCatalog =
    access?.permissions
      .manageCatalog ??
    false;


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


  function getProductStockLabel(
    product: Product,
  ) {
    if (
      product.variants.length ===
      1
    ) {
      return `${product.variants[0].stock} in stock`;
    }


    const ordered =
      [...product.variants]
        .sort(
          (
            left,
            right,
          ) =>
            right.stock -
            left.stock,
        );


    const visible =
      ordered.slice(
        0,
        2,
      );


    const summary =
      visible
        .map(
          (
            variant,
          ) =>
            `${variant.name} ${variant.stock}`,
        )
        .join(
          " · ",
        );


    const extra =
      ordered.length >
      visible.length
        ? ` · +${ordered.length - visible.length} more`
        : "";


    return `${summary}${extra}`;
  }


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
                ) ||
              product.variants.some(
                (variant) =>
                  variant.sku
                    .toLowerCase()
                    .includes(
                      query,
                    ) ||
                  variant.barcode
                    ?.toLowerCase()
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


  function cartQuantityForVariant(
    variantId: string,
  ) {
    return cart.items.reduce(
      (
        total,
        item,
      ) =>
        item.variant.id ===
        variantId
          ? total +
            item.quantity
          : total,
      0,
    );
  }


  function getBreakableParent(
    product: Product,
    variant: ProductVariant,
  ) {
    if (
      !product.multiUnitEnabled ||
      !variant.unitParentVariantId ||
      !variant.unitsPerParent
    ) {
      return null;
    }


    const parent =
      product.variants.find(
        (
          candidate,
        ) =>
          candidate.id ===
          variant.unitParentVariantId &&
          candidate.active !==
          false,
      ) ??
      null;


    if (!parent) {
      return null;
    }


    const availableParent =
      parent.stock -
      cartQuantityForVariant(
        parent.id,
      );


    return availableParent >
      0
      ? parent
      : null;
  }


  function canAddVariant(
    product: Product,
    variant: ProductVariant,
  ) {
    const directAvailable =
      variant.stock -
      cartQuantityForVariant(
        variant.id,
      );


    return (
      directAvailable >
        0 ||
      Boolean(
        getBreakableParent(
          product,
          variant,
        ),
      )
    );
  }


  function requestAddVariant(
    product: Product,
    variant: ProductVariant,
    batchId?: string,
  ):
    | "added"
    | "break"
    | "out" {
    const directAvailable =
      variant.stock -
      cartQuantityForVariant(
        variant.id,
      );


    if (
      directAvailable >
      0
    ) {
      cart.addItem(
        product,
        variant,
        1,
        batchId,
      );

      return "added";
    }


    if (
      getBreakableParent(
        product,
        variant,
      )
    ) {
      setSelectedProduct(
        null,
      );

      setScannerOpen(
        false,
      );

      setUnitBreakError(
        null,
      );

      setUnitBreakRequest({
        product,
        variant,
      });

      return "break";
    }


    return "out";
  }


  async function handleBreakAndAdd() {
    if (
      !unitBreakRequest ||
      breakingUnit
    ) {
      return;
    }


    setBreakingUnit(
      true,
    );

    setUnitBreakError(
      null,
    );


    try {
      const locationId =
        await fetchDefaultInventoryLocation(
          business?.id,
        );


      await breakInventoryUnit({
        childVariantId:
          unitBreakRequest.variant.id,
        locationId,
        parentQuantity:
          1,
      });


      const freshProducts =
        await fetchCatalogProducts();


      const freshProduct =
        freshProducts.find(
          (
            product,
          ) =>
            product.id ===
            unitBreakRequest.product.id,
        );


      const freshVariant =
        freshProduct?.variants.find(
          (
            variant,
          ) =>
            variant.id ===
            unitBreakRequest.variant.id,
        );


      if (
        !freshProduct ||
        !freshVariant ||
        freshVariant.stock <=
          0
      ) {
        throw new Error(
          "The pack was opened, but ARC could not refresh the loose stock. Refresh POS before continuing.",
        );
      }


      cart.addItem(
        freshProduct,
        freshVariant,
      );


      setUnitBreakRequest(
        null,
      );


      await refreshCatalog();
    } catch (
      cause
    ) {
      setUnitBreakError(
        cause instanceof
          Error
          ? cause.message
          : "ARC could not break the sealed stock.",
      );
    } finally {
      setBreakingUnit(
        false,
      );
    }
  }


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


      requestAddVariant(
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
     - SKU / ARC QR input
  ========================================================== */

  function processScan(
    value: string,
  ): RemoteScanResult {
    const match =
      findVariantByScanValue(
        products,
        value,
      );


    if (!match) {
      if (
        canManageCatalog
      ) {
        setUnknownScanValue(
          value.trim(),
        );


        setScannerOpen(
          false,
        );
      }


      return {
        accepted:
          false,

        message:
          canManageCatalog
            ? "Product was not found. You can add this scanned code as a new product."
            : "Product was not found.",
      };
    }


    const addResult =
      requestAddVariant(
        match.product,
        match.variant,
        match.batchId,
      );


    if (
      addResult ===
      "out"
    ) {
      return {
        accepted:
          false,

        label:
          `${match.product.name} · ${match.variant.name}`,

        message:
          "This unit is out of stock.",
      };
    }


    if (
      addResult ===
      "break"
    ) {
      return {
        accepted:
          false,

        label:
          `${match.product.name} · ${match.variant.name}`,

        message:
          "Loose stock is empty. Confirm Break & Add on the POS.",
      };
    }


    return {
      accepted:
        true,

      label:
        `${match.product.name} · ${match.variant.name}`,
    };
  }


  function handleLocalScan(
    value: string,
  ) {
    return processScan(
      value,
    ).accepted;
  }


  function handleRemoteScan(
    value: string,
  ) {
    return processScan(
      value,
    );
  }

  /* ==========================================================
     CHECKOUT

     Important mobile behavior:
     close the cart sheet first so the payment dialog
     doesn't stack on top of it.
  ========================================================== */

  function handleCheckout() {
    if (
      !business?.id ||
      cart.items.length ===
        0
    ) {
      return;
    }


    setMobileCartOpen(
      false,
    );


    setCheckoutOpen(
      true,
    );
  }


  async function handleSaleCompleted() {
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
                placeholder="Search products, SKU, barcode..."
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
              AppLayout scrolls the whole page.

              Desktop:
              catalog gets its own scrollbar.
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


                          <div className="absolute right-2 top-2 rounded-[8px] bg-background/90 px-2 py-1 text-right shadow-sm backdrop-blur-sm">

                            <div className="text-xs font-bold text-primary">

                              {formatMoney(
                                product
                                  .variants[0]
                                  .price,

                                currencyCode,
                              )}

                            </div>

                            {product.promotionEnabled &&
                              (
                                product
                                  .variants[0]
                                  .regularPrice ??
                                product
                                  .variants[0]
                                  .price
                              ) >
                                product
                                  .variants[0]
                                  .price && (

                              <div className="text-[10px] text-muted-foreground line-through">

                                {formatMoney(
                                  product
                                    .variants[0]
                                    .regularPrice ??
                                    product
                                      .variants[0]
                                      .price,

                                  currencyCode,
                                )}

                              </div>

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
                              getProductStockLabel(
                                product,
                              )
                            }

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

            Important:
            Sheet now ends ABOVE the fixed bottom navigation.
            The totals and CHARGE button are no longer hidden.
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
                  bottom-[calc(4rem+env(safe-area-inset-bottom))]
                  left-0
                  right-0
                  z-[60]
                  flex
                  h-[calc(100dvh-5rem)]
                  max-h-[85dvh]
                  flex-col
                  overflow-hidden
                  rounded-t-[32px]
                  bg-background
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


      <Dialog
        isOpen={
          Boolean(
            unknownScanValue,
          )
        }
        onClose={() =>
          setUnknownScanValue(
            null,
          )
        }
        title="Product Not Found"
        description="This scanned barcode or code is not assigned to a ARC product yet."
      >

        <div className="space-y-5">

          <div className="rounded-[16px] border bg-muted/20 p-4">

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scanned value
            </p>


            <p className="mt-2 break-all font-mono text-sm font-semibold">
              {unknownScanValue}
            </p>

          </div>


          <p className="text-sm leading-6 text-muted-foreground">
            Add a new product with this value pre-filled as its manufacturer barcode. ARC will keep its generated QR identity separately.
          </p>


          <div className="flex flex-wrap justify-end gap-2">

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUnknownScanValue(
                  null,
                );


                setScannerOpen(
                  true,
                );
              }}
            >
              Keep Scanning
            </Button>


            <Button
              type="button"
              onClick={() => {
                const value =
                  unknownScanValue;


                if (
                  !value
                ) {
                  return;
                }


                setUnknownScanValue(
                  null,
                );


                router.push(
                  `/products/new?barcode=${encodeURIComponent(
                    value,
                  )}`,
                );
              }}
            >
              Add New Product
            </Button>

          </div>

        </div>

      </Dialog>


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
                  !canAddVariant(
                    selectedProduct,
                    variant,
                  )
                }
                onClick={() => {
                  const result =
                    requestAddVariant(
                      selectedProduct,
                      variant,
                    );


                  if (
                    result ===
                    "added"
                  ) {
                    setSelectedProduct(
                      null,
                    );
                  }
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

                  <div>

                    <p className="font-bold text-primary">

                      {formatMoney(
                        variant.price,
                        currencyCode,
                      )}

                    </p>

                    {selectedProduct?.promotionEnabled &&
                      (
                        variant.regularPrice ??
                        variant.price
                      ) >
                        variant.price && (

                      <p className="mt-0.5 text-xs text-muted-foreground line-through">

                        {formatMoney(
                          variant.regularPrice ??
                          variant.price,
                          currencyCode,
                        )}

                      </p>

                    )}

                  </div>


                  <p className="mt-1 text-xs text-muted-foreground">

                    {
                      variant.stock
                    }{" "}

                    in stock

                    {variant.stock <=
                      0 &&
                      getBreakableParent(
                        selectedProduct,
                        variant,
                      ) && (
                        <span className="ml-1">
                          · can open {
                            getBreakableParent(
                              selectedProduct,
                              variant,
                            )?.name
                          }
                        </span>
                      )}

                  </p>

                </div>

              </button>

            ),
          )}

        </div>

      </Dialog>


      <Dialog
        isOpen={
          Boolean(
            unitBreakRequest,
          )
        }
        onClose={() =>
          !breakingUnit &&
          setUnitBreakRequest(
            null,
          )
        }
        title="Open sealed stock?"
        description={
          unitBreakRequest
            ? `No loose ${unitBreakRequest.variant.name} stock is available.`
            : undefined
        }
        className="max-w-lg"
      >

        {unitBreakRequest && (
          <div className="space-y-4">

            {unitBreakError && (
              <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {unitBreakError}
              </div>
            )}


            <div className="rounded-[20px] border bg-muted/20 p-4">

              <div className="flex items-start gap-3">

                <div className="rounded-[12px] border bg-background p-2">
                  <PackageOpen className="h-5 w-5" />
                </div>

                <div>
                  <p className="font-semibold">
                    {unitBreakRequest.product.name}
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Open 1 {
                      unitBreakRequest.product.variants.find(
                        (
                          variant,
                        ) =>
                          variant.id ===
                          unitBreakRequest.variant.unitParentVariantId,
                      )?.name ??
                      "parent unit"
                    } → {
                      unitBreakRequest.variant.unitsPerParent
                    } {
                      unitBreakRequest.variant.name
                    }
                  </p>
                </div>

              </div>


              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                ARC will move inventory from sealed stock to loose stock, inherit FIFO cost from the exact pack opened, then add 1 loose unit to this order.
              </p>

            </div>


            <div className="flex justify-end gap-2">

              <Button
                type="button"
                variant="outline"
                disabled={
                  breakingUnit
                }
                onClick={() =>
                  setUnitBreakRequest(
                    null,
                  )
                }
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={
                  breakingUnit
                }
                onClick={() =>
                  void handleBreakAndAdd()
                }
              >
                {breakingUnit
                  ? "Opening…"
                  : "Break & Add"}
              </Button>

            </div>

          </div>
        )}

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
  const [
    batchPickerItemId,
    setBatchPickerItemId,
  ] =
    React.useState<string | null>(
      null,
    );


  const batchPickerItem =
    cart.items.find(
      (item) =>
        item.id ===
        batchPickerItemId,
    ) ??
    null;


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
              ) => {
                const pricing =
                  priceVariantQuantity(
                    item.variant,
                    item.quantity,
                    item.batchId,
                  );

                const selectedBatch =
                  item.variant
                    .priceBatches
                    ?.find(
                      (batch) =>
                        batch.id ===
                        item.batchId,
                    );

                const selectedBatchIndex =
                  item.variant
                    .priceBatches
                    ?.findIndex(
                      (batch) =>
                        batch.id ===
                        item.batchId,
                    ) ??
                  -1;

                const batchCapacity =
                  selectedBatch
                    ?.quantity ??
                  item.variant
                    .stock;

                return (

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


                    <div className="mt-1">

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">

                        <p className="text-sm font-medium text-primary">
                          {formatMoney(
                            pricing.lines[0]
                              ?.price ??
                              item.variant
                                .price,
                            currencyCode,
                          )}{" "}
                          each
                        </p>


                        {item.quantity >
                          1 && (
                          <span className="text-[10px] text-muted-foreground">
                            · {formatMoney(
                              pricing.subtotal,
                              currencyCode,
                            )} total
                          </span>
                        )}

                      </div>


                      {selectedBatch && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {selectedBatchIndex ===
                          0
                            ? "Oldest stock"
                            : `Price batch #${selectedBatchIndex + 1}`}
                          {" · "}
                          {selectedBatch.quantity} unit{selectedBatch.quantity === 1 ? "" : "s"} available
                        </p>
                      )}


                      {(item.variant
                        .priceBatches
                        ?.length ??
                        0) >
                        1 && (
                        <button
                          type="button"
                          className="mt-1.5 text-[11px] font-semibold text-primary hover:underline"
                          onClick={() =>
                            setBatchPickerItemId(
                              item.id,
                            )
                          }
                        >
                          Change price batch
                        </button>
                      )}

                    </div>

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
                          batchCapacity
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

                );
              },
            )}

          </AnimatePresence>

        )}

      </div>


      {/* ======================================================
          TOTALS + CHECKOUT
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


      <Dialog
        isOpen={
          Boolean(
            batchPickerItem,
          )
        }
        onClose={() =>
          setBatchPickerItemId(
            null,
          )
        }
        title="Choose price batch"
        description={
          batchPickerItem
            ? `${batchPickerItem.product.name} · ${batchPickerItem.variant.name}`
            : undefined
        }
      >

        {batchPickerItem && (
          <div className="space-y-2">

            {batchPickerItem.variant.priceBatches?.map(
              (
                batch,
                index,
              ) => {
                const usedByOtherLine =
                  cart.items.reduce(
                    (
                      total,
                      item,
                    ) =>
                      item.id !==
                        batchPickerItem.id &&
                      item.variant.id ===
                        batchPickerItem.variant.id &&
                      item.batchId ===
                        batch.id
                        ? total +
                          item.quantity
                        : total,
                    0,
                  );

                const available =
                  Math.max(
                    0,
                    batch.quantity -
                      usedByOtherLine,
                  );

                const selected =
                  batch.id ===
                  batchPickerItem.batchId;

                const canUse =
                  selected ||
                  available >=
                    batchPickerItem.quantity;

                return (
                  <button
                    key={
                      batch.id
                    }
                    type="button"
                    disabled={
                      !canUse
                    }
                    onClick={() => {
                      cart.setItemBatch(
                        batchPickerItem.id,
                        batch.id,
                      );

                      setBatchPickerItemId(
                        null,
                      );
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 rounded-[16px] border p-4 text-left transition-colors",
                      selected
                        ? "border-primary bg-primary/5"
                        : "bg-background hover:border-primary/40 hover:bg-muted/40",
                      !canUse &&
                        "cursor-not-allowed opacity-45",
                    )}
                  >
                    <div>
                      <p className="font-semibold">
                        {index ===
                        0
                          ? "Oldest stock"
                          : `Price batch #${index + 1}`}
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {available} unit{available === 1 ? "" : "s"} available
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-primary">
                        {formatMoney(
                          batch.price,
                          currencyCode,
                        )}
                      </p>

                      <p className="mt-1 text-[10px] text-muted-foreground">
                        cost {formatMoney(
                          batch.cost,
                          currencyCode,
                        )}
                      </p>
                    </div>
                  </button>
                );
              },
            )}

          </div>
        )}

      </Dialog>

    </div>
  );
}