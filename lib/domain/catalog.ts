export type ProductStatus =
  | "Active"
  | "Draft"
  | "Archived";


export type Category =
  string;


export type PromotionType =
  | "percentage"
  | "fixed";


export type ProductPriceBatch = {
  id: string;

  quantity: number;

  price: number;

  regularPrice: number;

  cost: number;
};


export type ProductVariant = {

  id: string;

  name: string;

  sku: string;

  price: number;

  regularPrice?: number;

  cost: number;

  defaultPrice?: number;

  defaultCost?: number;

  priceBatches?: ProductPriceBatch[];

  stock: number;

  active?: boolean;

  qrToken?: string;

  barcode?: string;

  lowStockThreshold?: number;

};


export type Product = {

  id: string;

  name: string;

  category: Category;

  categoryId?: string;

  description: string;

  image: string;

  imagePath?: string;

  variants: ProductVariant[];

  status: ProductStatus;

  promotionEnabled?: boolean;

  promotionActive?: boolean;

  promotionType?: PromotionType;

  promotionValue?: number;

  promotionStartsAt?: string;

  promotionEndsAt?: string;

};


export type InventoryItem = {

  productId: string;

  variantId: string;

  productName: string;

  variantName: string;

  sku: string;

  qrToken?: string;

  stock: number;

  cost: number;

  sellingPrice: number;

  defaultCost: number;

  defaultSellingPrice: number;

  priceBatches?: ProductPriceBatch[];

  image: string;

  threshold: number;

};


export function priceVariantQuantity(
  variant: ProductVariant,
  quantity: number,
  batchId?: string,
) {
  const requested =
    Math.max(
      0,
      Math.trunc(
        quantity,
      ),
    );

  let remaining =
    requested;

  let subtotal =
    0;

  let regularSubtotal =
    0;

  let costTotal =
    0;

  const lines: Array<{
    batchId?: string;
    quantity: number;
    price: number;
    regularPrice: number;
    cost: number;
  }> = [];


  if (batchId) {
    const selectedBatch =
      variant.priceBatches
        ?.find(
          (batch) =>
            batch.id ===
            batchId,
        );

    if (selectedBatch) {
      const lineQuantity =
        Math.min(
          requested,
          Math.max(
            0,
            Math.trunc(
              selectedBatch.quantity,
            ),
          ),
        );

      return {
        quantity:
          lineQuantity,
        subtotal:
          Math.round(
            lineQuantity *
              selectedBatch.price *
              100,
          ) / 100,
        regularSubtotal:
          Math.round(
            lineQuantity *
              selectedBatch.regularPrice *
              100,
          ) / 100,
        costTotal:
          Math.round(
            lineQuantity *
              selectedBatch.cost *
              100,
          ) / 100,
        lines: [
          {
            batchId:
              selectedBatch.id,
            quantity:
              lineQuantity,
            price:
              selectedBatch.price,
            regularPrice:
              selectedBatch.regularPrice,
            cost:
              selectedBatch.cost,
          },
        ],
      };
    }
  }


  for (
    const batch of
      variant.priceBatches ??
      []
  ) {
    if (
      remaining <= 0
    ) {
      break;
    }

    const available =
      Math.max(
        0,
        Math.trunc(
          batch.quantity,
        ),
      );

    if (
      available <= 0
    ) {
      continue;
    }

    const take =
      Math.min(
        remaining,
        available,
      );

    subtotal +=
      take *
      batch.price;

    regularSubtotal +=
      take *
      batch.regularPrice;

    costTotal +=
      take *
      batch.cost;

    lines.push({
      batchId:
        batch.id,
      quantity:
        take,
      price:
        batch.price,
      regularPrice:
        batch.regularPrice,
      cost:
        batch.cost,
    });

    remaining -=
      take;
  }


  if (
    remaining > 0
  ) {
    const regularPrice =
      variant.regularPrice ??
      variant.price;

    subtotal +=
      remaining *
      variant.price;

    regularSubtotal +=
      remaining *
      regularPrice;

    costTotal +=
      remaining *
      variant.cost;

    lines.push({
      quantity:
        remaining,
      price:
        variant.price,
      regularPrice,
      cost:
        variant.cost,
    });
  }


  return {
    quantity:
      requested,
    subtotal:
      Math.round(
        subtotal *
        100,
      ) / 100,
    regularSubtotal:
      Math.round(
        regularSubtotal *
        100,
      ) / 100,
    costTotal:
      Math.round(
        costTotal *
        100,
      ) / 100,
    lines,
  };
}


