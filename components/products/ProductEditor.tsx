"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  BadgePercent,
  Check,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  ScanLine,
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
import { Scanner } from "@/components/ui/scanner";

import {
  RemoteScannerControl,
} from "@/components/pos/RemoteScannerControl";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  buildVariantQrPayload,
  type Product,
  type ProductStatus,
  type PromotionType,
} from "@/lib/domain/catalog";

import {
  createCategory,
  fetchCategories,
  saveProduct,
  type CategoryRecord,
  type ProductVariantInput,
} from "@/lib/data/catalog-admin";

import { uploadProductImage } from "@/lib/data/product-images";

import {
  parseNovaQrValue,
} from "@/lib/qr/qr-value";

type EditorVariant = ProductVariantInput & {
  clientId: string;
  currentStock?: number;
  qrToken?: string;
  unitParentClientId?: string;
};

type ImageConversionInfo = {
  originalBytes: number;
  outputBytes: number;
  width: number;
  height: number;
};

function newVariant(
  initialBarcode = "",
): EditorVariant {
  const barcode =
    initialBarcode.trim();

  return {
    clientId: crypto.randomUUID(),
    name: "Standard",
    sku:
      barcode
        ? `BC-${barcode}`.toUpperCase()
        : "",
    barcode,
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
    barcode: variant.barcode ?? "",
    price:
      variant.defaultPrice ??
      variant.regularPrice ??
      variant.price,
    cost:
      variant.defaultCost ??
      variant.cost,
    initialStock: 0,
    lowStockThreshold: variant.lowStockThreshold ?? 5,
    isActive: variant.active !== false,
    currentStock: variant.stock,
    qrToken: variant.qrToken,
    unitParentClientId:
      variant.unitParentVariantId,
    unitsPerParent:
      variant.unitsPerParent,
  }));
}

function numberInputValue(
  value: number,
) {
  return Number.isFinite(
    value,
  )
    ? value
    : "";
}

