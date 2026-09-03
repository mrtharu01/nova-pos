"use client";

import * as React from "react";

import {
  useRouter,
} from "next/navigation";


import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  Scanner,
} from "@/components/ui/scanner";

import {
  findVariantByScanValue,
} from "@/lib/domain/catalog";

import {
  useCatalog,
} from "@/hooks/use-catalog";

import {
  useCart,
} from "@/store/use-cart";



export default function ScanPage() {


  const router =
    useRouter();


  const cart =
    useCart();


  const {
    products,
  } =
    useCatalog();


  const [
    open,
    setOpen,
  ] =
    React.useState(
      true,
    );



  const handleScan =
    React.useCallback(

      (
        value: string,
      ) => {


        const match =
          findVariantByScanValue(

            products,

            value,

          );


        if (
          !match
        ) {

          return false;

        }


        if (
          match.variant.stock
          <=
          0
        ) {

          return false;

        }


        cart.addItem(

          match.product,

          match.variant,

        );


        return true;

      },

      [
        cart,
        products,
      ],

    );



  return (

    <AppLayout
      title="
        Scan Product
      "
      noPadding
    >

      <div
        className="
          flex
          h-full
          items-center
          justify-center
          p-6
          text-center
          text-muted-foreground
        "
      >

        Opening scanner…

      </div>


      <Scanner

        isOpen={
          open
        }

        onScan={
          handleScan
        }

        onClose={
          () => {

            setOpen(
              false,
            );

            router.replace(
              "/pos",
            );

          }
        }

      />

    </AppLayout>

  );

}