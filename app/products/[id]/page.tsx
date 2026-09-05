"use client";

import * as React from "react";

import {
  Archive,
  Loader2,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ProductEditor,
} from "@/components/products/ProductEditor";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  useCatalog,
} from "@/hooks/use-catalog";

import {
  removeProduct,
  type RemoveProductResult,
} from "@/lib/data/catalog-admin";


/* ============================================================
   ERROR
============================================================ */

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof
    Error
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
          message?:
            unknown;
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
   PAGE
============================================================ */

export default function ProductDetailPage() {
  const params =
    useParams<{
      id: string;
    }>();


  const router =
    useRouter();


  const {
    products,
    loading,
    error,
  } =
    useCatalog();


  const product =
    products.find(
      (
        candidate,
      ) =>
        candidate.id ===
        params.id,
    );


  const [
    confirmOpen,
    setConfirmOpen,
  ] =
    React.useState(
      false,
    );


  const [
    removing,
    setRemoving,
  ] =
    React.useState(
      false,
    );


  const [
    removeError,
    setRemoveError,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const [
    removeResult,
    setRemoveResult,
  ] =
    React.useState<
      RemoveProductResult |
      null
    >(
      null,
    );


  /* ==========================================================
     DELETE / ARCHIVE
  ========================================================== */

  async function handleRemoveProduct() {
    if (
      !product ||
      removing
    ) {
      return;
    }


    setRemoving(
      true,
    );


    setRemoveError(
      null,
    );


    setRemoveResult(
      null,
    );


    try {
      const result =
        await removeProduct(
          product.id,
        );


      setRemoveResult(
        result,
      );


      window.setTimeout(
        () => {
          router.push(
            "/products",
          );


          router.refresh();
        },
        700,
      );
    } catch (
      cause
    ) {
      setRemoveError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setRemoving(
        false,
      );
    }
  }


  return (
    <AppLayout title="Edit Product">

      <div className="mx-auto max-w-6xl space-y-6">

        {/* ====================================================
            LOADING
        ===================================================== */}

        {loading && (

          <div className="rounded-[24px] border bg-card p-8 text-sm text-muted-foreground">
            Loading product…
          </div>

        )}


        {/* ====================================================
            LOAD ERROR
        ===================================================== */}

        {!loading &&
          error && (

          <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

            {error}

          </div>

        )}


        {/* ====================================================
            NOT FOUND
        ===================================================== */}

        {!loading &&
          !error &&
          !product && (

          <div className="rounded-[24px] border bg-card p-8 text-sm text-muted-foreground">
            Product not found.
          </div>

        )}


        {/* ====================================================
            EDITOR
        ===================================================== */}

        {!loading &&
          !error &&
          product && (

          <>

            <ProductEditor
              product={
                product
              }
            />


            {/* ================================================
                DANGER ZONE
            ================================================= */}

            <Card className="rounded-[24px] border-destructive/25">

              <CardHeader>

                <CardTitle className="text-destructive">
                  Remove product
                </CardTitle>


                <p className="text-sm leading-6 text-muted-foreground">

                  NOVA permanently deletes products only when they have no stock or transaction history.

                  Products that must remain for sales or inventory records are safely archived instead.

                </p>

              </CardHeader>


              <CardContent>

                <Button
                  type="button"
                  variant="outline"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    setRemoveError(
                      null,
                    );


                    setRemoveResult(
                      null,
                    );


                    setConfirmOpen(
                      true,
                    );
                  }}
                >

                  <Trash2 className="mr-2 h-4 w-4" />

                  Delete Product

                </Button>

              </CardContent>

            </Card>

          </>

        )}

      </div>


      {/* ======================================================
          DELETE CONFIRMATION
      ======================================================= */}

      <Dialog
        isOpen={
          confirmOpen
        }
        onClose={() => {
          if (
            !removing
          ) {
            setConfirmOpen(
              false,
            );
          }
        }}
        title="Delete this product?"
        description="NOVA will decide whether it can be permanently deleted safely or must be archived to preserve business history."
        className="max-w-lg"
      >

        <div className="space-y-4">

          {/* ==================================================
              HISTORY WARNING
          =================================================== */}

          <div className="flex items-start gap-3 rounded-[16px] border border-amber-500/25 bg-amber-500/5 p-4">

            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />


            <div>

              <p className="text-sm font-semibold">
                Historical data will never be destroyed.
              </p>


              <p className="mt-1 text-xs leading-5 text-muted-foreground">

                If this product has stock, inventory movements, or has appeared in a sale, NOVA will archive it instead.

                Archived products disappear from the POS but remain available in historical records.

              </p>

            </div>

          </div>


          {/* ==================================================
              ERROR
          =================================================== */}

          {removeError && (

            <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">

              {
                removeError
              }

            </div>

          )}


          {/* ==================================================
              RESULT
          =================================================== */}

          {removeResult && (

            <div className="flex items-start gap-3 rounded-[14px] border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">

              {removeResult ===
              "deleted" ? (

                <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />

              ) : (

                <Archive className="mt-0.5 h-4 w-4 shrink-0" />

              )}


              <span>

                {removeResult ===
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
                removing
              }
              onClick={() =>
                setConfirmOpen(
                  false,
                )
              }
            >

              Cancel

            </Button>


            <Button
              type="button"
              variant="destructive"
              disabled={
                removing ||
                Boolean(
                  removeResult,
                )
              }
              onClick={() =>
                void handleRemoveProduct()
              }
            >

              {removing ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : (

                <Trash2 className="mr-2 h-4 w-4" />

              )}


              {removing
                ? "Checking product…"
                : "Delete Product"}

            </Button>

          </div>

        </div>

      </Dialog>

    </AppLayout>
  );
}