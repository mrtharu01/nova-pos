"use client";

import {
  useSearchParams,
} from "next/navigation";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ProductEditor,
} from "@/components/products/ProductEditor";


export default function NewProductPage() {
  const searchParams =
    useSearchParams();


  const initialBarcode =
    searchParams.get(
      "barcode",
    ) ??
    "";


  return (
    <AppLayout title="Add Product">

      <div className="mx-auto max-w-6xl">

        <ProductEditor
          initialBarcode={
            initialBarcode
          }
        />

      </div>

    </AppLayout>
  );
}
