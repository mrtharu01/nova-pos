"use client";

import {
  createClient,
} from "@/lib/supabase/client";

import type {
  ProductStatus,
  PromotionType,
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

  barcode?: string;

  price: number;

  cost: number;

  initialStock: number;

  lowStockThreshold: number;

  isActive: boolean;

  unitParentSku?: string;

  unitsPerParent?: number;
};


export type SaveProductInput = {
  id?: string;

  name: string;

  description: string;

  categoryId:
    | string
    | null;

  imagePath: string;

  status:
    ProductStatus;

  promotionEnabled:
    boolean;

  promotionType:
    PromotionType;

  promotionValue:
    number;

  promotionStartsAt?:
    | string
    | null;

  promotionEndsAt?:
    | string
    | null;

  multiUnitEnabled?:
    boolean;

  variants:
    ProductVariantInput[];
};


export type RemoveProductResult =
  | "deleted"
  | "archived";


export type ProductPromotionInput = {
  productId: string;

  enabled: boolean;

  type: PromotionType;

  value: number;

  startsAt?:
    | string
    | null;

  endsAt?:
    | string
    | null;
};


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

        barcode:
          variant.barcode
            ?.trim() ||
          null,

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

        unit_parent_sku:
          variant.unitParentSku
            ?.trim()
            .toUpperCase() ||
          null,

        units_per_parent:
          variant.unitParentSku
            ? Math.max(
                2,
                Math.trunc(
                  variant.unitsPerParent ??
                  2,
                ),
              )
            : null,
      }),
    );


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_product_with_promotion_v4",
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

        p_image_path:
          input.imagePath
            .trim(),

        p_status:
          toDbStatus(
            input.status,
          ),

        p_variants:
          payload,

        p_promotion_enabled:
          input.promotionEnabled,

        p_promotion_type:
          input.promotionType,

        p_promotion_value:
          Number(
            input.promotionValue,
          ),

        p_promotion_starts_at:
          input.promotionStartsAt ??
          null,

        p_promotion_ends_at:
          input.promotionEndsAt ??
          null,

        p_multi_unit_enabled:
          input.multiUnitEnabled ??
          false,
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


export async function setVariantBarcode(
  input: {
    variantId:
      string;

    barcode:
      string | null;
  },
): Promise<void> {
  const supabase =
    createClient();


  const {
    error,
  } =
    await supabase.rpc(
      "set_variant_barcode",
      {
        p_variant_id:
          input.variantId,

        p_barcode:
          input.barcode
            ?.trim() ||
          null,
      },
    );


  if (error) {
    throw error;
  }
}


/* ============================================================
   PRODUCT PROMOTION
============================================================ */

export async function setProductPromotion(
  input:
    ProductPromotionInput,
): Promise<void> {
  const supabase =
    createClient();


  const {
    error,
  } =
    await supabase.rpc(
      "set_product_promotion",
      {
        p_product_id:
          input.productId,

        p_enabled:
          input.enabled,

        p_type:
          input.type,

        p_value:
          Number(
            input.value,
          ),

        p_starts_at:
          input.startsAt ??
          null,

        p_ends_at:
          input.endsAt ??
          null,
      },
    );


  if (error) {
    throw error;
  }
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
      "ARC could not confirm how the product was removed.",
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


export async function receiveInventoryBatch(
  input: {
    variantId:
      string;

    locationId:
      string;

    quantity:
      number;

    unitCost?:
      number;

    sellingPrice?:
      number;

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
      "receive_inventory_batch",
      {
        p_variant_id:
          input.variantId,

        p_location_id:
          input.locationId,

        p_quantity:
          input.quantity,

        p_unit_cost:
          input.unitCost ??
          null,

        p_selling_price:
          input.sellingPrice ??
          null,

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


export type BreakInventoryUnitResult = {
  breakId: string;
  parentVariantId: string;
  parentVariantName: string;
  parentQuantity: number;
  childVariantId: string;
  childVariantName: string;
  childQuantity: number;
  unitsPerParent: number;
};


export async function breakInventoryUnit(
  input: {
    childVariantId:
      string;

    locationId:
      string;

    parentQuantity?:
      number;
  },
): Promise<BreakInventoryUnitResult> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "break_inventory_unit",
      {
        p_child_variant_id:
          input.childVariantId,

        p_location_id:
          input.locationId,

        p_parent_quantity:
          Math.max(
            1,
            Math.trunc(
              input.parentQuantity ??
              1,
            ),
          ),
      },
    );


  if (error) {
    throw error;
  }


  const row =
    (
      data as
        | Array<
            Record<
              string,
              unknown
            >
          >
        | null
    )?.[0];


  if (!row) {
    throw new Error(
      "ARC did not return a pack-break result.",
    );
  }


  return {
    breakId:
      String(
        row.break_id,
      ),

    parentVariantId:
      String(
        row.parent_variant_id,
      ),

    parentVariantName:
      String(
        row.parent_variant_name ??
        "Parent unit",
      ),

    parentQuantity:
      Number(
        row.parent_quantity ??
        0,
      ),

    childVariantId:
      String(
        row.child_variant_id,
      ),

    childVariantName:
      String(
        row.child_variant_name ??
        "Child unit",
      ),

    childQuantity:
      Number(
        row.child_quantity ??
        0,
      ),

    unitsPerParent:
      Number(
        row.units_per_parent ??
        0,
      ),
  };
}


export async function fetchDefaultInventoryLocation(
  businessId?: string,
): Promise<string> {
  const supabase =
    createClient();


  let query =
    supabase
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
      );


  if (
    businessId
  ) {
    query =
      query.eq(
        "business_id",
        businessId,
      );
  }


  const {
    data,
    error,
  } =
    await query
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


/* ============================================================
   BULK PRODUCT IMPORT
============================================================ */

export type BulkProductImportRow = {
  product_key?: string;

  product_name: string;

  category?: string;

  description?: string;

  variant_name?: string;

  sku?: string;

  barcode?: string;

  price: number;

  cost?: number;

  stock?: number;

  low_stock_threshold?: number;

  status?:
    | "active"
    | "draft";
};


export type BulkProductImportResult = {
  rowsImported: number;

  productsCreated: number;

  variantsCreated: number;

  categoriesCreated: number;
};


export async function bulkImportProducts(
  rows:
    BulkProductImportRow[],
): Promise<BulkProductImportResult> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "bulk_import_products",
      {
        p_rows:
          rows,
      },
    );


  if (error) {
    throw error;
  }


  if (
    !data ||
    typeof data !==
      "object"
  ) {
    throw new Error(
      "ARC did not return a valid bulk import result.",
    );
  }


  const result =
    data as Record<
      string,
      unknown
    >;


  return {
    rowsImported:
      Number(
        result.rowsImported ??
        0,
      ),

    productsCreated:
      Number(
        result.productsCreated ??
        0,
      ),

    variantsCreated:
      Number(
        result.variantsCreated ??
        0,
      ),

    categoriesCreated:
      Number(
        result.categoriesCreated ??
        0,
      ),
  };
}