export const DEFAULT_CURRENCY =
  "LKR";


export const ARC_QR_PREFIX =
  "ARC:V1:";

export const LEGACY_NOVA_QR_PREFIX =
  "NOVA:V1:";

/*
 * Backward-compatible export name for existing internal imports.
 * New QR payloads are ARC-branded while already printed NOVA
 * payloads remain scannable.
 */
export const NOVA_QR_PREFIX =
  ARC_QR_PREFIX;


export function formatMoney(

  amount: number,

  currency =
    DEFAULT_CURRENCY,

): string {

  return new Intl.NumberFormat(
    "en-LK",
    {

      style:
        "currency",

      currency,

    },
  ).format(
    amount,
  );

}


export function buildVariantQrPayload(

  qrToken: string,

): string {

  return (

    `${NOVA_QR_PREFIX}${qrToken
      .trim()
      .toLowerCase()}`

  );

}


export function extractQrToken(

  value: string,

): string | null {

  const normalized =
    value.trim();


  const arcMatch =
    /^ARC:V1:([0-9a-f-]{36})$/i.exec(
      normalized,
    );


  if (
    arcMatch?.[1]
  ) {
    return arcMatch[1]
      .toLowerCase();
  }


  const legacyMatch =
    /^NOVA:V1:([0-9a-f-]{36})$/i.exec(
      normalized,
    );


  return (
    legacyMatch?.[1]
      ?.toLowerCase() ??
    null
  );

}


export function shortQrToken(

  qrToken?: string,

): string {

  if (
    !qrToken
  ) {

    return "—";

  }


  return (

    `${qrToken.slice(
      0,
      8,
    )}…`

  );

}


export function findVariantByScanValue(

  products: Product[],

  value: string,

) {

  const normalized =
    value.trim();


  const qrToken =
    extractQrToken(
      normalized,
    );


  for (
    const product
    of products
  ) {

    if (
      product.status
      !==
      "Active"
    ) {

      continue;

    }


    const variant =
      product.variants.find(

        (
          candidate,
        ) => {


          if (
            candidate.active
            ===
            false
          ) {

            return false;

          }


          /*
           * SKU fallback.
           */

          if (
            candidate.sku.toLowerCase() ===
              normalized.toLowerCase()
          ) {
            return true;
          }


          /*
           * Manufacturer barcode.
           *
           * Kept separate from the ARC QR token so packaged
           * products can use their existing EAN / UPC / Code128
           * value while ARC QR remains available for everything
           * else.
           */

          if (
            candidate.barcode &&
            candidate.barcode ===
              normalized
          ) {
            return true;
          }


          /*
           * Permanent ARC QR.
           */

          if (
            !qrToken
            ||
            !candidate.qrToken
          ) {

            return false;

          }


          return (

            candidate.qrToken.toLowerCase()
            ===
            qrToken

          );

        },

      );


    if (
      variant
    ) {

      return {

        product,

        variant,

      };

    }

  }


  return null;

}


export function flattenInventory(

  products: Product[],

): InventoryItem[] {

  return products.flatMap(

    (
      product,
    ) =>

      product.variants.map(

        (
          variant,
        ) => ({

          productId:
            product.id,

          variantId:
            variant.id,

          productName:
            product.name,

          variantName:
            variant.name,

          sku:
            variant.sku,

          qrToken:
            variant.qrToken,

          barcode:
            variant.barcode,

          stock:
            variant.stock,

          cost:
            variant.cost,

          sellingPrice:
            variant.regularPrice ??
            variant.price,

          defaultCost:
            variant.defaultCost ??
            variant.cost,

          defaultSellingPrice:
            variant.defaultPrice ??
            variant.regularPrice ??
            variant.price,

          priceBatches:
            variant.priceBatches,

          image:
            product.image,

          threshold:
            variant.lowStockThreshold
            ??
            5,

        }),

      ),

  );

}