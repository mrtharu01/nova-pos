"use client";

import * as React from "react";

import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  Printer,
  ReceiptText,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

import {
  ReceiptSettingsPreview,
} from "@/components/settings/ReceiptSettingsPreview";

import {
  Button,
} from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Input,
} from "@/components/ui/input";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  deleteReceiptLogo,
  uploadReceiptLogo,
} from "@/lib/data/receipt-logo";

import {
  fetchReceiptSettings,
  saveReceiptSettings,
} from "@/lib/data/receipt-settings";

import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettingsForm,
} from "@/lib/domain/receipt-settings";


type ReceiptSettingsClientProps = {
  embedded?: boolean;
};


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }


  if (
    error &&
    typeof error ===
      "object" &&
    "message" in error
  ) {
    const message =
      (
        error as {
          message?: unknown;
        }
      ).message;


    if (
      typeof message ===
      "string"
    ) {
      return message;
    }
  }


  return "Receipt settings could not be saved.";
}


export function ReceiptSettingsClient({
  embedded = false,
}: ReceiptSettingsClientProps) {
  const {
    business,
  } =
    useCurrentBusiness();


  const [
    settings,
    setSettings,
  ] =
    React.useState<
      ReceiptSettingsForm
    >({
      ...DEFAULT_RECEIPT_SETTINGS,
    });


  const [
    savedSettings,
    setSavedSettings,
  ] =
    React.useState<
      ReceiptSettingsForm | null
    >(null);


  const [
    loading,
    setLoading,
  ] =
    React.useState(
      true,
    );


  const [
    saving,
    setSaving,
  ] =
    React.useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    success,
    setSuccess,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    pendingLogoFile,
    setPendingLogoFile,
  ] =
    React.useState<
      File | null
    >(
      null,
    );


  const [
    pendingLogoPreview,
    setPendingLogoPreview,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const [
    logoRemovalRequested,
    setLogoRemovalRequested,
  ] =
    React.useState(
      false,
    );


  const logoInputRef =
    React.useRef<
      HTMLInputElement | null
    >(
      null,
    );


  const saveLockRef =
    React.useRef(
      false,
    );


  const feedbackRef =
    React.useRef<
      HTMLDivElement | null
    >(
      null,
    );


  React.useEffect(
    () =>
      () => {
        if (
          pendingLogoPreview
        ) {
          URL.revokeObjectURL(
            pendingLogoPreview,
          );
        }
      },
    [
      pendingLogoPreview,
    ],
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


  /* ==========================================================
     LOAD SETTINGS
  ========================================================== */

  React.useEffect(() => {
    if (
      !business?.id
    ) {
      return;
    }


    let cancelled =
      false;


    async function load() {
      setLoading(
        true,
      );

      setError(
        null,
      );


      try {
        const result =
          await fetchReceiptSettings(
            business!.id,
          );


        if (
          cancelled
        ) {
          return;
        }


        setSettings(
          result,
        );


        setSavedSettings(
          result,
        );
      } catch (cause) {
        if (
          cancelled
        ) {
          return;
        }


        setError(
          getErrorMessage(
            cause,
          ),
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false,
          );
        }
      }
    }


    void load();


    return () => {
      cancelled =
        true;
    };
  }, [
    business?.id,
  ]);


  /* ==========================================================
     UNSAVED CHANGES
  ========================================================== */

  const dirty =
    React.useMemo(
      () =>
        Boolean(
          pendingLogoFile,
        ) ||
        logoRemovalRequested ||
        (
          savedSettings
            ? JSON.stringify(
                settings,
              ) !==
              JSON.stringify(
                savedSettings,
              )
            : false
        ),
      [
        settings,
        savedSettings,
        pendingLogoFile,
        logoRemovalRequested,
      ],
    );


  /* ==========================================================
     UPDATE FIELD
  ========================================================== */

  function update<
    K extends keyof
      ReceiptSettingsForm,
  >(
    key: K,
    value:
      ReceiptSettingsForm[K],
  ) {
    setSettings(
      (current) => ({
        ...current,

        [key]:
          value,
      }),
    );


    setSuccess(
      null,
    );


    setError(
      null,
    );
  }


  function chooseLogo(
    file:
      File | null,
  ) {
    if (
      !file
    ) {
      return;
    }


    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(
        file.type,
      )
    ) {
      setError(
        "Use a JPG, PNG, or WebP image for the receipt logo.",
      );


      return;
    }


    if (
      file.size >
      12 * 1024 * 1024
    ) {
      setError(
        "The original logo image must be 12 MB or smaller.",
      );


      return;
    }


    if (
      pendingLogoPreview
    ) {
      URL.revokeObjectURL(
        pendingLogoPreview,
      );
    }


    setPendingLogoFile(
      file,
    );


    setPendingLogoPreview(
      URL.createObjectURL(
        file,
      ),
    );


    setLogoRemovalRequested(
      false,
    );


    setError(
      null,
    );


    setSuccess(
      null,
    );
  }


  function removeLogo() {
    if (
      pendingLogoPreview
    ) {
      URL.revokeObjectURL(
        pendingLogoPreview,
      );
    }


    setPendingLogoFile(
      null,
    );


    setPendingLogoPreview(
      null,
    );


    setLogoRemovalRequested(
      true,
    );


    setSettings(
      (
        current,
      ) => ({
        ...current,

        logoUrl:
          "",

        logoPath:
          "",
      }),
    );


    setError(
      null,
    );


    setSuccess(
      null,
    );
  }


  /* ==========================================================
     SAVE
  ========================================================== */

  async function save() {
    if (
      saveLockRef.current ||
      !business?.id ||
      saving
    ) {
      return;
    }


    if (
      settings.email.trim() &&
      !settings.email.includes(
        "@",
      )
    ) {
      setError(
        "Enter a valid business email address.",
      );

      return;
    }


    if (
      !settings.footerMessage.trim()
    ) {
      setError(
        "Receipt footer message cannot be empty.",
      );

      return;
    }


    saveLockRef.current =
      true;


    setSaving(
      true,
    );


    setError(
      null,
    );


    setSuccess(
      null,
    );


    let uploadedLogo:
      Awaited<
        ReturnType<
          typeof uploadReceiptLogo
        >
      > | null =
        null;


    try {
      const previousLogoPath =
        savedSettings?.logoPath ??
        "";


      let nextSettings:
        ReceiptSettingsForm = {
          ...settings,
        };


      if (
        pendingLogoFile
      ) {
        uploadedLogo =
          await uploadReceiptLogo({
            businessId:
              business.id,

            file:
              pendingLogoFile,
          });


        nextSettings = {
          ...nextSettings,

          logoUrl:
            uploadedLogo.signedUrl,

          logoPath:
            uploadedLogo.path,
        };
      } else if (
        logoRemovalRequested
      ) {
        nextSettings = {
          ...nextSettings,

          logoUrl:
            "",

          logoPath:
            "",
        };
      }


      const saved =
        await saveReceiptSettings(
          business.id,
          nextSettings,
        );


      if (
        pendingLogoPreview
      ) {
        URL.revokeObjectURL(
          pendingLogoPreview,
        );
      }


      setPendingLogoFile(
        null,
      );


      setPendingLogoPreview(
        null,
      );


      setLogoRemovalRequested(
        false,
      );


      setSettings(
        saved,
      );


      setSavedSettings(
        saved,
      );


      if (
        previousLogoPath &&
        previousLogoPath !==
          saved.logoPath
      ) {
        void deleteReceiptLogo(
          previousLogoPath,
        ).catch(
          () => {
            // Settings already point to the new logo.
            // Old-file cleanup is best-effort only.
          },
        );
      }


      setSuccess(
        pendingLogoFile ||
        logoRemovalRequested
          ? "Receipt logo and settings saved successfully."
          : "Receipt settings saved successfully.",
      );


      window.setTimeout(
        () => {
          setSuccess(
            null,
          );
        },
        2500,
      );
    } catch (cause) {
      if (
        uploadedLogo?.path
      ) {
        try {
          await deleteReceiptLogo(
            uploadedLogo.path,
          );
        } catch {
          // Preserve the original save error.
        }
      }


      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      saveLockRef.current =
        false;


      setSaving(
        false,
      );
    }
  }


  /* ==========================================================
     UNDO
  ========================================================== */

  function reset() {
    if (
      savedSettings
    ) {
      if (
        pendingLogoPreview
      ) {
        URL.revokeObjectURL(
          pendingLogoPreview,
        );
      }


      setPendingLogoFile(
        null,
      );


      setPendingLogoPreview(
        null,
      );


      setLogoRemovalRequested(
        false,
      );


      setSettings({
        ...savedSettings,
      });


      setError(
        null,
      );


      setSuccess(
        null,
      );


      return;
    }


    setSettings({
      ...DEFAULT_RECEIPT_SETTINGS,
    });
  }


  /* ==========================================================
     LOADING CONTENT
  ========================================================== */

  if (
    loading
  ) {
    const loadingContent =
      (
        <div className="flex min-h-[40vh] flex-col items-center justify-center">

          <Loader2 className="h-8 w-8 animate-spin text-primary" />


          <p className="mt-4 text-sm text-muted-foreground">
            Loading receipt settings…
          </p>

        </div>
      );


    if (
      embedded
    ) {
      return loadingContent;
    }


    return (
      <AppLayout title="Receipt & Printer">

        {loadingContent}

      </AppLayout>
    );
  }


  /* ==========================================================
     MAIN CONTENT
  ========================================================== */

  const content =
    (
      <div className="space-y-5">

        {/* =========================================
            HEADER
        ========================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

          <div>

            <div className="flex items-center gap-2">

              <ReceiptText className="h-5 w-5 text-primary" />


              <h2 className="text-xl font-bold">
                Receipt & Printer
              </h2>

            </div>


            <p className="mt-1 text-sm text-muted-foreground">
              Configure how ARC receipts look and behave when a sale is completed.
            </p>

          </div>


          <div className="flex gap-2">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              disabled={
                saving ||
                !dirty
              }
              onClick={
                reset
              }
            >

              <RotateCcw className="mr-2 h-4 w-4" />

              Undo

            </Button>


            <Button
              type="button"
              className="rounded-[14px]"
              disabled={
                saving ||
                !dirty
              }
              onClick={() =>
                void save()
              }
            >

              {saving ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : (

                <Save className="mr-2 h-4 w-4" />

              )}


              {saving
                ? "Saving…"
                : "Save Settings"}

            </Button>

          </div>

        </div>


        {/* =========================================
            STATUS
        ========================================== */}

        {error && (

          <div
            ref={
              feedbackRef
            }
            className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
          >

            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

            {error}

          </div>

        )}


        {success && (

          <div
            ref={
              feedbackRef
            }
            className="flex items-start gap-2 rounded-[16px] border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300"
          >

            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />

            {success}

          </div>

        )}


        {dirty && (

          <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">

            You have unsaved receipt changes.

          </div>

        )}


        {/* =========================================
            MAIN GRID
        ========================================== */}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">

          {/* =====================================
              LEFT SETTINGS
          ====================================== */}

          <div className="space-y-5">

            {/* ===================================
                PRINTER
            ==================================== */}

            <Card className="rounded-[24px]">

              <CardHeader>

                <div className="flex items-center gap-2">

                  <Printer className="h-5 w-5" />

                  <CardTitle>
                    Printer
                  </CardTitle>

                </div>

              </CardHeader>


              <CardContent className="space-y-5">

                <div>

                  <p className="text-sm font-semibold">
                    Thermal paper width
                  </p>


                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose the paper width used by your receipt printer.
                  </p>


                  <div className="mt-3 grid grid-cols-2 gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "paperWidth",
                          "58mm",
                        )
                      }
                      className={`rounded-[18px] border p-4 text-left transition-all ${
                        settings.paperWidth ===
                        "58mm"
                          ? "border-primary bg-primary/10 ring-2 ring-primary/10"
                          : "bg-background hover:bg-muted/40"
                      }`}
                    >

                      <p className="font-bold">
                        58mm
                      </p>


                      <p className="mt-1 text-xs text-muted-foreground">
                        Compact portable printers
                      </p>

                    </button>


                    <button
                      type="button"
                      onClick={() =>
                        update(
                          "paperWidth",
                          "80mm",
                        )
                      }
                      className={`rounded-[18px] border p-4 text-left transition-all ${
                        settings.paperWidth ===
                        "80mm"
                          ? "border-primary bg-primary/10 ring-2 ring-primary/10"
                          : "bg-background hover:bg-muted/40"
                      }`}
                    >

                      <p className="font-bold">
                        80mm
                      </p>


                      <p className="mt-1 text-xs text-muted-foreground">
                        Recommended supermarket format
                      </p>

                    </button>

                  </div>

                </div>


                <SettingToggle
                  title="Open print dialog automatically"
                  description="After a successful sale ARC automatically opens the browser print dialog."
                  checked={
                    settings.autoPrint
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "autoPrint",
                      value,
                    )
                  }
                />


                <div className="rounded-[16px] border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-700 dark:text-amber-300">

                  Normal browsers cannot silently print without showing the system print dialog.

                  Dedicated direct-print support can be added later for ARC&apos;s desktop/offline mode.

                </div>

              </CardContent>

            </Card>


            {/* ===================================
                RECEIPT HEADER
            ==================================== */}

            <Card className="rounded-[24px]">

              <CardHeader>

                <CardTitle>
                  Receipt Header
                </CardTitle>

              </CardHeader>


              <CardContent className="grid gap-4 sm:grid-cols-2">

                <div className="sm:col-span-2">

                  <input
                    ref={
                      logoInputRef
                    }
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(
                      event,
                    ) => {
                      chooseLogo(
                        event.target
                          .files?.[0] ??
                        null,
                      );


                      event.currentTarget.value =
                        "";
                    }}
                  />


                  <div className="rounded-[18px] border bg-muted/20 p-4">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">

                      <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border bg-white p-3">

                        {(
                          pendingLogoPreview ||
                          settings.logoUrl
                        ) ? (

                          <img
                            src={
                              pendingLogoPreview ??
                              settings.logoUrl
                            }
                            alt="Receipt logo preview"
                            className="max-h-full max-w-full object-contain"
                          />

                        ) : (

                          <div className="text-center text-muted-foreground">

                            <ImagePlus className="mx-auto h-6 w-6" />


                            <p className="mt-2 text-[10px] font-medium">
                              No logo
                            </p>

                          </div>

                        )}

                      </div>


                      <div className="min-w-0 flex-1">

                        <p className="text-sm font-semibold">
                          Business logo
                        </p>


                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          JPG, PNG or WebP. ARC converts it to an optimized WebP for thermal receipts.
                        </p>


                        <div className="mt-3 flex flex-wrap gap-2">

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-[12px]"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              logoInputRef.current
                                ?.click()
                            }
                          >

                            <ImagePlus className="mr-2 h-4 w-4" />

                            {(
                              pendingLogoPreview ||
                              settings.logoUrl
                            )
                              ? "Replace Logo"
                              : "Upload Logo"}

                          </Button>


                          {(
                            pendingLogoPreview ||
                            settings.logoUrl
                          ) && (

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="rounded-[12px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={
                                saving
                              }
                              onClick={
                                removeLogo
                              }
                            >

                              <Trash2 className="mr-2 h-4 w-4" />

                              Remove

                            </Button>

                          )}

                        </div>


                        {pendingLogoFile && (

                          <p className="mt-2 truncate text-[10px] text-primary">
                            Ready to upload:{" "}
                            {
                              pendingLogoFile.name
                            }
                          </p>

                        )}

                      </div>

                    </div>

                  </div>

                </div>


                <Field
                  label="Display name"
                  placeholder={
                    business?.name ??
                    "Business name"
                  }
                  value={
                    settings.displayName
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "displayName",
                      value,
                    )
                  }
                  description="Leave blank to use the business name."
                  className="sm:col-span-2"
                />


                <Field
                  label="Address line 1"
                  placeholder="123 Main Street"
                  value={
                    settings.addressLine1
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "addressLine1",
                      value,
                    )
                  }
                />


                <Field
                  label="Address line 2"
                  placeholder="Kandy, Sri Lanka"
                  value={
                    settings.addressLine2
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "addressLine2",
                      value,
                    )
                  }
                />


                <Field
                  label="Phone"
                  placeholder="081 000 0000"
                  value={
                    settings.phone
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "phone",
                      value,
                    )
                  }
                />


                <Field
                  label="Business email"
                  placeholder="business@example.com"
                  value={
                    settings.email
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "email",
                      value,
                    )
                  }
                />


                <Field
                  label="Tax / registration number"
                  placeholder="Optional"
                  value={
                    settings.taxRegistrationNumber
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "taxRegistrationNumber",
                      value,
                    )
                  }
                  className="sm:col-span-2"
                />

              </CardContent>

            </Card>


            {/* ===================================
                CONTENT
            ==================================== */}

            <Card className="rounded-[24px]">

              <CardHeader>

                <div className="flex items-center gap-2">

                  <Settings2 className="h-5 w-5" />

                  <CardTitle>
                    Receipt Content
                  </CardTitle>

                </div>

              </CardHeader>


              <CardContent className="space-y-4">

                <SettingToggle
                  title="Show SKU"
                  description="Print the product variant SKU under each item."
                  checked={
                    settings.showSku
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "showSku",
                      value,
                    )
                  }
                />


                <SettingToggle
                  title="Show cashier"
                  description="Print the cashier identity on the receipt."
                  checked={
                    settings.showCashier
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "showCashier",
                      value,
                    )
                  }
                />


                <SettingToggle
                  title="Show customer"
                  description="Print saved customer details when a sale contains them."
                  checked={
                    settings.showCustomer
                  }
                  onChange={(
                    value,
                  ) =>
                    update(
                      "showCustomer",
                      value,
                    )
                  }
                />


                <div>

                  <label className="text-sm font-semibold">
                    Footer message
                  </label>


                  <p className="mt-1 text-xs text-muted-foreground">
                    This appears at the bottom of every printed receipt.
                  </p>


                  <textarea
                    value={
                      settings.footerMessage
                    }
                    onChange={(
                      event,
                    ) =>
                      update(
                        "footerMessage",
                        event.target.value,
                      )
                    }
                    rows={3}
                    maxLength={300}
                    className="mt-3 w-full resize-none rounded-[16px] border bg-background px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/10"
                    placeholder="Thank you for shopping with us!"
                  />


                  <p className="mt-1 text-right text-[10px] text-muted-foreground">
                    {
                      settings.footerMessage.length
                    }
                    /300
                  </p>

                </div>

              </CardContent>

            </Card>

          </div>


          {/* =====================================
              LIVE PREVIEW
          ====================================== */}

          <div>

            <div className="sticky top-5">

              <Card className="overflow-hidden rounded-[24px]">

                <CardHeader>

                  <div className="flex items-center justify-between gap-3">

                    <div>

                      <CardTitle>
                        Live Preview
                      </CardTitle>


                      <p className="mt-1 text-xs text-muted-foreground">
                        Preview only — no sale will be created.
                      </p>

                    </div>


                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-[12px]"
                      onClick={() =>
                        window.print()
                      }
                    >

                      <Printer className="mr-2 h-4 w-4" />

                      Test Print

                    </Button>

                  </div>

                </CardHeader>


                <CardContent>

                  <div className="max-h-[70vh] overflow-auto rounded-[20px] bg-muted/60 p-4">

                    <ReceiptSettingsPreview
                      settings={
                        settings
                      }
                      businessName={
                        business?.name ??
                        "ARC"
                      }
                      currencyCode={
                        business?.currency_code ??
                        "LKR"
                      }
                      logoPreviewUrl={
                        pendingLogoPreview ??
                        undefined
                      }
                    />

                  </div>

                </CardContent>

              </Card>

            </div>

          </div>

        </div>

      </div>
    );


  /* ==========================================================
     EMBEDDED MODE
  ========================================================== */

  if (
    embedded
  ) {
    return content;
  }


  /* ==========================================================
     STANDALONE MODE
  ========================================================== */

  return (
    <AppLayout title="Receipt & Printer">

      {content}

    </AppLayout>
  );
}


