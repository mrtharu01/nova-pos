export type ProductStatus =
  | "Active"
  | "Draft"
  | "Archived";


export type Category =
  string;


export type ProductVariant = {

  id: string;

  name: string;

  sku: string;

  price: number;

  cost: number;

  stock: number;

  active?: boolean;

  qrToken?: string;

  lowStockThreshold?: number;

};


export type Product = {

  id: string;

  name: string;

  category: Category;

  categoryId?: string;

  description: string;

  image: string;

  variants: ProductVariant[];

  status: ProductStatus;

};


export type InventoryItem = {

  productId: string;

  variantId: string;

  productName: string;

  variantName: string;

  sku: string;

  qrToken?: string;

  stock: number;

  image: string;

  threshold: number;

};


export const DEFAULT_CURRENCY =
  "LKR";


export const NOVA_QR_PREFIX =
  "NOVA:V1:";


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


  const match =
    /^NOVA:V1:([0-9a-f-]{36})$/i.exec(
      normalized,
    );


  return (

    match?.[1]?.toLowerCase()
    ??
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

            candidate.sku.toLowerCase()
            ===
            normalized.toLowerCase()

          ) {

            return true;

          }


          /*
           * Permanent NOVA QR.
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

          stock:
            variant.stock,

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