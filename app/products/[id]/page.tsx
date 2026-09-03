"use client";

import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProductEditor } from "@/components/products/ProductEditor";
import { useCatalog } from "@/hooks/use-catalog";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const { products, loading, error } = useCatalog();
  const product = products.find((candidate) => candidate.id === params.id);

  return (
    <AppLayout title="Edit Product">
      <div className="mx-auto max-w-6xl">
        {loading && <div className="rounded-[24px] border bg-card p-8 text-sm text-muted-foreground">Loading product…</div>}
        {!loading && error && <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
        {!loading && !error && !product && <div className="rounded-[24px] border bg-card p-8 text-sm text-muted-foreground">Product not found.</div>}
        {!loading && !error && product && <ProductEditor product={product} />}
      </div>
    </AppLayout>
  );
}
