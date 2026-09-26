"use client";

import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/AppLayout";
import { useCurrentBusiness } from "@/hooks/use-current-business";
import { flattenInventory, type InventoryItem } from "@/lib/domain/catalog";
import { useCatalog } from "@/hooks/use-catalog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, History, Loader2, PackageOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { adjustInventory, breakInventoryUnit, fetchDefaultInventoryLocation, receiveInventoryBatch, type InventoryMovementType } from "@/lib/data/catalog-admin";

type AdjustmentAction = "stock_in" | "stock_out" | "damage" | "loss" | "return" | "increase" | "decrease";

function resolveAdjustment(action: AdjustmentAction, quantity: number): { type: InventoryMovementType; delta: number } {
  const amount = Math.abs(Math.trunc(quantity));
  switch (action) {
    case "stock_in": return { type: "stock_in", delta: amount };
    case "return": return { type: "return", delta: amount };
    case "stock_out": return { type: "stock_out", delta: -amount };
    case "damage": return { type: "damage", delta: -amount };
    case "loss": return { type: "loss", delta: -amount };
    case "increase": return { type: "adjustment", delta: amount };
    case "decrease": return { type: "adjustment", delta: -amount };
  }
}

function getInventoryErrorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;

  if (cause && typeof cause === "object" && "message" in cause) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return "Unable to adjust inventory.";
}

