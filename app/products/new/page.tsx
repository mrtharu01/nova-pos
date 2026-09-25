import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ProductEditor,
} from "@/components/products/ProductEditor";


export default async function NewProductPage({
  searchParams,
}: {
  searchParams:
    Promise<{
      barcode?:
        string |
        string[];
    }>;
}) {
  const resolved =
    await searchParams;


  const rawBarcode =
    resolved.barcode;


  const initialBarcode =
    Array.isArray(
      rawBarcode,
    )
      ? rawBarcode[0] ??
        ""
      : rawBarcode ??
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
