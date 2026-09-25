"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  Product,
  ProductStatus,
  PromotionType,
} from "@/lib/domain/catalog";

type CatalogVariantRow = {
  business_id: string;
  product_id: string;
  product_name: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  product_status: "active" | "draft" | "archived";
  category_id: string | null;
  category_name: string | null;
  variant_id: string;
  variant_name: string;
  sku: string;
  qr_token: string;
  barcode: string | null;
  price: number | string;
  regular_price: number | string;
  cost: number | string;
  is_active: boolean;
  stock: number | null;
  low_stock_threshold: number | null;
  promotion_enabled: boolean;
  promotion_active: boolean;
  promotion_type: PromotionType;
  promotion_value: number | string;
  promotion_starts_at: string | null;
  promotion_ends_at: string | null;
};

function mapStatus(status: CatalogVariantRow["product_status"]): ProductStatus {
  if (status === "draft") return "Draft";
  if (status === "archived") return "Archived";
  return "Active";
}

export async function fetchCatalogProducts(): Promise<Product[]> {
  const supabase = createClient();

  const {
    data: currentBusinesses,
    error: businessError,
  } = await supabase.rpc(
    "get_my_current_business",
  );

  if (businessError) throw businessError;

  const businessId =
    currentBusinesses?.[0]?.id;

  if (!businessId) return [];

  const { data, error } = await supabase
    .from("catalog_variant_inventory")
    .select("*")
    .eq("business_id", businessId)
    .order("product_name", { ascending: true })
    .order("variant_name", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as CatalogVariantRow[];

  const imagePaths =
    Array.from(
      new Set(
        rows
          .map(
            (row) =>
              row.image_path,
          )
          .filter(
            (
              path,
            ): path is string =>
              Boolean(path),
          ),
      ),
    );

  const signedImages =
    new Map<string, string>();

  await Promise.all(
    imagePaths.map(
      async (
        path,
      ) => {
        const {
          data:
            signedData,
          error:
            signedError,
        } =
          await supabase.storage
            .from(
              "product-images",
            )
            .createSignedUrl(
              path,
              60 * 60 * 8,
            );

        if (
          !signedError &&
          signedData?.signedUrl
        ) {
          signedImages.set(
            path,
            signedData.signedUrl,
          );
        }
      },
    ),
  );

  const products = new Map<string, Product>();

  for (const row of rows) {
    const existing = products.get(row.product_id);
    const variant = {
      id: row.variant_id,
      name: row.variant_name,
      sku: row.sku,
      price: Number(row.price),
      regularPrice: Number(row.regular_price),
      cost: Number(row.cost),
      stock: row.stock ?? 0,
      active: row.is_active,
      qrToken: row.qr_token,
      barcode: row.barcode ?? undefined,
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
      image:
        (
          row.image_path
            ? signedImages.get(
                row.image_path,
              )
            : null
        ) ??
        row.image_url ??
        "/placeholder-product.svg",
      imagePath:
        row.image_path ??
        undefined,
      status: mapStatus(row.product_status),
      promotionEnabled: row.promotion_enabled,
      promotionActive: row.promotion_active,
      promotionType: row.promotion_type,
      promotionValue: Number(row.promotion_value),
      promotionStartsAt: row.promotion_starts_at ?? undefined,
      promotionEndsAt: row.promotion_ends_at ?? undefined,
      variants: [variant],
    });
  }

  return Array.from(products.values());
}