export default function InventoryPage() {
  const { business } = useCurrentBusiness();
  const [search, setSearch] = React.useState("");
  const { products, loading, error, refresh } = useCatalog();
  const [selected, setSelected] = React.useState<InventoryItem | null>(null);
  const [action, setAction] = React.useState<AdjustmentAction>("stock_in");
  const [quantity, setQuantity] = React.useState(1);
  const [breakQuantity, setBreakQuantity] = React.useState(1);
  const [incomingUnitCost, setIncomingUnitCost] = React.useState("");
  const [newSellingPrice, setNewSellingPrice] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [adjustError, setAdjustError] = React.useState<string | null>(null);

  const inventoryItems = flattenInventory(products).filter((item) => {
    const term = search.toLowerCase();
    return item.productName.toLowerCase().includes(term) || item.variantName.toLowerCase().includes(term) || item.sku.toLowerCase().includes(term);
  });

  function openAdjustment(item: InventoryItem) {
    setSelected(item);
    setAction("stock_in");
    setQuantity(1);
    setBreakQuantity(1);
    setIncomingUnitCost("");
    setNewSellingPrice("");
    setReason("");
    setNote("");
    setAdjustError(null);
  }

  async function submitBreak() {
    if (
      !selected ||
      !selected.unitParentVariantId ||
      !selected.unitsPerParent ||
      saving
    ) {
      return;
    }

    const parentQuantity =
      Math.trunc(
        breakQuantity,
      );

    if (
      !Number.isFinite(
        breakQuantity,
      ) ||
      parentQuantity <= 0
    ) {
      setAdjustError(
        "Pack quantity must be greater than zero.",
      );
      return;
    }

    if (
      parentQuantity >
      (
        selected.parentStock ??
        0
      )
    ) {
      setAdjustError(
        `Not enough ${selected.unitParentVariantName ?? "parent"} stock. Available: ${selected.parentStock ?? 0}.`,
      );
      return;
    }

    setSaving(
      true,
    );
    setAdjustError(
      null,
    );

    try {
      const locationId =
        await fetchDefaultInventoryLocation(
          business?.id,
        );

      await breakInventoryUnit({
        childVariantId:
          selected.variantId,
        locationId,
        parentQuantity,
      });

      setSelected(
        null,
      );

      await refresh();
    } catch (
      cause
    ) {
      setAdjustError(
        getInventoryErrorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  async function submitAdjustment() {
    if (!selected || saving) return;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAdjustError("Quantity must be greater than zero.");
      return;
    }

    const incomingCost =
      incomingUnitCost.trim() === ""
        ? undefined
        : Number(incomingUnitCost);

    const sellingPrice =
      newSellingPrice.trim() === ""
        ? undefined
        : Number(newSellingPrice);

    if (
      action === "stock_in" &&
      incomingCost !== undefined &&
      (
        !Number.isFinite(incomingCost) ||
        incomingCost < 0
      )
    ) {
      setAdjustError("Incoming unit cost must be zero or greater.");
      return;
    }

    if (
      action === "stock_in" &&
      sellingPrice !== undefined &&
      (
        !Number.isFinite(sellingPrice) ||
        sellingPrice < 0
      )
    ) {
      setAdjustError("New selling price must be zero or greater.");
      return;
    }

    const resolved = resolveAdjustment(action, quantity);
    if (selected.stock + resolved.delta < 0) {
      setAdjustError(`This would reduce stock below zero. Current stock is ${selected.stock}.`);
      return;
    }

    setSaving(true);
    setAdjustError(null);
    try {
      const locationId = await fetchDefaultInventoryLocation(business?.id);
      if (action === "stock_in") {
        await receiveInventoryBatch({
          variantId: selected.variantId,
          locationId,
          quantity: Math.trunc(quantity),
          unitCost: incomingCost,
          sellingPrice,
          reason: reason || "New stock delivery",
          note,
        });
      } else {
        await adjustInventory({
          variantId: selected.variantId,
          locationId,
          delta: resolved.delta,
          movementType: resolved.type,
          reason: reason || action.replaceAll("_", " "),
          note,
        });
      };
      setSelected(null);
      await refresh();
    } catch (cause) {
      setAdjustError(getInventoryErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Inventory">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search SKU or product…" className="bg-card pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <Button asChild variant="outline"><Link href="/inventory/history"><History className="mr-2 h-4 w-4" /> View History</Link></Button>
      </div>

      {error && <div className="mb-4 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Inventory could not be loaded: {error}</div>}

      <Card className="overflow-hidden rounded-[24px]">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>QR ID</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Stock Level</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading inventory…</TableCell></TableRow>}
              {!loading && inventoryItems.map((item) => {
                const isLow = item.stock <= item.threshold;
                const isOut = item.stock === 0;
                let statusBadge = <Badge variant="success">In Stock</Badge>;
                if (isOut) statusBadge = <Badge variant="destructive">Out of Stock</Badge>;
                else if (isLow) statusBadge = <Badge variant="warning">Low Stock</Badge>;

                return (
                  <TableRow key={item.variantId} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-[8px] border bg-muted"><img src={item.image} alt={item.productName} className="h-full w-full object-cover" /></div>
                        <div><p className="font-medium leading-none">{item.productName}</p><p className="mt-1 text-xs text-muted-foreground">{item.variantName}</p>{item.unitParentVariantId && <p className="mt-1 text-[10px] text-muted-foreground">Loose unit · 1 {item.unitParentVariantName ?? "parent"} → {item.unitsPerParent ?? "—"} {item.variantName}</p>}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
  {item.sku}
</TableCell>

<TableCell>
  {item.qrToken ? (
    <div>
      <p
        className="max-w-[140px] truncate font-mono text-xs"
        title={`ARC:V1:${item.qrToken}`}
      >
        {item.qrToken.slice(0, 8)}…
      </p>

      <p className="mt-1 text-[10px] text-muted-foreground">
        Permanent
      </p>
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">
      —
    </span>
  )}
</TableCell>

<TableCell>{statusBadge}</TableCell>
                    <TableCell className="text-right font-medium"><span className={isOut ? "text-destructive" : isLow ? "text-amber-600 dark:text-amber-400" : ""}>{item.stock}</span><span className="ml-1 text-xs text-muted-foreground">/ low {item.threshold}</span></TableCell>
                    <TableCell className="text-right"><Button variant="secondary" size="sm" onClick={() => openAdjustment(item)}>Adjust</Button></TableCell>
                  </TableRow>
                );
              })}
              {!loading && inventoryItems.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No inventory items found. Add a product first.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog isOpen={Boolean(selected)} onClose={() => !saving && setSelected(null)} title="Adjust Inventory" description={selected ? `${selected.productName} · ${selected.variantName} · ${selected.sku}` : undefined}>
        {selected && (
          <div className="space-y-4">
            {adjustError && <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{adjustError}</div>}
            <div className="rounded-[20px] border bg-muted/20 p-3 text-sm">
              <span className="text-muted-foreground">{selected.variantName} stock</span>
              <span className="float-right font-semibold">{selected.stock}</span>
            </div>

            {selected.unitParentVariantId &&
              selected.unitsPerParent && (
              <div className="rounded-[20px] border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-[12px] border bg-background p-2">
                    <PackageOpen className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      Break sealed stock into {selected.variantName}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      1 {selected.unitParentVariantName ?? "parent unit"} → {selected.unitsPerParent} {selected.variantName}. ARC keeps sealed and loose stock separate and carries the exact FIFO cost into the loose units.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                      {selected.unitParentVariantName ?? "Parent"} quantity to open
                    </label>

                    <Input
                      type="number"
                      min="1"
                      max={
                        selected.parentStock ??
                        0
                      }
                      step="1"
                      value={
                        breakQuantity
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setBreakQuantity(
                            Number(
                              event.target.value,
                            ),
                          )
                      }
                    />

                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Parent {selected.unitParentVariantName ?? "unit"} stock: {selected.parentStock ?? 0} · creates {
                        Number.isFinite(
                          breakQuantity,
                        )
                          ? Math.max(
                              0,
                              Math.trunc(
                                breakQuantity,
                              ),
                            ) *
                            selected.unitsPerParent
                          : 0
                      } loose
                    </p>
                  </div>

                  {(selected.parentStock ?? 0) <= 0 && (
                    <div className="sm:col-span-2 rounded-[14px] border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] leading-5 text-amber-700 dark:text-amber-300">
                      Break Stock is disabled because the parent/sealed variant “{selected.unitParentVariantName ?? "Parent"}” has 0 stock. The {selected.stock} shown above belongs to “{selected.variantName}” itself and is separate loose stock.
                    </div>
                  )}

                                    <Button
                    type="button"
                    variant="secondary"
                    className="rounded-[14px]"
                    disabled={
                      saving ||
                      (
                        selected.parentStock ??
                        0
                      ) <=
                        0
                    }
                    onClick={() =>
                      void submitBreak()
                    }
                  >
                    {saving
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <PackageOpen className="mr-2 h-4 w-4" />}
                    Break stock
                  </Button>
                </div>
              </div>
            )}

            {selected.priceBatches &&
              selected.priceBatches.length >
                0 && (
              <div className="rounded-[20px] border bg-muted/20 p-4">
                <p className="text-xs font-semibold">
                  FIFO price batches
                </p>

                <div className="mt-3 space-y-2">
                  {selected.priceBatches.map(
                    (
                      batch,
                      index,
                    ) => (
                      <div
                        key={
                          batch.id ||
                          index
                        }
                        className="flex items-center justify-between gap-3 rounded-[14px] border bg-background px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold">
                            {index ===
                            0
                              ? "Selling now"
                              : `Queued #${index + 1}`}
                          </p>

                          <p className="mt-0.5 text-muted-foreground">
                            {batch.quantity} unit{batch.quantity === 1 ? "" : "s"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold">
                            LKR {batch.regularPrice.toFixed(2)}
                          </p>

                          <p className="mt-0.5 text-muted-foreground">
                            cost {batch.cost.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Action</label><Select value={action} onChange={(event) => setAction(event.target.value as AdjustmentAction)}><option value="stock_in">Stock In</option><option value="stock_out">Stock Out</option><option value="return">Customer Return</option><option value="damage">Damaged</option><option value="loss">Lost</option><option value="increase">Manual Increase</option><option value="decrease">Manual Decrease</option></Select></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Quantity</label><Input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></div>

            {action === "stock_in" && (
              <div className="space-y-3 rounded-[20px] border bg-muted/20 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Current FIFO selling price</p>
                    <p className="mt-1 text-base font-semibold">LKR {selected.sellingPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Existing stock ahead</p>
                    <p className="mt-1 text-base font-semibold">{selected.stock} units</p>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Incoming unit cost (optional)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={incomingUnitCost}
                    onChange={(event) => setIncomingUnitCost(event.target.value)}
                    placeholder={selected.defaultCost.toFixed(2)}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Selling price for this delivery (optional)</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSellingPrice}
                    onChange={(event) => setNewSellingPrice(event.target.value)}
                    placeholder={selected.defaultSellingPrice.toFixed(2)}
                  />
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    This creates a new FIFO price batch. Older stock keeps its old price, and this delivery keeps its new price. Barcode labels are optional; FIFO pricing works through the product record itself.
                  </p>
                </div>

                {selected.stock > 0 && (
                  <div className="rounded-[14px] border bg-background px-3 py-2 text-xs leading-5 text-muted-foreground">
                    This delivery is queued behind the existing {selected.stock} unit{selected.stock === 1 ? "" : "s"}. ARC will not change their selling price.
                  </div>
                )}
              </div>
            )}

            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Reason</label><Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. New stock delivery" /></div>
            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Note (optional)</label><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Additional details…" /></div>
            <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>Cancel</Button><Button onClick={() => void submitAdjustment()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apply Adjustment</Button></div>
          </div>
        )}
      </Dialog>
    </AppLayout>
  );
}
