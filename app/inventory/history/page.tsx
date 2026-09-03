"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchInventoryMovements, type InventoryMovementRecord } from "@/lib/data/catalog-admin";

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function InventoryHistoryPage() {
  const [rows, setRows] = React.useState<InventoryMovementRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchInventoryMovements();
        if (!cancelled) setRows(data);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load inventory history.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter((row) => {
    const term = search.toLowerCase();
    return row.productName.toLowerCase().includes(term) || row.variantName.toLowerCase().includes(term) || row.sku.toLowerCase().includes(term) || row.reason.toLowerCase().includes(term);
  });

  return (
    <AppLayout title="Inventory History">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row">
        <Button asChild variant="outline"><Link href="/inventory"><ArrowLeft className="mr-2 h-4 w-4" /> Inventory</Link></Button>
        <div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search history…" className="bg-card pl-9" /></div>
      </div>

      {error && <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

      <Card className="overflow-hidden rounded-[24px]"><CardContent className="p-0"><Table>
        <TableHeader className="bg-muted/50"><TableRow><TableHead>Date</TableHead><TableHead>Product</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Change</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader>
        <TableBody>
          {loading && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading inventory history…</TableCell></TableRow>}
          {!loading && filtered.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(row.createdAt).toLocaleString("en-LK")}</TableCell>
              <TableCell><p className="font-medium">{row.productName}</p><p className="text-xs text-muted-foreground">{row.variantName} · <span className="font-mono">{row.sku}</span></p></TableCell>
              <TableCell className="text-sm">{titleCase(row.movementType)}</TableCell>
              <TableCell className={`text-right font-semibold ${row.quantityDelta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>{row.quantityDelta > 0 ? "+" : ""}{row.quantityDelta}</TableCell>
              <TableCell className="text-right text-sm">{row.quantityBefore} → {row.quantityAfter}</TableCell>
              <TableCell><p className="text-sm">{row.reason || "—"}</p>{row.note && <p className="max-w-xs truncate text-xs text-muted-foreground">{row.note}</p>}</TableCell>
            </TableRow>
          ))}
          {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No inventory movements found.</TableCell></TableRow>}
        </TableBody>
      </Table></CardContent></Card>
    </AppLayout>
  );
}
