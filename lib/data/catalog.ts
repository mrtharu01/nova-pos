"use client";

import { createClient } from "@/lib/supabase/client";
import type { Product, ProductStatus } from "@/lib/domain/catalog";
import { getConfiguredBusinessId } from "@/lib/supabase/config";

type CatalogVariantRow = {
  business_id: string;
  product_id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  product_status: "active" | "draft" | "archived";
  category_id: string | null;
  category_name: string | null;
  variant_id: string;
  variant_name: string;
  sku: string;
  qr_token: string;
  price: number | string;
  cost: number | string;
  is_active: boolean;
  stock: number | null;
  low_stock_threshold: number | null;
};

function mapStatus(status: CatalogVariantRow["product_status"]): ProductStatus {
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";
  return "Active";
}

export async function fetchCatalogProducts(): Promise<Product[]> {
  const supabase = createClient();
  let query = supabase
    .from("catalog_variant_inventory")
    .select("*")
    .order("product_name", { ascending: true })
    .order("variant_name", { ascending: true });

  const businessId = getConfiguredBusinessId();
  if (businessId) query = query.eq("business_id", businessId);

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as CatalogVariantRow[];
  const products = new Map<string, Product>();

  for (const row of rows) {
    const existing = products.get(row.product_id);
    const variant = {
      id: row.variant_id,
      name: row.variant_name,
      sku: row.sku,
      price: Number(row.price),
      cost: Number(row.cost),
      stock: row.stock ?? 0,
      active: row.is_active,
      qrToken: row.qr_token,
      lowStockThreshold: row.low_stock_threshold ?? 5,
    };

    if (existing) {
      existing.variants.push(variant);
      continue;
    }

    products.set(row.product_id, {
      id: row.product_id,
      name: row.product_name,
      category: row.category_name ?? "Uncategorized",
      categoryId: row.category_id ?? undefined,
      description: row.description ?? "",
      image: row.image_url ?? "/placeholder-product.svg",
      status: mapStatus(row.product_status),
      variants: [variant],
    });
  }

  return Array.from(products.values());
}
