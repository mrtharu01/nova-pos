"use client";

import * as React from "react";

import Link from "next/link";

import {
  Archive,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  removeProduct,
  type RemoveProductResult,
} from "@/lib/data/catalog-admin";

import {
  formatMoney,
  type Product,
} from "@/lib/domain/catalog";

import {
  useCatalog,
} from "@/hooks/use-catalog";


/* ============================================================
   ERROR
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
    typeof error === "object" &&
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


  return "Unable to remove this product.";
}


/* ============================================================
   PRODUCTS PAGE
============================================================ */

export default function ProductsPage() {
  const [
    search,
    setSearch,
  ] =
    React.useState("");


  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    React.useState<
      Product | null
    >(null);


  const [
    deleting,
    setDeleting,
  ] =
    React.useState(false);


  const [
    deleteError,
    setDeleteError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    deleteResult,
    setDeleteResult,
  ] =
    React.useState<
      RemoveProductResult | null
    >(null);


  const {
    products,
    loading,
    error,
    refresh,
  } =
    useCatalog();


  /* ==========================================================
     FILTER
  ========================================================== */

  const filtered =
    React.useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();


        if (!term) {
          return products;
        }


        return products.filter(
          (product) =>
            product.name
              .toLowerCase()
              .includes(
                term,
              )
            ||
            product.category
              .toLowerCase()
              .includes(
                term,
              )
            ||
            product.variants.some(
              (variant) =>
                variant.sku
                  .toLowerCase()
                  .includes(
                    term,
                  ),
            ),
        );
      },
      [
        products,
        search,
      ],
    );


  /* ==========================================================
     OPEN DELETE
  ========================================================== */

  function openDelete(
    product: Product,
  ) {
    setDeleteTarget(
      product,
    );


    setDeleteError(
      null,
    );


    setDeleteResult(
      null,
    );
  }


  /* ==========================================================
     CLOSE DELETE
  ========================================================== */

  function closeDelete() {
    if (deleting) {
      return;
    }


    setDeleteTarget(
      null,
    );


    setDeleteError(
      null,
    );


    setDeleteResult(
      null,
    );
  }


  /* ==========================================================
     REMOVE PRODUCT
  ========================================================== */

  async function handleDelete() {
    if (
      !deleteTarget ||
      deleting
    ) {
      return;
    }


    setDeleting(
      true,
    );


    setDeleteError(
      null,
    );


    setDeleteResult(
      null,
    );


    try {
      const result =
        await removeProduct(
          deleteTarget.id,
        );


      setDeleteResult(
        result,
      );


      /*
       * Refresh immediately so an archived/deleted
       * product disappears from the current list.
       */

      await refresh();


      window.setTimeout(
        () => {
          setDeleteTarget(
            null,
          );


          setDeleteResult(
            null,
          );
        },
        900,
      );
    } catch (
      cause
    ) {
      setDeleteError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setDeleting(
        false,
      );
    }
  }


  return (
    <AppLayout title="Products">

      {/* ======================================================
          TOP BAR
      ======================================================= */}

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row">

        <div className="relative max-w-md flex-1">

          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />


          <Input
            placeholder="Search product, category or SKU…"
            className="bg-card pl-9"
            value={
              search
            }
            onChange={(
              event,
            ) =>
              setSearch(
                event.target.value,
              )
            }
          />

        </div>


        <Button asChild>

          <Link href="/products/new">

            <Plus className="mr-2 h-4 w-4" />

            Add Product

          </Link>

        </Button>

      </div>


      {/* ======================================================
          LOAD ERROR
      ======================================================= */}

      {error && (

        <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

          Products could not be loaded:{" "}

          {
            error
          }

        </div>

      )}


      {/* ======================================================
          TABLE
      ======================================================= */}

      <Card className="overflow-hidden rounded-[24px]">

        <CardContent className="p-0">

          <div className="overflow-x-auto">

            <Table>

              <TableHeader className="bg-muted/50">

                <TableRow>

                  <TableHead className="w-[80px]">
                    Image
                  </TableHead>

                  <TableHead>
                    Name
                  </TableHead>

                  <TableHead>
                    Category
                  </TableHead>

                  <TableHead>
                    Price
                  </TableHead>

                  <TableHead>
                    Stock
                  </TableHead>

                  <TableHead>
                    Status
                  </TableHead>

                  <TableHead className="w-[120px] text-right">
                    Actions
                  </TableHead>

                </TableRow>

              </TableHeader>


              <TableBody>

                {/* ============================================
                    LOADING
                ============================================= */}

                {loading && (

                  <TableRow>

                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      Loading products…
                    </TableCell>

                  </TableRow>

                )}


                {/* ============================================
                    PRODUCTS
                ============================================= */}

                {!loading &&
                  filtered.map(
                    (product) => {
                      const totalStock =
                        product.variants.reduce(
                          (
                            sum,
                            variant,
                          ) =>
                            sum +
                            variant.stock,
                          0,
                        );


                      const startingPrice =
                        product.variants.length >
                        0
                          ? Math.min(
                              ...product.variants.map(
                                (variant) =>
                                  variant.price,
                              ),
                            )
                          : 0;


                      return (
                        <TableRow
                          key={
                            product.id
                          }
                          className="hover:bg-muted/30"
                        >

                          {/* ==================================
                              IMAGE
                          =================================== */}

                          <TableCell>

                            <div className="h-10 w-10 overflow-hidden rounded-[10px] border bg-muted">

                              <img
                                src={
                                  product.image
                                }
                                alt={
                                  product.name
                                }
                                className="h-full w-full object-cover"
                              />

                            </div>

                          </TableCell>


                          {/* ==================================
                              NAME
                          =================================== */}

                          <TableCell>

                            <p className="font-medium">
                              {
                                product.name
                              }
                            </p>


                            <p className="text-xs text-muted-foreground">

                              {
                                product.variants.length
                              }{" "}

                              variant(s)

                            </p>

                          </TableCell>


                          {/* ==================================
                              CATEGORY
                          =================================== */}

                          <TableCell>
                            {
                              product.category
                            }
                          </TableCell>


                          {/* ==================================
                              PRICE
                          =================================== */}

                          <TableCell>

                            {formatMoney(
                              startingPrice,
                            )}

                          </TableCell>


                          {/* ==================================
                              STOCK
                          =================================== */}

                          <TableCell>

                            <span
                              className={
                                totalStock <=
                                5
                                  ? "font-medium text-destructive"
                                  : ""
                              }
                            >
                              {
                                totalStock
                              }
                            </span>

                          </TableCell>


                          {/* ==================================
                              STATUS
                          =================================== */}

                          <TableCell>

                            <Badge
                              variant={
                                product.status ===
                                "Active"
                                  ? "success"
                                  : product.status ===
                                      "Archived"
                                    ? "secondary"
                                    : "warning"
                              }
                            >
                              {
                                product.status
                              }
                            </Badge>

                          </TableCell>


                          {/* ==================================
                              ACTIONS
                          =================================== */}

                          <TableCell className="text-right">

                            <div className="flex items-center justify-end gap-1">

                              {/* EDIT */}

                              <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                aria-label={`Edit ${product.name}`}
                              >

                                <Link
                                  href={`/products/${product.id}`}
                                >

                                  <Pencil className="h-4 w-4" />

                                </Link>

                              </Button>


                              {/* DELETE */}

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                aria-label={`Delete ${product.name}`}
                                onClick={() =>
                                  openDelete(
                                    product,
                                  )
                                }
                              >

                                <Trash2 className="h-4 w-4" />

                              </Button>

                            </div>

                          </TableCell>

                        </TableRow>
                      );
                    },
                  )}


                {/* ============================================
                    EMPTY
                ============================================= */}

                {!loading &&
                  filtered.length ===
                    0 && (

                  <TableRow>

                    <TableCell
                      colSpan={7}
                      className="h-40 text-center"
                    >

                      <div className="mx-auto max-w-sm text-muted-foreground">

                        <p className="font-medium text-foreground">
                          No products found
                        </p>


                        <p className="mt-1 text-sm">

                          Add your first real product to start using NOVA inventory and QR scanning.

                        </p>


                        <Button
                          asChild
                          className="mt-4"
                        >

                          <Link href="/products/new">

                            <Plus className="mr-2 h-4 w-4" />

                            Add Product

                          </Link>

                        </Button>

                      </div>

                    </TableCell>

                  </TableRow>

                )}

              </TableBody>

            </Table>

          </div>

        </CardContent>

      </Card>


      {/* ======================================================
          DELETE CONFIRMATION
      ======================================================= */}

      <Dialog
        isOpen={
          Boolean(
            deleteTarget,
          )
        }
        onClose={
          closeDelete
        }
        title="Delete product?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from NOVA.`
            : "Remove product."
        }
        className="max-w-lg"
      >

        <div className="space-y-4">

          {/* ==================================================
              WARNING
          =================================================== */}

          <div className="flex items-start gap-3 rounded-[16px] border border-amber-500/25 bg-amber-500/5 p-4">

            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />


            <div>

              <p className="text-sm font-semibold">
                Historical data will be preserved.
              </p>


              <p className="mt-1 text-xs leading-5 text-muted-foreground">

                If this product has stock, inventory history, or previous sales, NOVA will archive it instead of destroying historical records.

              </p>

            </div>

          </div>


          {/* ==================================================
              PRODUCT SUMMARY
          =================================================== */}

          {deleteTarget && (

            <div className="rounded-[16px] border bg-muted/20 p-4">

              <p className="font-semibold">
                {
                  deleteTarget.name
                }
              </p>


              <p className="mt-1 text-xs text-muted-foreground">

                {
                  deleteTarget.variants.length
                }{" "}

                variant(s)

              </p>

            </div>

          )}


          {/* ==================================================
              ERROR
          =================================================== */}

          {deleteError && (

            <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">

              {
                deleteError
              }

            </div>

          )}


          {/* ==================================================
              SUCCESS
          =================================================== */}

          {deleteResult && (

            <div className="flex items-start gap-3 rounded-[14px] border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">

              {deleteResult ===
              "deleted" ? (

                <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />

              ) : (

                <Archive className="mt-0.5 h-4 w-4 shrink-0" />

              )}


              <span>

                {deleteResult ===
                "deleted"
                  ? "Product permanently deleted."
                  : "Product has business history, so NOVA archived it safely."}

              </span>

            </div>

          )}


          {/* ==================================================
              ACTIONS
          =================================================== */}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">

            <Button
              type="button"
              variant="outline"
              disabled={
                deleting
              }
              onClick={
                closeDelete
              }
            >
              Cancel
            </Button>


            <Button
              type="button"
              variant="destructive"
              disabled={
                deleting ||
                Boolean(
                  deleteResult,
                )
              }
              onClick={() =>
                void handleDelete()
              }
            >

              {deleting ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : (

                <Trash2 className="mr-2 h-4 w-4" />

              )}


              {deleting
                ? "Checking…"
                : "Delete Product"}

            </Button>

          </div>

        </div>

      </Dialog>

    </AppLayout>
  );
}