/* ============================================================
   FIELD
============================================================ */

function Field({
  label,
  description,
  value,
  placeholder,
  onChange,
  className = "",
}: {
  label: string;

  description?: string;

  value: string;

  placeholder?: string;

  onChange:
    (
      value: string,
    ) => void;

  className?: string;
}) {
  return (
    <div
      className={
        className
      }
    >

      <label className="text-sm font-semibold">
        {label}
      </label>


      {description && (

        <p className="mt-1 text-xs text-muted-foreground">
          {description}
        </p>

      )}


      <Input
        value={
          value
        }
        placeholder={
          placeholder
        }
        className="mt-2 h-11 rounded-[14px]"
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
      />

    </div>
  );
}


/* ============================================================
   TOGGLE
============================================================ */

function SettingToggle({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;

  description: string;

  checked: boolean;

  onChange:
    (
      value: boolean,
    ) => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-4 rounded-[18px] border bg-background p-4 text-left transition-colors hover:bg-muted/30"
      onClick={() =>
        onChange(
          !checked,
        )
      }
    >

      <div className="min-w-0">

        <p className="text-sm font-semibold">
          {title}
        </p>


        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {description}
        </p>

      </div>


      <div
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked
            ? "bg-primary"
            : "bg-muted-foreground/20"
        }`}
      >

        <div
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked
              ? "translate-x-6"
              : "translate-x-1"
          }`}
        />

      </div>

    </button>
  );
}