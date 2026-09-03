"use client";

import * as React from "react";

import {
  Printer,
  Search,
  SquareCheckBig,
} from "lucide-react";


import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {

  ProductQrCard,

  qrSvgElementId,

} from "@/components/qr/ProductQrCard";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";

import {
  useCatalog,
} from "@/hooks/use-catalog";



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



export default function QRCodePage() {


  const {

    products,

    loading,

    error,

  } =
    useCatalog();


  const [
    search,
    setSearch,
  ] =
    React.useState(
      "",
    );


  const [
    selected,
    setSelected,
  ] =
    React.useState<Set<string>>(
      new Set(),
    );



  const allItems =
    React.useMemo(

      () =>

        products.flatMap(

          (
            product,
          ) =>

            product.variants

              .filter(

                (
                  variant,
                ) =>
                  Boolean(
                    variant.qrToken,
                  ),

              )

              .map(

                (
                  variant,
                ) => ({

                  product,

                  variant,

                }),

              ),

        ),

      [
        products,
      ],

    );



  const visibleItems =
    React.useMemo(

      () => {


        const term =
          search
            .trim()
            .toLowerCase();


        if (
          !term
        ) {

          return allItems;

        }


        return allItems.filter(

          ({
            product,
            variant,
          }) =>

            product.name
              .toLowerCase()
              .includes(
                term,
              )

            ||

            variant.name
              .toLowerCase()
              .includes(
                term,
              )

            ||

            variant.sku
              .toLowerCase()
              .includes(
                term,
              )

            ||

            variant.qrToken
              ?.toLowerCase()
              .includes(
                term,
              ),

        );

      },

      [
        allItems,
        search,
      ],

    );



  const visibleIds =
    React.useMemo(

      () =>
        visibleItems.map(

          ({
            variant,
          }) =>
            variant.id,

        ),

      [
        visibleItems,
      ],

    );



  const allVisibleSelected =

    visibleIds.length > 0

    &&

    visibleIds.every(

      (
        id,
      ) =>
        selected.has(
          id,
        ),

    );



  function toggleSelected(

    id: string,

    checked: boolean,

  ) {

    setSelected(

      (
        current,
      ) => {


        const next =
          new Set(
            current,
          );


        if (
          checked
        ) {

          next.add(
            id,
          );

        }

        else {

          next.delete(
            id,
          );

        }


        return next;

      },

    );

  }



  function toggleAllVisible() {

    setSelected(

      (
        current,
      ) => {


        const next =
          new Set(
            current,
          );


        if (
          allVisibleSelected
        ) {

          visibleIds.forEach(

            (
              id,
            ) =>
              next.delete(
                id,
              ),

          );

        }

        else {

          visibleIds.forEach(

            (
              id,
            ) =>
              next.add(
                id,
              ),

          );

        }


        return next;

      },

    );

  }



  function bulkPrint() {


    const items =
      visibleItems.filter(

        ({
          variant,
        }) =>
          selected.has(
            variant.id,
          ),

      );


    if (
      items.length
      ===
      0
    ) {

      return;

    }


    const labels =
      items

        .map(

          ({
            product,
            variant,
          }) => {


            const svg =
              document.getElementById(

                qrSvgElementId(
                  variant.id,
                ),

              );


            if (
              !svg
            ) {

              return "";

            }


            return `

              <div class="label">

                <div class="qr">
                  ${svg.outerHTML}
                </div>

                <div class="name">
                  ${escapeHtml(product.name)}
                </div>

                <div class="variant">
                  ${escapeHtml(variant.name)}
                </div>

                <div class="sku">
                  ${escapeHtml(variant.sku)}
                </div>

              </div>

            `;

          },

        )

        .filter(
          Boolean,
        )

        .join(
          "",
        );


    if (
      !labels
    ) {

      return;

    }


    const printWindow =
      window.open(

        "",

        "_blank",

        "width=900,height=700",

      );


    if (
      !printWindow
    ) {

      return;

    }


    printWindow.document.write(`
      <!doctype html>

      <html>

        <head>

          <meta charset="utf-8" />

          <title>
            NOVA QR Labels
          </title>

          <style>

            @page {
              margin: 6mm;
            }

            * {
              box-sizing: border-box;
            }

            body {

              margin: 0;

              font-family:
                Arial,
                Helvetica,
                sans-serif;

              color: #000;

              background: #fff;

              display: grid;

              grid-template-columns:
                repeat(
                  auto-fill,
                  50mm
                );

              gap: 4mm;

              align-items:
                start;

            }

            .label {

              width: 50mm;

              min-height: 40mm;

              padding: 3mm;

              border:
                1px
                dashed
                #bbb;

              text-align:
                center;

              break-inside:
                avoid;

            }

            .qr {
              display: flex;
              justify-content: center;
            }

            .qr svg {
              width: 25mm;
              height: 25mm;
            }

            .name {

              margin-top: 1.5mm;

              font-size: 9pt;

              font-weight: 700;

              line-height: 1.1;

            }

            .variant {

              margin-top: .6mm;

              font-size: 7pt;

              color: #444;

            }

            .sku {

              margin-top: 1mm;

              font:
                700
                7pt
                monospace;

            }

          </style>

        </head>

        <body>

          ${labels}

        </body>

      </html>
    `);


    printWindow.document.close();

    printWindow.focus();


    window.setTimeout(

      () =>
        printWindow.print(),

      200,

    );

  }



  return (

    <AppLayout
      title="
        QR Codes
      "
    >

      <div
        className="
          mb-6
          flex
          flex-col
          gap-4
          xl:flex-row
          xl:items-center
          xl:justify-between
        "
      >

        <div>

          <h2
            className="
              text-lg
              font-semibold
            "
          >

            Permanent product labels

          </h2>


          <p
            className="
              mt-1
              text-sm
              text-muted-foreground
            "
          >

            Every saved variant
            has one permanent NOVA
            QR identity.

            Price and stock are
            never encoded inside
            the QR.

          </p>

        </div>


        <div
          className="
            flex
            flex-wrap
            gap-2
          "
        >

          <Button

            type="button"

            variant="outline"

            className="
              rounded-[14px]
            "

            onClick={
              toggleAllVisible
            }

            disabled={
              visibleIds.length
              ===
              0
            }

          >

            <SquareCheckBig
              className="
                mr-2
                h-4
                w-4
              "
            />


            {
              allVisibleSelected

              ?

              "Clear visible"

              :

              "Select visible"
            }

          </Button>


          <Button

            type="button"

            className="
              rounded-[14px]
            "

            onClick={
              bulkPrint
            }

            disabled={
              selected.size
              ===
              0
            }

          >

            <Printer
              className="
                mr-2
                h-4
                w-4
              "
            />

            Print selected ({
              selected.size
            })

          </Button>

        </div>

      </div>


      <div
        className="
          relative
          mb-5
          max-w-xl
        "
      >

        <Search
          className="
            absolute
            left-3
            top-3.5
            h-4
            w-4
            text-muted-foreground
          "
        />


        <Input

          value={
            search
          }

          onChange={
            (
              event,
            ) =>
              setSearch(
                event.target.value,
              )
          }

          placeholder="
            Search product, variant, SKU, or QR token…
          "

          className="
            h-11
            bg-card
            pl-9
          "

        />

      </div>


      {
        error
        &&
        (

          <div
            className="
              mb-4
              rounded-[16px]
              border
              border-destructive/30
              bg-destructive/5
              p-4
              text-sm
              text-destructive
            "
          >

            QR catalog could
            not be loaded:
            {" "}
            {error}

          </div>

        )
      }


      {
        loading

        ?

        (

          <div
            className="
              py-20
              text-center
              text-muted-foreground
            "
          >

            Loading QR identities…

          </div>

        )

        :

        visibleItems.length > 0

        ?

        (

          <div
            className="
              grid
              grid-cols-1
              gap-4
              sm:grid-cols-2
              xl:grid-cols-3
              2xl:grid-cols-4
            "
          >

            {
              visibleItems.map(

                ({
                  product,
                  variant,
                }) => (

                  <ProductQrCard

                    key={
                      variant.id
                    }

                    variantId={
                      variant.id
                    }

                    productName={
                      product.name
                    }

                    variantName={
                      variant.name
                    }

                    sku={
                      variant.sku
                    }

                    qrToken={
                      variant.qrToken!
                    }

                    selected={
                      selected.has(
                        variant.id,
                      )
                    }

                    onSelectedChange={
                      (
                        checked,
                      ) =>
                        toggleSelected(
                          variant.id,
                          checked,
                        )
                    }

                  />

                ),

              )
            }

          </div>

        )

        :

        (

          <div
            className="
              rounded-[24px]
              border
              bg-card
              px-6
              py-16
              text-center
            "
          >

            <p
              className="
                font-semibold
              "
            >

              No QR labels found

            </p>

            <p
              className="
                mt-1
                text-sm
                text-muted-foreground
              "
            >

              Saved product variants
              automatically receive
              a QR identity.

            </p>

          </div>

        )
      }

    </AppLayout>

  );

}
