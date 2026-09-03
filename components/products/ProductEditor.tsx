"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  buildVariantQrPayload,
  type Product,
  type ProductStatus,
} from "@/lib/domain/catalog";

import {
  createCategory,
  fetchCategories,
  saveProduct,
  type CategoryRecord,
  type ProductVariantInput,
} from "@/lib/data/catalog-admin";

import { uploadProductImage } from "@/lib/data/product-images";

type EditorVariant = ProductVariantInput & {
  clientId: string;
  currentStock?: number;
  qrToken?: string;
};

type ImageConversionInfo = {
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
};

function newVariant(): EditorVariant {
  return {
    clientId: crypto.randomUUID(),
    name: "Standard",
    sku: "",
    price: 0,
    cost: 0,
    initialStock: 0,
    lowStockThreshold: 5,
    isActive: true,
  };
}

function mapProductVariants(product: Product): EditorVariant[] {
  return product.variants.map((variant) => ({
    clientId: variant.id,
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    cost: variant.cost,
    initialStock: 0,
    lowStockThreshold: variant.lowStockThreshold ?? 5,
    isActive: variant.active !== false,
    currentStock: variant.stock,
    qrToken: variant.qrToken,
  }));
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
      {children}
    </label>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function errorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    const message = (
      error as {
        message?: unknown;
      }
    ).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

export function ProductEditor({
  product,
}: {
  product?: Product;
}) {
  const router = useRouter();

  const fileInputRef =
    React.useRef<HTMLInputElement | null>(
      null,
    );

  const [name, setName] = React.useState(
    product?.name ?? "",
  );

  const [description, setDescription] =
    React.useState(
      product?.description ?? "",
    );

  const [imageUrl, setImageUrl] =
    React.useState(
      product?.image ===
        "/placeholder-product.svg"
        ? ""
        : product?.image ?? "",
    );

  const [status, setStatus] =
    React.useState<ProductStatus>(
      product?.status ?? "Active",
    );

  const [categoryId, setCategoryId] =
    React.useState(
      product?.categoryId ?? "",
    );

  const [categories, setCategories] =
    React.useState<CategoryRecord[]>([]);

  const [variants, setVariants] =
    React.useState<EditorVariant[]>(
      product
        ? mapProductVariants(product)
        : [newVariant()],
    );

  const [
    newCategoryName,
    setNewCategoryName,
  ] = React.useState("");

  const [
    creatingCategory,
    setCreatingCategory,
  ] = React.useState(false);

  const [
    uploadingImage,
    setUploadingImage,
  ] = React.useState(false);

  const [
    imageConversion,
    setImageConversion,
  ] =
    React.useState<ImageConversionInfo | null>(
      null,
    );

  const [saving, setSaving] =
    React.useState(false);

  const [error, setError] =
    React.useState<string | null>(
      null,
    );

  const [success, setSuccess] =
    React.useState<string | null>(
      null,
    );

  const [copiedQr, setCopiedQr] =
    React.useState<string | null>(
      null,
    );

  const loadCategories =
    React.useCallback(async () => {
      try {
        const rows =
          await fetchCategories();

        setCategories(rows);
      } catch (cause) {
        setError(
          errorMessage(
            cause,
            "Unable to load categories.",
          ),
        );
      }
    }, []);

  React.useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  function updateVariant(
    clientId: string,
    patch: Partial<EditorVariant>,
  ) {
    setVariants((current) =>
      current.map((variant) =>
        variant.clientId === clientId
          ? {
              ...variant,
              ...patch,
            }
          : variant,
      ),
    );
  }

  function removeNewVariant(
    clientId: string,
  ) {
    setVariants((current) => {
      const target = current.find(
        (variant) =>
          variant.clientId ===
          clientId,
      );

      if (target?.id) {
        return current;
      }

      if (current.length === 1) {
        return current;
      }

      return current.filter(
        (variant) =>
          variant.clientId !==
          clientId,
      );
    });
  }

  async function handleCreateCategory() {
    const trimmed =
      newCategoryName.trim();

    if (trimmed.length < 2) {
      setError(
        "Enter a category name with at least 2 characters.",
      );
      return;
    }

    setCreatingCategory(true);
    setError(null);

    try {
      const id =
        await createCategory(
          trimmed,
        );

      await loadCategories();

      setCategoryId(id);
      setNewCategoryName("");
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          "Unable to create category.",
        ),
      );
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleImageSelection(
    file?: File,
  ) {
    if (!file || uploadingImage) {
      return;
    }

    setUploadingImage(true);
    setError(null);
    setImageConversion(null);

    try {
      const result =
        await uploadProductImage(
          file,
        );

      setImageUrl(
        result.publicUrl,
      );

      setImageConversion({
        originalBytes:
          result.originalBytes,
        outputBytes:
          result.outputBytes,
        width: result.width,
        height: result.height,
      });
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          "Unable to upload the product image.",
        ),
      );
    } finally {
      setUploadingImage(false);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }
    }
  }

  async function copyQr(
    payload: string,
  ) {
    try {
      await navigator.clipboard.writeText(
        payload,
      );

      setCopiedQr(payload);

      window.setTimeout(() => {
        setCopiedQr(null);
      }, 1200);
    } catch {
      setError(
        "Unable to copy the QR identity.",
      );
    }
  }

  async function handleSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (
      saving ||
      uploadingImage
    ) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (name.trim().length < 2) {
      setError(
        "Product name is required.",
      );
      return;
    }

    if (variants.length === 0) {
      setError(
        "Add at least one variant.",
      );
      return;
    }

    const normalizedSkus =
      variants.map((variant) =>
        variant.sku
          .trim()
          .toUpperCase(),
      );

    if (
      normalizedSkus.some(
        (sku) => !sku,
      )
    ) {
      setError(
        "Every variant needs a SKU.",
      );
      return;
    }

    if (
      new Set(normalizedSkus).size !==
      normalizedSkus.length
    ) {
      setError(
        "Variant SKUs must be unique.",
      );
      return;
    }

    if (
      variants.some(
        (variant) =>
          variant.price < 0 ||
          variant.cost < 0,
      )
    ) {
      setError(
        "Price and cost cannot be negative.",
      );
      return;
    }

    setSaving(true);

    try {
      const productId =
        await saveProduct({
          id: product?.id,
          name,
          description,
          categoryId:
            categoryId || null,
          imageUrl,
          status,
          variants,
        });

      setSuccess(
        product
          ? "Product updated."
          : "Product created successfully.",
      );

      router.push(
        `/products/${productId}`,
      );

      router.refresh();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          "Unable to save product.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {error && (
        <div className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-[16px] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </div>
      )}

      {/* =========================
          PRODUCT DETAILS
      ========================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <CardTitle>
            Product details
          </CardTitle>
        </CardHeader>

        <CardContent className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel>
              Product name
            </FieldLabel>

            <Input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="e.g. Baby cream"
              maxLength={160}
            />
          </div>

          <div>
            <FieldLabel>
              Category
            </FieldLabel>

            <Select
              value={categoryId}
              onChange={(event) =>
                setCategoryId(
                  event.target.value,
                )
              }
            >
              <option value="">
                Uncategorized
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div>
            <FieldLabel>
              Status
            </FieldLabel>

            <Select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as ProductStatus,
                )
              }
            >
              <option value="Active">
                Active
              </option>

              <option value="Draft">
                Draft
              </option>

              <option value="Archived">
                Archived
              </option>
            </Select>
          </div>

          <div className="md:col-span-2">
            <FieldLabel>
              Description
            </FieldLabel>

            <Textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Product description…"
            />
          </div>

          {/* =========================
              PRODUCT IMAGE
          ========================== */}

          <div className="md:col-span-2">
            <FieldLabel>
              Product image
            </FieldLabel>

            <div className="rounded-[24px] border bg-muted/20 p-3">
              <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                <div className="relative aspect-square overflow-hidden rounded-[16px] border bg-background">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={
                        name ||
                        "Product preview"
                      }
                      fill
                      unoptimized
                      sizes="160px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <ImagePlus className="h-8 w-8" />

                      <span className="text-xs">
                        No image
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) =>
                      void handleImageSelection(
                        event.target
                          .files?.[0],
                      )
                    }
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        uploadingImage
                      }
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                    >
                      {uploadingImage ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}

                      {uploadingImage
                        ? "Converting & uploading…"
                        : imageUrl
                          ? "Replace image"
                          : "Upload image"}
                    </Button>

                    {imageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setImageUrl("");
                          setImageConversion(
                            null,
                          );
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Remove from product
                      </Button>
                    )}
                  </div>

                  <p className="text-xs leading-5 text-muted-foreground">
                    JPG, PNG or WebP.
                    NOVA automatically
                    resizes the longest
                    side to a maximum of
                    1600px and converts
                    the image to WebP at
                    82% quality before
                    uploading.
                  </p>

                  {imageConversion && (
                    <div className="rounded-[16px] border bg-background p-3 text-xs">
                      <p className="font-semibold text-foreground">
                        Image optimized
                      </p>

                      <p className="mt-1 text-muted-foreground">
                        {formatBytes(
                          imageConversion.originalBytes,
                        )}
                        {" → "}
                        {formatBytes(
                          imageConversion.outputBytes,
                        )}
                        {" · "}
                        {
                          imageConversion.width
                        }
                        ×
                        {
                          imageConversion.height
                        }
                        px · WebP
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* =========================
              ADD CATEGORY
          ========================== */}

          <div className="md:col-span-2 rounded-[24px] border bg-muted/20 p-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={newCategoryName}
                onChange={(event) =>
                  setNewCategoryName(
                    event.target.value,
                  )
                }
                placeholder="New category name"
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    event.preventDefault();

                    void handleCreateCategory();
                  }
                }}
              />

              <Button
                type="button"
                variant="outline"
                disabled={
                  creatingCategory
                }
                onClick={() =>
                  void handleCreateCategory()
                }
              >
                {creatingCategory ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}

                Add Category
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* =========================
          VARIANTS
      ========================== */}

      <Card className="rounded-[24px]">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>
              Variants
            </CardTitle>

            <p className="mt-1 text-sm text-muted-foreground">
              Each variant has its
              own permanent QR
              identity and
              independent stock.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setVariants(
                (current) => [
                  ...current,
                  newVariant(),
                ],
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Variant
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {variants.map(
            (variant, index) => {
              const qrPayload =
                variant.qrToken
                  ? buildVariantQrPayload(
                      variant.qrToken,
                    )
                  : null;

              return (
                <div
                  key={
                    variant.clientId
                  }
                  className="rounded-[24px] border bg-muted/20 p-3"
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div>
                      <p className="text-sm font-semibold">
                        Variant{" "}
                        {index + 1}
                      </p>

                      {variant.id && (
                        <p className="text-xs text-muted-foreground">
                          Current
                          stock:{" "}
                          {variant.currentStock ??
                            0}
                        </p>
                      )}
                    </div>

                    {!variant.id &&
                      variants.length >
                        1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeNewVariant(
                              variant.clientId,
                            )
                          }
                          aria-label="Remove new variant"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    {/* Variant name */}

                    <div>
                      <FieldLabel>
                        Variant name
                      </FieldLabel>

                      <Input
                        value={
                          variant.name
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              name: event
                                .target
                                .value,
                            },
                          )
                        }
                        placeholder="Standard"
                      />
                    </div>

                    {/* SKU */}

                    <div>
                      <FieldLabel>
                        SKU
                      </FieldLabel>

                      <Input
                        value={
                          variant.sku
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              sku: event.target.value.toUpperCase(),
                            },
                          )
                        }
                        placeholder="BABY-CREAM-STD-001"
                        className="font-mono"
                      />
                    </div>

                    {/* Price */}

                    <div>
                      <FieldLabel>
                        Selling price
                        (LKR)
                      </FieldLabel>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          variant.price
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              price:
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                            },
                          )
                        }
                      />
                    </div>

                    {/* Cost */}

                    <div>
                      <FieldLabel>
                        Cost (LKR)
                      </FieldLabel>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          variant.cost
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              cost:
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                            },
                          )
                        }
                      />
                    </div>

                    {/* Low stock */}

                    <div>
                      <FieldLabel>
                        Low-stock
                        threshold
                      </FieldLabel>

                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          variant.lowStockThreshold
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              lowStockThreshold:
                                Number(
                                  event
                                    .target
                                    .value,
                                ),
                            },
                          )
                        }
                      />
                    </div>

                    {/* Stock */}

                    {!variant.id ? (
                      <div>
                        <FieldLabel>
                          Initial stock
                        </FieldLabel>

                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            variant.initialStock
                          }
                          onChange={(
                            event,
                          ) =>
                            updateVariant(
                              variant.clientId,
                              {
                                initialStock:
                                  Number(
                                    event
                                      .target
                                      .value,
                                  ),
                              },
                            )
                          }
                        />
                      </div>
                    ) : (
                      <div>
                        <FieldLabel>
                          Stock
                        </FieldLabel>

                        <Input
                          value={
                            variant.currentStock ??
                            0
                          }
                          readOnly
                          disabled
                        />

                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Change stock
                          from Inventory
                          so every
                          adjustment is
                          audited.
                        </p>
                      </div>
                    )}

                    {/* Active */}

                    <div className="flex items-end">
                      <label className="flex h-11 w-full cursor-pointer items-center justify-between rounded-[12px] border bg-input px-4 text-sm">
                        <span>
                          Active variant
                        </span>

                        <input
                          type="checkbox"
                          checked={
                            variant.isActive
                          }
                          onChange={(
                            event,
                          ) =>
                            updateVariant(
                              variant.clientId,
                              {
                                isActive:
                                  event
                                    .target
                                    .checked,
                              },
                            )
                          }
                          className="h-4 w-4"
                        />
                      </label>
                    </div>

                    {/* QR Identity */}

                    <div className="md:col-span-2 lg:col-span-4">
                      <FieldLabel>
                        QR Identity
                      </FieldLabel>

                      {qrPayload ? (
                        <div className="rounded-[16px] border bg-background p-2">
                          <div className="flex gap-2">
                            <Input
                              value={
                                qrPayload
                              }
                              readOnly
                              className="font-mono text-xs"
                            />

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              onClick={() =>
                                void copyQr(
                                  qrPayload,
                                )
                              }
                              aria-label="Copy QR identity"
                            >
                              {copiedQr ===
                              qrPayload ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </div>

                          <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                            Permanent NOVA
                            QR identity.
                            This is
                            generated
                            automatically.
                            Do not replace
                            it after
                            physical
                            labels are
                            printed.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-[16px] border bg-background p-3 text-xs text-muted-foreground">
                          Generated
                          automatically
                          after this new
                          variant is
                          saved.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            },
          )}
        </CardContent>
      </Card>

      {/* =========================
          ACTIONS
      ========================== */}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              "/products",
            )
          }
          disabled={
            saving ||
            uploadingImage
          }
        >
          Cancel
        </Button>

        <Button
          type="submit"
          disabled={
            saving ||
            uploadingImage
          }
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}

          {product
            ? "Save Changes"
            : "Create Product"}
        </Button>
      </div>
    </form>
  );
}