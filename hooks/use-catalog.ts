"use client";

import * as React from "react";
import { fetchCatalogProducts } from "@/lib/data/catalog";
import type { Product } from "@/lib/domain/catalog";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { isDemoMode, isSupabaseConfigured } from "@/lib/supabase/config";

export type CatalogSource = "demo" | "supabase";

export function useCatalog() {
  const demo = isDemoMode() || !isSupabaseConfigured();
  const [products, setProducts] = React.useState<Product[]>(demo ? MOCK_PRODUCTS : []);
  const [loading, setLoading] = React.useState(!demo);
  const [error, setError] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<CatalogSource>(demo ? "demo" : "supabase");

  const refresh = React.useCallback(async () => {
    if (demo) {
      setProducts(MOCK_PRODUCTS);
      setSource("demo");
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextProducts = await fetchCatalogProducts();
      setProducts(nextProducts);
      setSource("supabase");
    } catch (cause) {
      setProducts([]);
      setSource("supabase");
      setError(cause instanceof Error ? cause.message : "Unable to load catalog data.");
    } finally {
      setLoading(false);
    }
  }, [demo]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { products, loading, error, source, refresh };
}