function parseNumberInput(
  value: string,
) {
  return value === ""
    ? Number.NaN
    : Number(value);
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

function toLocalDateTimeInput(
  value?: string,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const offset =
    date.getTimezoneOffset() *
    60 *
    1000;

  return new Date(
    date.getTime() -
      offset,
  )
    .toISOString()
    .slice(
      0,
      16,
    );
}


function toIsoOrNull(
  value: string,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      value,
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date.toISOString();
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
  initialBarcode = "",
}: {
  product?: Product;
  initialBarcode?: string;
}) {
  const router = useRouter();

  const fileInputRef =
    React.useRef<HTMLInputElement | null>(
      null,
    );


  const saveLockRef =
    React.useRef(
      false,
    );


  const feedbackRef =
    React.useRef<HTMLDivElement | null>(
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

  const [imagePath, setImagePath] =
    React.useState(
      product?.imagePath ??
      "",
    );

  const [status, setStatus] =
    React.useState<ProductStatus>(
      product?.status ?? "Active",
    );

  const [categoryId, setCategoryId] =
    React.useState(
      product?.categoryId ?? "",
    );

  const [
    promotionEnabled,
    setPromotionEnabled,
  ] =
    React.useState(
      product?.promotionEnabled ??
      false,
    );

  const [
    multiUnitEnabled,
    setMultiUnitEnabled,
  ] =
    React.useState(
      product?.multiUnitEnabled ??
      false,
    );

  const [
    promotionType,
    setPromotionType,
  ] =
    React.useState<PromotionType>(
      product?.promotionType ??
      "percentage",
    );

  const [
    promotionValue,
    setPromotionValue,
  ] =
    React.useState(
      product?.promotionValue ??
      0,
    );

  const [
    promotionStartsAt,
    setPromotionStartsAt,
  ] =
    React.useState(
      toLocalDateTimeInput(
        product?.promotionStartsAt,
      ),
    );

  const [
    promotionEndsAt,
    setPromotionEndsAt,
  ] =
    React.useState(
      toLocalDateTimeInput(
        product?.promotionEndsAt,
      ),
    );

  const [categories, setCategories] =
    React.useState<CategoryRecord[]>([]);

  const [variants, setVariants] =
    React.useState<EditorVariant[]>(
      product
        ? mapProductVariants(product)
        : [newVariant(initialBarcode)],
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


  React.useEffect(() => {
    if (
      !error &&
      !success
    ) {
      return;
    }


    window.requestAnimationFrame(
      () => {
        feedbackRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "center",
          });
      },
    );
  }, [
    error,
    success,
  ]);


  const [copiedQr, setCopiedQr] =
    React.useState<string | null>(
      null,
    );


  const [
    barcodeScannerTarget,
    setBarcodeScannerTarget,
  ] =
    React.useState<
      string | null
    >(
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

      return current
        .filter(
          (variant) =>
            variant.clientId !==
            clientId,
        )
        .map(
          (variant) =>
            variant.unitParentClientId ===
              clientId
              ? {
                  ...variant,
                  unitParentClientId:
                    undefined,
                  unitsPerParent:
                    undefined,
                }
              : variant,
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
        result.signedUrl,
      );

      setImagePath(
        result.path,
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
      saveLockRef.current ||
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


    const normalizedBarcodes =
      variants
        .map(
          (
            variant,
          ) =>
            variant.barcode
              ?.trim() ??
            "",
        )
        .filter(
          Boolean,
        );


    if (
      new Set(
        normalizedBarcodes,
      ).size !==
      normalizedBarcodes.length
    ) {
      setError(
        "Variant barcodes must be unique.",
      );
      return;
    }


    if (
      normalizedBarcodes.some(
        (
          barcode,
        ) =>
          barcode.length >
          128,
      )
    ) {
      setError(
        "Barcode values must be 128 characters or fewer.",
      );
      return;
    }

    if (
      variants.some(
        (variant) =>
          !Number.isFinite(
            variant.price,
          ) ||
          !Number.isFinite(
            variant.cost,
          ) ||
          !Number.isFinite(
            variant.lowStockThreshold,
          ) ||
          !Number.isFinite(
            variant.initialStock,
          ),
      )
    ) {
      setError(
        "Enter valid numeric values for price, cost, low-stock threshold, and stock.",
      );
      return;
    }

    if (
      variants.some(
        (variant) =>
          variant.price < 0 ||
          variant.cost < 0 ||
          variant.lowStockThreshold < 0 ||
          variant.initialStock < 0,
      )
    ) {
      setError(
        "Price, cost, low-stock threshold, and stock cannot be negative.",
      );
      return;
    }

    if (
      multiUnitEnabled
    ) {
      const linkedVariants =
        variants.filter(
          (variant) =>
            Boolean(
              variant.unitParentClientId,
            ),
        );


      if (
        linkedVariants.length ===
        0
      ) {
        setError(
          "Multi-unit mode needs at least one loose/smaller unit linked to a parent unit.",
        );
        return;
      }


      for (
        const variant of
          linkedVariants
      ) {
        const parent =
          variants.find(
            (candidate) =>
              candidate.clientId ===
              variant.unitParentClientId,
          );


        if (
          !parent ||
          parent.clientId ===
            variant.clientId
        ) {
          setError(
            `Choose a valid parent unit for ${variant.name || "the linked variant"}.`,
          );
          return;
        }


        if (
          !Number.isFinite(
            variant.unitsPerParent,
          ) ||
          !Number.isInteger(
            variant.unitsPerParent,
          ) ||
          (
            variant.unitsPerParent ??
            0
          ) <
            2
        ) {
          setError(
            `Enter how many ${variant.name || "child units"} come from one ${parent.name || "parent unit"}.`,
          );
          return;
        }
      }


      for (
        const startVariant of
          variants
      ) {
        const visited =
          new Set<string>();

        let current:
          EditorVariant | undefined =
            startVariant;

        while (
          current
            ?.unitParentClientId
        ) {
          if (
            visited.has(
              current.clientId,
            )
          ) {
            setError(
              "Unit conversion links cannot form a circular chain.",
            );
            return;
          }

          visited.add(
            current.clientId,
          );

          current =
            variants.find(
              (candidate) =>
                candidate.clientId ===
                current?.unitParentClientId,
            );
        }
      }
    }


    if (
      promotionEnabled &&
      !Number.isFinite(
        promotionValue,
      )
    ) {
      setError(
        "Enter a valid promotion value.",
      );
      return;
    }

    if (
      promotionEnabled &&
      promotionValue <= 0
    ) {
      setError(
        "Enter a promotion value greater than zero.",
      );
      return;
    }

    if (
      promotionEnabled &&
      promotionType ===
        "percentage" &&
      promotionValue >= 100
    ) {
      setError(
        "Percentage promotion must be less than 100%.",
      );
      return;
    }

    if (
      promotionEnabled &&
      promotionType ===
        "fixed" &&
      variants.some(
        (variant) =>
          promotionValue >=
          variant.price,
      )
    ) {
      setError(
        "Fixed promotion must be lower than every variant selling price.",
      );
      return;
    }

    const promotionStartIso =
      toIsoOrNull(
        promotionStartsAt,
      );

    const promotionEndIso =
      toIsoOrNull(
        promotionEndsAt,
      );

    if (
      promotionStartsAt &&
      !promotionStartIso
    ) {
      setError(
        "Promotion start date is invalid.",
      );
      return;
    }

    if (
      promotionEndsAt &&
      !promotionEndIso
    ) {
      setError(
        "Promotion end date is invalid.",
      );
      return;
    }

    if (
      promotionStartIso &&
      promotionEndIso &&
      new Date(
        promotionStartIso,
      ).getTime() >=
        new Date(
          promotionEndIso,
        ).getTime()
    ) {
      setError(
        "Promotion end must be after the start.",
      );
      return;
    }

    saveLockRef.current =
      true;


    setSaving(true);

    try {
      const productId =
        await saveProduct({
          id: product?.id,
          name,
          description,
          categoryId:
            categoryId || null,
          imagePath,
          status,
          promotionEnabled,
          promotionType,
          promotionValue:
            promotionEnabled
              ? promotionValue
              : 0,
          promotionStartsAt:
            promotionStartIso,
          promotionEndsAt:
            promotionEndIso,
          multiUnitEnabled,
          variants:
            variants.map(
              (
                variant,
              ) => {
                const parent =
                  variant.unitParentClientId
                    ? variants.find(
                        (candidate) =>
                          candidate.clientId ===
                          variant.unitParentClientId,
                      )
                    : undefined;

                return {
                  ...variant,
                  unitParentSku:
                    multiUnitEnabled
                      ? parent?.sku
                      : undefined,
                  unitsPerParent:
                    multiUnitEnabled &&
                    parent
                      ? variant.unitsPerParent
                      : undefined,
                };
              },
            ),
        });

      void productId;


      router.replace(
        "/products",
      );


      router.refresh();
    } catch (cause) {
      saveLockRef.current =
        false;


      setSaving(
        false,
      );


      setError(
        errorMessage(
          cause,
          "Unable to save product.",
        ),
      );
    }
  }

  function applyBarcodeToVariant(
    targetId: string,
    value: string,
  ) {
    const barcode =
      value.trim();


    if (
      !barcode
    ) {
      return {
        accepted:
          false,

        message:
          "No barcode value was detected.",
      };
    }


    if (
      parseNovaQrValue(
        barcode,
      )
    ) {
      return {
        accepted:
          false,

        message:
          "That is a ARC QR code. Scan the manufacturer's barcode printed on the product instead.",
      };
    }


    const target =
      variants.find(
        (
          variant,
        ) =>
          variant.clientId ===
          targetId,
      );


    if (
      !target
    ) {
      return {
        accepted:
          false,

        message:
          "The target variant is no longer available.",
      };
    }


    const duplicate =
      variants.find(
        (
          variant,
        ) =>
          variant.clientId !==
            targetId &&
          variant.barcode
            ?.trim() ===
            barcode,
      );


    if (
      duplicate
    ) {
      return {
        accepted:
          false,

        message:
          `That barcode is already entered for ${duplicate.name || "another variant"}.`,
      };
    }


    updateVariant(
      targetId,
      {
        barcode,

        sku:
          target.sku.trim()
            ? target.sku
            : `BC-${barcode}`
                .toUpperCase(),
      },
    );


    return {
      accepted:
        true,

      label:
        barcode,

      message:
        `Barcode added to ${target.name || "variant"}.`,
    };
  }


  function handleBarcodeScan(
    value: string,
  ) {
    const targetId =
      barcodeScannerTarget;


    if (
      !targetId
    ) {
      return false;
    }


    return applyBarcodeToVariant(
      targetId,
      value,
    ).accepted;
  }


  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      {error && (
        <div
          ref={feedbackRef}
          className="rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          ref={feedbackRef}
          className="rounded-[16px] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300"
        >
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
                          setImagePath("");
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
                    ARC automatically
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
          PRODUCT PROMOTION
      ========================== */}

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-[14px] bg-primary/10 p-2 text-primary">
              <BadgePercent className="h-5 w-5" />
            </div>

            <div>
              <CardTitle>
                Product promotion
              </CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Apply a temporary percentage or fixed-value discount. ARC keeps the normal selling price and uses the discounted price automatically in POS and checkout.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <label className="flex items-center justify-between gap-4 rounded-[18px] border bg-muted/20 p-4">
            <div>
              <p className="text-sm font-semibold">
                Enable promotion
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Disable this anytime to restore the normal selling price.
              </p>
            </div>

            <input
              type="checkbox"
              checked={
                promotionEnabled
              }
              onChange={(event) =>
                setPromotionEnabled(
                  event.target.checked,
                )
              }
              className="h-5 w-5 accent-primary"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>
                Discount type
              </FieldLabel>

              <Select
                value={
                  promotionType
                }
                disabled={
                  !promotionEnabled
                }
                onChange={(event) =>
                  setPromotionType(
                    event.target
                      .value as PromotionType,
                  )
                }
              >
                <option value="percentage">
                  Percentage (%)
                </option>

                <option value="fixed">
                  Fixed amount (LKR)
                </option>
              </Select>
            </div>

            <div>
              <FieldLabel>
                {promotionType ===
                "percentage"
                  ? "Discount percentage"
                  : "Discount amount (LKR)"}
              </FieldLabel>

              <Input
                type="number"
                min="0"
                max={
                  promotionType ===
                  "percentage"
                    ? "99.99"
                    : undefined
                }
                step="0.01"
                disabled={
                  !promotionEnabled
                }
                value={
                  numberInputValue(
                    promotionValue,
                  )
                }
                onChange={(event) =>
                  setPromotionValue(
                    parseNumberInput(
                      event.target.value,
                    ),
                  )
                }
              />
            </div>

            <div>
              <FieldLabel>
                Starts at (optional)
              </FieldLabel>

              <Input
                type="datetime-local"
                disabled={
                  !promotionEnabled
                }
                value={
                  promotionStartsAt
                }
                onChange={(event) =>
                  setPromotionStartsAt(
                    event.target.value,
                  )
                }
              />
            </div>

            <div>
              <FieldLabel>
                Ends at (optional)
              </FieldLabel>

              <Input
                type="datetime-local"
                disabled={
                  !promotionEnabled
                }
                value={
                  promotionEndsAt
                }
                onChange={(event) =>
                  setPromotionEndsAt(
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          {promotionEnabled && (
            <div className="rounded-[16px] border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="font-semibold text-primary">
                Promotion active
              </p>

              <p className="mt-1 text-muted-foreground">
                {promotionType ===
                "percentage"
                  ? Number.isFinite(
                      promotionValue,
                    )
                    ? `${promotionValue}% off the normal selling price`
                    : "Enter a discount value"
                  : Number.isFinite(
                      promotionValue,
                    )
                    ? `LKR ${promotionValue.toFixed(2)} off each unit`
                    : "Enter a discount value"}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                {promotionStartsAt
                  ? `Starts ${new Date(
                      promotionStartsAt,
                    ).toLocaleString()}`
                  : "Starts immediately"}

                {" · "}

                {promotionEndsAt
                  ? `Ends ${new Date(
                      promotionEndsAt,
                    ).toLocaleString()}`
                  : "No end date"}
              </p>
            </div>
          )}
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
              Each variant has its own permanent ARC QR identity and independent stock. Manufacturer barcodes are completely optional.
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

          <div className="rounded-[20px] border bg-background p-4">

            <label className="flex cursor-pointer items-start justify-between gap-4">

              <div>
                <p className="text-sm font-semibold">
                  Sell in multiple units
                </p>

                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                  Enable only for products that can be physically opened or converted, such as Pack of 6 → Singles. Sealed and loose stock stay separate.
                </p>
              </div>

              <input
                type="checkbox"
                checked={
                  multiUnitEnabled
                }
                onChange={
                  (
                    event,
                  ) =>
                    setMultiUnitEnabled(
                      event.target.checked,
                    )
                }
                className="mt-1 h-4 w-4 shrink-0"
              />

            </label>

          </div>


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

                    {/* Barcode */}

                    <div>
                      <FieldLabel>
                        Manufacturer barcode (optional)
                      </FieldLabel>

                      <div className="flex flex-wrap gap-2">

                        <Input
                          value={
                            variant.barcode ??
                            ""
                          }
                          onChange={(
                            event,
                          ) =>
                            updateVariant(
                              variant.clientId,
                              {
                                barcode:
                                  event.target.value.trim(),
                              },
                            )
                          }
                          placeholder="EAN / UPC / Code128"
                          maxLength={128}
                          className="min-w-[180px] flex-1 font-mono"
                        />


                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() =>
                            setBarcodeScannerTarget(
                              variant.clientId,
                            )
                          }
                          aria-label="Scan manufacturer barcode with this device"
                          title="Scan with this device"
                        >
                          <ScanLine className="h-4 w-4" />
                        </Button>


                        <RemoteScannerControl
                          onScan={(
                            value,
                          ) =>
                            applyBarcodeToVariant(
                              variant.clientId,
                              value,
                            )
                          }
                        />

                      </div>

                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Leave this blank if the product has no barcode or you do not want to use barcode scanning. You can type or scan an existing manufacturer barcode at any time later.
                      </p>
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
                          numberInputValue(
                            variant.price,
                          )
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              price:
                                parseNumberInput(
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
                          numberInputValue(
                            variant.cost,
                          )
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              cost:
                                parseNumberInput(
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
                          numberInputValue(
                            variant.lowStockThreshold,
                          )
                        }
                        onChange={(
                          event,
                        ) =>
                          updateVariant(
                            variant.clientId,
                            {
                              lowStockThreshold:
                                parseNumberInput(
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
                            numberInputValue(
                              variant.initialStock,
                            )
                          }
                          onChange={(
                            event,
                          ) =>
                            updateVariant(
                              variant.clientId,
                              {
                                initialStock:
                                parseNumberInput(
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

                    {multiUnitEnabled && (

                      <div className="md:col-span-2 lg:col-span-4">

                        <div className="rounded-[18px] border bg-background p-4">

                          <label className="flex cursor-pointer items-start justify-between gap-4">

                            <div>
                              <p className="text-sm font-semibold">
                                This is a loose / smaller unit
                              </p>

                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                Link this variant to the sealed unit that ARC should open when more loose stock is needed.
                              </p>
                            </div>

                            <input
                              type="checkbox"
                              checked={
                                Boolean(
                                  variant.unitParentClientId,
                                )
                              }
                              onChange={
                                (
                                  event,
                                ) =>
                                  updateVariant(
                                    variant.clientId,
                                    event.target.checked
                                      ? {
                                          unitParentClientId:
                                            variants.find(
                                              (candidate) =>
                                                candidate.clientId !==
                                                variant.clientId,
                                            )?.clientId,
                                          unitsPerParent:
                                            variant.unitsPerParent ??
                                            2,
                                        }
                                      : {
                                          unitParentClientId:
                                            undefined,
                                          unitsPerParent:
                                            undefined,
                                        },
                                  )
                              }
                              disabled={
                                variants.length <
                                2
                              }
                              className="mt-1 h-4 w-4 shrink-0"
                            />

                          </label>


                          {variant.unitParentClientId && (

                            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_150px]">

                              <div>
                                <FieldLabel>
                                  Parent / sealed unit
                                </FieldLabel>

                                <Select
                                  value={
                                    variant.unitParentClientId
                                  }
                                  onChange={
                                    (
                                      event,
                                    ) =>
                                      updateVariant(
                                        variant.clientId,
                                        {
                                          unitParentClientId:
                                            event.target.value,
                                        },
                                      )
                                  }
                                >
                                  {variants
                                    .filter(
                                      (candidate) =>
                                        candidate.clientId !==
                                        variant.clientId,
                                    )
                                    .map(
                                      (candidate) => (
                                        <option
                                          key={
                                            candidate.clientId
                                          }
                                          value={
                                            candidate.clientId
                                          }
                                        >
                                          {candidate.name || "Unnamed"} · {candidate.sku || "No SKU"}
                                        </option>
                                      ),
                                    )}
                                </Select>
                              </div>


                              <div>
                                <FieldLabel>
                                  Units produced
                                </FieldLabel>

                                <Input
                                  type="number"
                                  min="2"
                                  step="1"
                                  value={
                                    numberInputValue(
                                      variant.unitsPerParent ??
                                      2,
                                    )
                                  }
                                  onChange={
                                    (
                                      event,
                                    ) =>
                                      updateVariant(
                                        variant.clientId,
                                        {
                                          unitsPerParent:
                                            parseNumberInput(
                                              event.target.value,
                                            ),
                                        },
                                      )
                                  }
                                />
                              </div>


                              <p className="md:col-span-2 text-[11px] leading-5 text-muted-foreground">
                                1 {
                                  variants.find(
                                    (candidate) =>
                                      candidate.clientId ===
                                      variant.unitParentClientId,
                                  )?.name ||
                                  "parent unit"
                                } opens into {
                                  Number.isFinite(
                                    variant.unitsPerParent,
                                  )
                                    ? variant.unitsPerParent
                                    : "—"
                                } {
                                  variant.name ||
                                  "child units"
                                }. ARC does not convert stock until a pack is actually opened.
                              </p>

                            </div>

                          )}

                        </div>

                      </div>

                    )}


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
                            Permanent ARC
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
      <Scanner
        isOpen={
          Boolean(
            barcodeScannerTarget,
          )
        }
        onClose={() =>
          setBarcodeScannerTarget(
            null,
          )
        }
        onScan={
          handleBarcodeScan
        }
      />

    </form>
  );
}