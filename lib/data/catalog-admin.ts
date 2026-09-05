"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  ProductStatus,
} from "@/lib/domain/catalog";


export type CategoryRecord = {
  id: string;

  name: string;

  slug: string;
};


export type ProductVariantInput = {
  id?: string;

  name: string;

  sku: string;

  price: number;

  cost: number;

  initialStock: number;

  lowStockThreshold: number;

  isActive: boolean;
};


export type SaveProductInput = {
  id?: string;

  name: string;

  description: string;

  categoryId:
    | string
    | null;

  imageUrl: string;

  status:
    ProductStatus;

  variants:
    ProductVariantInput[];
};


export type RemoveProductResult =
  | "deleted"
  | "archived";


export type InventoryMovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "damage"
  | "loss"
  | "return";


export type InventoryMovementRecord = {
  id: string;

  productName: string;

  variantName: string;

  sku: string;

  locationName: string;

  movementType: string;

  quantityDelta: number;

  quantityBefore: number;

  quantityAfter: number;

  reason: string;

  note: string;

  createdAt: string;
};


function toDbStatus(
  status:
    ProductStatus,
) {
  return status
    .toLowerCase() as
    | "active"
    | "draft"
    | "archived";
}


/* ============================================================
   CATEGORIES
============================================================ */

export async function fetchCategories(): Promise<
  CategoryRecord[]
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "categories",
      )
      .select(
        "id,name,slug",
      )
      .eq(
        "is_active",
        true,
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        },
      )
      .order(
        "name",
        {
          ascending:
            true,
        },
      );


  if (error) {
    throw error;
  }


  return (
    data ??
    []
  ) as CategoryRecord[];
}


export async function createCategory(
  name: string,
): Promise<string> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "create_category",
      {
        p_name:
          name.trim(),
      },
    );


  if (error) {
    throw error;
  }


  if (!data) {
    throw new Error(
      "Category was created but no ID was returned.",
    );
  }


  return String(
    data,
  );
}


/* ============================================================
   SAVE PRODUCT
============================================================ */

export async function saveProduct(
  input:
    SaveProductInput,
): Promise<string> {
  const supabase =
    createClient();


  const payload =
    input.variants.map(
      (
        variant,
      ) => ({
        id:
          variant.id ??
          null,

        name:
          variant.name
            .trim(),

        sku:
          variant.sku
            .trim()
            .toUpperCase(),

        price:
          Number(
            variant.price,
          ),

        cost:
          Number(
            variant.cost,
          ),

        initial_stock:
          Math.max(
            0,
            Math.trunc(
              variant.initialStock,
            ),
          ),

        low_stock_threshold:
          Math.max(
            0,
            Math.trunc(
              variant.lowStockThreshold,
            ),
          ),

        is_active:
          variant.isActive,
      }),
    );


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_product",
      {
        p_product_id:
          input.id ??
          null,

        p_name:
          input.name
            .trim(),

        p_description:
          input.description
            .trim(),

        p_category_id:
          input.categoryId,

        p_image_url:
          input.imageUrl
            .trim(),

        p_status:
          toDbStatus(
            input.status,
          ),

        p_variants:
          payload,
      },
    );


  if (error) {
    throw error;
  }


  if (!data) {
    throw new Error(
      "Product was saved but no product ID was returned.",
    );
  }


  return String(
    data,
  );
}


/* ============================================================
   SAFE PRODUCT REMOVAL

   Database decides:

   deleted
     → safe permanent delete

   archived
     → product has stock/history and must be preserved
============================================================ */

export async function removeProduct(
  productId: string,
): Promise<RemoveProductResult> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "remove_product",
      {
        p_product_id:
          productId,
      },
    );


  if (error) {
    throw error;
  }


  if (
    data !==
      "deleted" &&
    data !==
      "archived"
  ) {
    throw new Error(
      "NOVA could not confirm how the product was removed.",
    );
  }


  return data;
}


/* ============================================================
   INVENTORY
============================================================ */

export async function adjustInventory(
  input: {
    variantId:
      string;

    locationId:
      string;

    delta:
      number;

    movementType:
      InventoryMovementType;

    reason:
      string;

    note:
      string;
  },
) {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "adjust_inventory",
      {
        p_variant_id:
          input.variantId,

        p_location_id:
          input.locationId,

        p_delta:
          input.delta,

        p_movement_type:
          input.movementType,

        p_reason:
          input.reason
            .trim(),

        p_note:
          input.note
            .trim(),
      },
    );


  if (error) {
    throw error;
  }


  return data;
}


export async function fetchDefaultInventoryLocation(): Promise<string> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "inventory_locations",
      )
      .select(
        "id",
      )
      .eq(
        "is_default",
        true,
      )
      .eq(
        "is_active",
        true,
      )
      .limit(
        1,
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  if (
    !data?.id
  ) {
    throw new Error(
      "Default inventory location was not found.",
    );
  }


  return String(
    data.id,
  );
}


export async function fetchInventoryMovements(
  limit =
    250,
): Promise<
  InventoryMovementRecord[]
> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "inventory_movement_details",
      )
      .select(
        "*",
      )
      .order(
        "created_at",
        {
          ascending:
            false,
        },
      )
      .limit(
        limit,
      );


  if (error) {
    throw error;
  }


  return (
    (
      data ??
      []
    ) as Array<
      Record<
        string,
        unknown
      >
    >
  ).map(
    (
      row,
    ) => ({
      id:
        String(
          row.id,
        ),

      productName:
        String(
          row.product_name ??
          "Unknown product",
        ),

      variantName:
        String(
          row.variant_name ??
          "Standard",
        ),

      sku:
        String(
          row.sku ??
          "",
        ),

      locationName:
        String(
          row.location_name ??
          "Main",
        ),

      movementType:
        String(
          row.movement_type ??
          "adjustment",
        ),

      quantityDelta:
        Number(
          row.quantity_delta ??
          0,
        ),

      quantityBefore:
        Number(
          row.quantity_before ??
          0,
        ),

      quantityAfter:
        Number(
          row.quantity_after ??
          0,
        ),

      reason:
        String(
          row.reason ??
          "",
        ),

      note:
        String(
          row.note ??
          "",
        ),

      createdAt:
        String(
          row.created_at ??
          "",
        ),
    }),
  );
}