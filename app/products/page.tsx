"use client";

import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatMoney } from "@/lib/domain/catalog";
import { useCatalog } from "@/hooks/use-catalog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ProductsPage() {
  const [search, setSearch] = React.useState("");
  const { products, loading, error } = useCatalog();

  const filtered = products.filter((product) => {
    const term = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term) ||
      product.variants.some((variant) => variant.sku.toLowerCase().includes(term))
    );
  });

  return (
    <AppLayout title="Products">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search product, category or SKU…"
            className="bg-card pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button asChild>
          <Link href="/products/new"><Plus className="mr-2 h-4 w-4" /> Add Product</Link>
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Products could not be loaded: {error}
        </div>
      )}

      <Card className="overflow-hidden rounded-[24px]">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[80px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px] text-right">Edit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading products…</TableCell>
                </TableRow>
              )}

              {!loading && filtered.map((product) => {
                const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
                const startingPrice = Math.min(...product.variants.map((variant) => variant.price));

                return (
                  <TableRow key={product.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="h-10 w-10 overflow-hidden rounded-[10px] border bg-muted">
                        <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.variants.length} variant(s)</p>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{formatMoney(startingPrice)}</TableCell>
                    <TableCell>
                      <span className={totalStock <= 5 ? "font-medium text-destructive" : ""}>{totalStock}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={product.status === "Active" ? "success" : product.status === "Archived" ? "secondary" : "warning"}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon" aria-label={`Edit ${product.name}`}>
                        <Link href={`/products/${product.id}`}><Pencil className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center">
                    <div className="mx-auto max-w-sm text-muted-foreground">
                      <p className="font-medium text-foreground">No products found</p>
                      <p className="mt-1 text-sm">Add your first real product to start using NOVA inventory and QR scanning.</p>
                      <Button asChild className="mt-4"><Link href="/products/new"><Plus className="mr-2 h-4 w-4" /> Add Product</Link></Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
