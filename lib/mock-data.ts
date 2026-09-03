import type { Product } from "@/lib/domain/catalog";

export type { Category, Product, ProductVariant } from "@/lib/domain/catalog";
export { formatMoney } from "@/lib/domain/catalog";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Artisan Espresso Blend",
    category: "Coffee",
    description: "Our signature house blend, perfect for espresso.",
    image: "https://picsum.photos/seed/espresso/400/400",
    status: "Active",
    variants: [
      { id: "v1_250", name: "250g", sku: "CF-ESP-250", price: 3500, cost: 1500, stock: 45 },
      { id: "v1_500", name: "500g", sku: "CF-ESP-500", price: 6500, cost: 2800, stock: 22 },
      { id: "v1_1kg", name: "1kg", sku: "CF-ESP-1KG", price: 12000, cost: 5200, stock: 15 },
    ],
  },
  {
    id: "p2",
    name: "Single Origin Ethiopia",
    category: "Coffee",
    description: "Light roast with floral and berry notes.",
    image: "https://picsum.photos/seed/ethiopia/400/400",
    status: "Active",
    variants: [
      { id: "v2_250", name: "250g", sku: "CF-ETH-250", price: 4200, cost: 1800, stock: 12 },
    ],
  },
  {
    id: "p3",
    name: "Butter Croissant",
    category: "Pastry",
    description: "Flaky, buttery, freshly baked daily.",
    image: "https://picsum.photos/seed/croissant/400/400",
    status: "Active",
    variants: [
      { id: "v3_std", name: "Standard", sku: "PS-CRO-STD", price: 850, cost: 250, stock: 30 },
    ],
  },
  {
    id: "p4",
    name: "Almond Croissant",
    category: "Pastry",
    description: "Double baked with almond frangipane.",
    image: "https://picsum.photos/seed/almond/400/400",
    status: "Active",
    variants: [
      { id: "v4_std", name: "Standard", sku: "PS-ALM-STD", price: 1100, cost: 350, stock: 18 },
    ],
  },
  {
    id: "p5",
    name: "Ceramic Coffee Dripper",
    category: "Equipment",
    description: "V60 style ceramic pour-over dripper.",
    image: "https://picsum.photos/seed/dripper/400/400",
    status: "Active",
    variants: [
      { id: "v5_wht", name: "White", sku: "EQ-V60-WHT", price: 5500, cost: 2500, stock: 8 },
      { id: "v5_blk", name: "Matte Black", sku: "EQ-V60-BLK", price: 6000, cost: 2800, stock: 5 },
    ],
  },
  {
    id: "p6",
    name: "Paper Filters",
    category: "Equipment",
    description: "100 pack of unbleached paper filters.",
    image: "https://picsum.photos/seed/filters/400/400",
    status: "Active",
    variants: [
      { id: "v6_std", name: "Size 02", sku: "EQ-FLT-02", price: 1200, cost: 400, stock: 150 },
    ],
  },
  {
    id: "p7",
    name: "Tote Bag",
    category: "Merchandise",
    description: "Heavy canvas tote with our logo.",
    image: "https://picsum.photos/seed/tote/400/400",
    status: "Active",
    variants: [
      { id: "v7_nat", name: "Natural", sku: "MC-TOT-NAT", price: 2500, cost: 800, stock: 40 },
    ],
  },
  {
    id: "p8",
    name: "Travel Tumbler",
    category: "Merchandise",
    description: "Insulated 12oz tumbler.",
    image: "https://picsum.photos/seed/tumbler/400/400",
    status: "Active",
    variants: [
      { id: "v8_blk", name: "Black", sku: "MC-TUM-BLK", price: 8500, cost: 3500, stock: 25 },
      { id: "v8_slv", name: "Silver", sku: "MC-TUM-SLV", price: 8000, cost: 3300, stock: 20 },
    ],
  },
  {
    id: "p9",
    name: "Cold Brew Bottle",
    category: "Equipment",
    description: "Glass bottle with built-in filter for cold brew.",
    image: "https://picsum.photos/seed/coldbrew/400/400",
    status: "Active",
    variants: [
      { id: "v9_750", name: "750ml", sku: "EQ-CB-750", price: 11500, cost: 5000, stock: 6 },
    ],
  },
  {
    id: "p10",
    name: "Matcha Powder",
    category: "Coffee", // Technically tea, but grouping here for simplicity
    description: "Ceremonial grade Japanese matcha.",
    image: "https://picsum.photos/seed/matcha/400/400",
    status: "Active",
    variants: [
      { id: "v10_100", name: "100g", sku: "TE-MAT-100", price: 9500, cost: 4500, stock: 14 },
    ],
  },
  {
    id: "p11",
    name: "Pain au Chocolat",
    category: "Pastry",
    description: "Classic chocolate filled croissant.",
    image: "https://picsum.photos/seed/chocolate/400/400",
    status: "Active",
    variants: [
      { id: "v11_std", name: "Standard", sku: "PS-CHO-STD", price: 950, cost: 300, stock: 20 },
    ],
  },
  {
    id: "p12",
    name: "Digital Scale",
    category: "Equipment",
    description: "Precise coffee scale with timer.",
    image: "https://picsum.photos/seed/scale/400/400",
    status: "Active",
    variants: [
      { id: "v12_std", name: "Standard", sku: "EQ-SCL-STD", price: 14500, cost: 7000, stock: 4 },
    ],
  }
];

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalSpent: number;
  purchases: number;
  lastPurchase: string;
};

export const MOCK_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Amara Perera", email: "amara@example.com", phone: "077-123-4567", totalSpent: 45000, purchases: 12, lastPurchase: "2026-08-25T10:30:00Z" },
  { id: "c2", name: "Kavindu Silva", email: "kavindu@example.com", phone: "071-987-6543", totalSpent: 12500, purchases: 3, lastPurchase: "2026-08-20T14:15:00Z" },
  { id: "c3", name: "Sarah Jenkins", email: "sarah.j@example.com", phone: "076-555-1212", totalSpent: 85000, purchases: 24, lastPurchase: "2026-08-27T08:45:00Z" },
  { id: "c4", name: "Nimal Fernando", email: "nimal.f@example.com", phone: "077-333-8888", totalSpent: 3400, purchases: 1, lastPurchase: "2026-08-01T11:20:00Z" },
  { id: "c5", name: "Dinithi Bandara", email: "dinithi@example.com", phone: "072-444-9999", totalSpent: 22000, purchases: 8, lastPurchase: "2026-08-22T16:00:00Z" },
  { id: "c6", name: "Michael Chang", email: "mike.c@example.com", phone: "070-111-2222", totalSpent: 6500, purchases: 2, lastPurchase: "2026-08-15T09:10:00Z" },
  { id: "c7", name: "Priya Patel", email: "priya@example.com", phone: "077-777-5555", totalSpent: 54000, purchases: 18, lastPurchase: "2026-08-26T13:40:00Z" },
  { id: "c8", name: "Ruwan Wijesinghe", email: "ruwan.w@example.com", phone: "071-222-3333", totalSpent: 11000, purchases: 5, lastPurchase: "2026-08-10T15:25:00Z" },
];

export type TransactionItem = {
  productId: string;
  variantId: string;
  name: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Transaction = {
  id: string;
  receiptNumber: string;
  date: string;
  customerId?: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: "Cash" | "Card" | "Transfer";
  status: "Completed" | "Refunded" | "Voided";
  staff: string;
};

