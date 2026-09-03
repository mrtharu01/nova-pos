"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { ProductEditor } from "@/components/products/ProductEditor";

export default function NewProductPage() {
  return (
    <AppLayout title="Add Product">
      <div className="mx-auto max-w-6xl">
        <ProductEditor />
      </div>
    </AppLayout>
  );
}
