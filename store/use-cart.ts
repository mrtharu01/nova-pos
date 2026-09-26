"use client";

import { create } from "zustand";
import type {
  Product,
  ProductVariant,
} from "@/lib/domain/catalog";
import {
  priceVariantQuantity,
} from "@/lib/domain/catalog";

export type CartItem = {
  id: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
  batchId?: string;
};

export interface CartState {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  taxRate: number;
  note: string;

  addItem: (
    product: Product,
    variant: ProductVariant,
    quantity?: number,
    batchId?: string,
  ) => void;

  removeItem: (id: string) => void;

  updateQuantity: (
    id: string,
    quantity: number,
  ) => void;

  setItemBatch: (
    id: string,
    batchId: string,
  ) => void;

  setCustomer: (id: string | null) => void;
  setDiscount: (amount: number) => void;
  setNote: (note: string) => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

function lineId(
  productId: string,
  variantId: string,
  batchId?: string,
) {
  return [
    productId,
    variantId,
    batchId ?? "auto",
  ].join("_");
}

function batchCapacity(
  variant: ProductVariant,
  batchId?: string,
) {
  if (!batchId) {
    return variant.stock;
  }

  return (
    variant.priceBatches
      ?.find(
        (batch) =>
          batch.id ===
          batchId,
      )
      ?.quantity ??
    0
  );
}

export const useCart =
  create<CartState>(
    (
      set,
      get,
    ) => ({
      items: [],
      customerId: null,
      discount: 0,
      taxRate: 0,
      note: "",

      addItem: (
        product,
        variant,
        quantity = 1,
        preferredBatchId,
      ) => {
        if (
          variant.stock <= 0 ||
          quantity <= 0
        ) {
          return;
        }

        set(
          (
            state,
          ) => {
            const nextItems =
              [...state.items];

            let remaining =
              Math.min(
                Math.trunc(
                  quantity,
                ),
                variant.stock,
              );

            const batches =
              variant.priceBatches ??
              [];

            const eligibleBatches =
              preferredBatchId
                ? batches.filter(
                    (
                      batch,
                    ) =>
                      batch.id ===
                      preferredBatchId,
                  )
                : batches;

            if (
              eligibleBatches.length >
              0
            ) {
              for (
                const batch of
                  eligibleBatches
              ) {
                if (
                  remaining <= 0
                ) {
                  break;
                }

                const id =
                  lineId(
                    product.id,
                    variant.id,
                    batch.id,
                  );

                const existingIndex =
                  nextItems.findIndex(
                    (
                      item,
                    ) =>
                      item.id ===
                      id,
                  );

                const currentQuantity =
                  existingIndex >= 0
                    ? nextItems[
                        existingIndex
                      ].quantity
                    : 0;

                const available =
                  Math.max(
                    0,
                    batch.quantity -
                      currentQuantity,
                  );

                const take =
                  Math.min(
                    remaining,
                    available,
                  );

                if (
                  take <= 0
                ) {
                  continue;
                }

                if (
                  existingIndex >= 0
                ) {
                  nextItems[
                    existingIndex
                  ] = {
                    ...nextItems[
                      existingIndex
                    ],
                    quantity:
                      currentQuantity +
                      take,
                    product,
                    variant,
                  };
                } else {
                  nextItems.push({
                    id,
                    product,
                    variant,
                    quantity:
                      take,
                    batchId:
                      batch.id,
                  });
                }

                remaining -=
                  take;
              }

              return {
                items:
                  nextItems,
              };
            }

            const id =
              lineId(
                product.id,
                variant.id,
              );

            const existingIndex =
              nextItems.findIndex(
                (
                  item,
                ) =>
                  item.id ===
                  id,
              );

            const currentQuantity =
              existingIndex >= 0
                ? nextItems[
                    existingIndex
                  ].quantity
                : 0;

            const totalVariantQuantity =
              nextItems.reduce(
                (
                  total,
                  item,
                ) =>
                  item.variant.id ===
                  variant.id
                    ? total +
                      item.quantity
                    : total,
                0,
              );

            const available =
              Math.max(
                0,
                variant.stock -
                  totalVariantQuantity,
              );

            const take =
              Math.min(
                remaining,
                available,
              );

            if (
              take <= 0
            ) {
              return {
                items:
                  nextItems,
              };
            }

            if (
              existingIndex >= 0
            ) {
              nextItems[
                existingIndex
              ] = {
                ...nextItems[
                  existingIndex
                ],
                quantity:
                  currentQuantity +
                  take,
                product,
                variant,
              };
            } else {
              nextItems.push({
                id,
                product,
                variant,
                quantity:
                  take,
              });
            }

            return {
              items:
                nextItems,
            };
          },
        );
      },

      removeItem: (
        id,
      ) => {
        set(
          (
            state,
          ) => ({
            items:
              state.items.filter(
                (
                  item,
                ) =>
                  item.id !==
                  id,
              ),
          }),
        );
      },

      updateQuantity: (
        id,
        quantity,
      ) => {
        set(
          (
            state,
          ) => {
            if (
              quantity <= 0
            ) {
              return {
                items:
                  state.items.filter(
                    (
                      item,
                    ) =>
                      item.id !==
                      id,
                  ),
              };
            }

            return {
              items:
                state.items.map(
                  (
                    item,
                  ) => {
                    if (
                      item.id !==
                      id
                    ) {
                      return item;
                    }

                    const maximum =
                      batchCapacity(
                        item.variant,
                        item.batchId,
                      );

                    return {
                      ...item,
                      quantity:
                        Math.min(
                          quantity,
                          maximum,
                        ),
                    };
                  },
                ),
            };
          },
        );
      },

      setItemBatch: (
        id,
        batchId,
      ) => {
        set(
          (
            state,
          ) => {
            const source =
              state.items.find(
                (
                  item,
                ) =>
                  item.id ===
                  id,
              );

            if (!source) {
              return state;
            }

            const targetBatch =
              source.variant
                .priceBatches
                ?.find(
                  (
                    batch,
                  ) =>
                    batch.id ===
                    batchId,
                );

            if (
              !targetBatch
            ) {
              return state;
            }

            const targetId =
              lineId(
                source.product.id,
                source.variant.id,
                targetBatch.id,
              );

            if (
              targetId ===
              source.id
            ) {
              return state;
            }

            const target =
              state.items.find(
                (
                  item,
                ) =>
                  item.id ===
                  targetId,
              );

            const targetQuantity =
              target?.quantity ??
              0;

            const available =
              Math.max(
                0,
                targetBatch.quantity -
                  targetQuantity,
              );

            if (
              available <
              source.quantity
            ) {
              return state;
            }

            const withoutSource =
              state.items.filter(
                (
                  item,
                ) =>
                  item.id !==
                  source.id &&
                  item.id !==
                  targetId,
              );

            return {
              items: [
                ...withoutSource,
                {
                  ...source,
                  id:
                    targetId,
                  batchId:
                    targetBatch.id,
                  quantity:
                    source.quantity +
                    targetQuantity,
                },
              ],
            };
          },
        );
      },

      setCustomer: (
        id,
      ) =>
        set({
          customerId:
            id,
        }),

      setDiscount: (
        amount,
      ) =>
        set({
          discount:
            Math.max(
              0,
              amount,
            ),
        }),

      setNote: (
        note,
      ) =>
        set({
          note,
        }),

      clearCart: () =>
        set({
          items: [],
          customerId: null,
          discount: 0,
          note: "",
        }),

      getSubtotal: () =>
        get().items.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            priceVariantQuantity(
              item.variant,
              item.quantity,
              item.batchId,
            ).subtotal,
          0,
        ),

      getTax: () => {
        const {
          discount,
          taxRate,
        } =
          get();

        const taxable =
          Math.max(
            0,
            get().getSubtotal() -
              discount,
          );

        return (
          taxable *
          taxRate
        );
      },

      getTotal: () => {
        const {
          discount,
        } =
          get();

        return Math.max(
          0,
          get().getSubtotal() -
            discount +
            get().getTax(),
        );
      },
    }),
  );
