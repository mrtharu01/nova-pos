"use client";

import { create } from "zustand";
import type { Product, ProductVariant } from "@/lib/domain/catalog";

export type CartItem = {
  id: string;
  product: Product;
  variant: ProductVariant;
  quantity: number;
};

export interface CartState {
  items: CartItem[];
  customerId: string | null;
  discount: number;
  taxRate: number;
  note: string;

  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setCustomer: (id: string | null) => void;
  setDiscount: (amount: number) => void;
  setNote: (note: string) => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  customerId: null,
  discount: 0,
  taxRate: 0,
  note: "",

  addItem: (product, variant, quantity = 1) => {
    if (variant.stock <= 0 || quantity <= 0) return;

    set((state) => {
      const id = `${product.id}_${variant.id}`;
      const existingItem = state.items.find((item) => item.id === id);

      if (existingItem) {
        const nextQuantity = Math.min(existingItem.quantity + quantity, variant.stock);
        return {
          items: state.items.map((item) => item.id === id ? { ...item, quantity: nextQuantity } : item),
        };
      }

      return {
        items: [...state.items, { id, product, variant, quantity: Math.min(quantity, variant.stock) }],
      };
    });
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },

  updateQuantity: (id, quantity) => {
    set((state) => {
      if (quantity <= 0) return { items: state.items.filter((item) => item.id !== id) };
      return {
        items: state.items.map((item) =>
          item.id === id ? { ...item, quantity: Math.min(quantity, item.variant.stock) } : item
        ),
      };
    });
  },

  setCustomer: (id) => set({ customerId: id }),
  setDiscount: (amount) => set({ discount: Math.max(0, amount) }),
  setNote: (note) => set({ note }),
  clearCart: () => set({ items: [], customerId: null, discount: 0, note: "" }),

  getSubtotal: () => get().items.reduce((sum, item) => sum + item.variant.price * item.quantity, 0),

  getTax: () => {
    const { discount, taxRate } = get();
    const taxable = Math.max(0, get().getSubtotal() - discount);
    return taxable * taxRate;
  },

  getTotal: () => {
    const { discount } = get();
    return Math.max(0, get().getSubtotal() - discount + get().getTax());
  },
}));
