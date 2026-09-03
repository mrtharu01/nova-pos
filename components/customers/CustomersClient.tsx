"use client";

import * as React from "react";

import {
  CircleDollarSign,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  TriangleAlert,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  AppLayout,
} from "@/components/layout/AppLayout";

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
  Dialog,
} from "@/components/ui/dialog";

import {
  useCurrentBusiness,
} from "@/hooks/use-current-business";

import {
  fetchCustomerDetail,
  listCustomers,
  saveCustomer,
} from "@/lib/data/customers";

import type {
  CustomerDetail,
  CustomerSummary,
} from "@/lib/domain/customers";

import {
  formatSaleMoney,
  saleStatusLabel,
} from "@/lib/domain/sales";


/* ============================================================
   ERROR
============================================================ */

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Something went wrong.";
}


/* ============================================================
   DATE
============================================================ */

function formatDate(
  value:
    | string
    | null,
) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(
    "en-LK",
    {
      year:
        "numeric",

      month:
        "short",

      day:
        "numeric",
    },
  ).format(
    new Date(
      value,
    ),
  );
}


/* ============================================================
   CUSTOMERS PAGE
============================================================ */

export function CustomersClient() {
  const {
    business,
  } =
    useCurrentBusiness();


  const [
    customers,
    setCustomers,
  ] =
    React.useState<
      CustomerSummary[]
    >([]);


  const [
    search,
    setSearch,
  ] =
    React.useState("");


  const [
    loading,
    setLoading,
  ] =
    React.useState(true);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  const [
    addOpen,
    setAddOpen,
  ] =
    React.useState(false);


  const [
    editOpen,
    setEditOpen,
  ] =
    React.useState(false);


  const [
    selected,
    setSelected,
  ] =
    React.useState<
      CustomerDetail | null
    >(null);


  const [
    detailLoading,
    setDetailLoading,
  ] =
    React.useState(false);


  /* ==========================================================
     LOAD CUSTOMER LIST
  ========================================================== */

  const load =
    React.useCallback(
      async () => {
        if (
          !business?.id
        ) {
          return;
        }


        setLoading(true);

        setError(null);


        try {
          const result =
            await listCustomers({
              businessId:
                business.id,

              search,
            });


          setCustomers(
            result,
          );
        } catch (cause) {
          setError(
            getErrorMessage(
              cause,
            ),
          );
        } finally {
          setLoading(false);
        }
      },
      [
        business?.id,
        search,
      ],
    );


  React.useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void load();
        },
        search
          ? 250
          : 0,
      );


    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    load,
    search,
  ]);


  /* ==========================================================
     OPEN CUSTOMER
  ========================================================== */

  async function openCustomer(
    customerId: string,
  ) {
    if (
      !business?.id
    ) {
      return;
    }


    setDetailLoading(true);

    setError(null);


    try {
      const result =
        await fetchCustomerDetail({
          businessId:
            business.id,

          customerId,
        });


      setSelected(
        result,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setDetailLoading(false);
    }
  }


  /* ==========================================================
     CUSTOMER SAVED
  ========================================================== */

  async function handleCustomerSaved(
    customerId: string,
  ) {
    setAddOpen(false);

    setEditOpen(false);


    await load();


    await openCustomer(
      customerId,
    );
  }


  const totalCustomers =
    customers.length;


  const totalPoints =
    customers.reduce(
      (
        total,
        customer,
      ) =>
        total +
        customer.loyaltyPoints,
      0,
    );


  const repeatCustomers =
    customers.filter(
      (customer) =>
        customer.visits >
        1,
    ).length;


  return (
    <AppLayout title="Customers">

      {/* ======================================================
          HEADER
      ======================================================= */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="text-2xl font-bold tracking-tight">
            Customers
          </h1>


          <p className="mt-1 text-sm text-muted-foreground">
            Customer profiles, purchase history and loyalty activity.
          </p>

        </div>


        <Button
          type="button"
          className="rounded-[14px]"
          onClick={() =>
            setAddOpen(
              true,
            )
          }
        >

          <Plus className="mr-2 h-4 w-4" />

          Add Customer

        </Button>

      </div>


      {/* ======================================================
          SUMMARY
      ======================================================= */}

      <div className="grid gap-4 sm:grid-cols-3">

        <SummaryCard
          icon={
            <Users className="h-5 w-5" />
          }
          label="Customers"
          value={
            totalCustomers.toString()
          }
        />


        <SummaryCard
          icon={
            <Sparkles className="h-5 w-5" />
          }
          label="Active loyalty points"
          value={
            totalPoints.toLocaleString()
          }
        />


        <SummaryCard
          icon={
            <ShoppingBag className="h-5 w-5" />
          }
          label="Repeat customers"
          value={
            repeatCustomers.toString()
          }
        />

      </div>


      {/* ======================================================
          SEARCH
      ======================================================= */}

      <div className="mt-5 flex items-center rounded-[16px] border bg-card px-4">

        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />


        <input
          value={
            search
          }
          onChange={(
            event,
          ) =>
            setSearch(
              event.target.value,
            )
          }
          placeholder="Search name, phone or email..."
          className="h-12 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
        />


        {search && (

          <button
            type="button"
            onClick={() =>
              setSearch("")
            }
            className="rounded-[10px] p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >

            <X className="h-4 w-4" />

          </button>

        )}

      </div>


      {/* ======================================================
          ERROR
      ======================================================= */}

      {error && (

        <div className="mt-5 flex items-start gap-3 rounded-[18px] border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">

          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

          {
            error
          }

        </div>

      )}


      {/* ======================================================
          DIRECTORY
      ======================================================= */}

      <Card className="mt-5 overflow-hidden rounded-[24px]">

        <CardHeader>

          <CardTitle>
            Customer Directory
          </CardTitle>

        </CardHeader>


        <CardContent>

          {loading ? (

            <div className="flex min-h-[260px] flex-col items-center justify-center">

              <Loader2 className="h-7 w-7 animate-spin text-primary" />


              <p className="mt-3 text-sm text-muted-foreground">
                Loading customers…
              </p>

            </div>

          ) : customers.length ===
            0 ? (

            <div className="flex min-h-[260px] flex-col items-center justify-center text-center">

              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-muted">
                <UserRound className="h-6 w-6" />
              </div>


              <p className="mt-4 font-semibold">
                No customers found
              </p>


              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Register customers to track purchases, loyalty points and permanent discounts.
              </p>

            </div>

          ) : (

            <div className="grid gap-3">

              {customers.map(
                (customer) => (

                  <button
                    key={
                      customer.id
                    }
                    type="button"
                    disabled={
                      detailLoading
                    }
                    onClick={() =>
                      void openCustomer(
                        customer.id,
                      )
                    }
                    className="rounded-[18px] border bg-background p-4 text-left transition-colors hover:bg-muted/30 disabled:opacity-60"
                  >

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-muted font-bold">

                          {
                            customer.name
                              .slice(
                                0,
                                1,
                              )
                              .toUpperCase()
                          }

                        </div>


                        <div className="min-w-0">

                          <div className="flex flex-wrap items-center gap-2">

                            <p className="truncate font-semibold">
                              {
                                customer.name
                              }
                            </p>


                            {customer.isActive ? (

                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">

                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                                Active

                              </span>

                            ) : (

                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">

                                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />

                                Inactive

                              </span>

                            )}


                            {customer.defaultDiscountPercent >
                              0 && (

                              <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">

                                {
                                  customer.defaultDiscountPercent
                                }

                                % discount

                              </span>

                            )}

                          </div>


                          <p className="mt-1 text-xs text-muted-foreground">

                            {
                              customer.phone
                            }

                            {customer.email && (

                              <>

                                {" · "}

                                {
                                  customer.email
                                }

                              </>

                            )}

                          </p>

                        </div>

                      </div>


                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:min-w-[470px]">

                        <SmallStat
                          label="Points"
                          value={
                            customer.loyaltyPoints.toLocaleString()
                          }
                        />


                        <SmallStat
                          label="Visits"
                          value={
                            customer.visits.toString()
                          }
                        />


                        <SmallStat
                          label="Lifetime spend"
                          value={
                            formatSaleMoney(
                              customer.lifetimeSpend,
                              business?.currency_code ??
                                "LKR",
                            )
                          }
                        />


                        <SmallStat
                          label="Last purchase"
                          value={
                            formatDate(
                              customer.lastPurchaseAt,
                            )
                          }
                        />

                      </div>

                    </div>

                  </button>

                ),
              )}

            </div>

          )}

        </CardContent>

      </Card>


      {/* ======================================================
          ADD
      ======================================================= */}

      <CustomerFormDialog
        mode="add"
        isOpen={
          addOpen
        }
        businessId={
          business?.id ??
          null
        }
        onClose={() =>
          setAddOpen(
            false,
          )
        }
        onSaved={
          handleCustomerSaved
        }
      />


      {/* ======================================================
          DETAILS
      ======================================================= */}

      {selected &&
        !editOpen && (

        <CustomerDetailDialog
          detail={
            selected
          }
          currencyCode={
            business?.currency_code ??
            "LKR"
          }
          onClose={() =>
            setSelected(
              null,
            )
          }
          onEdit={() =>
            setEditOpen(
              true,
            )
          }
        />

      )}


      {/* ======================================================
          EDIT
      ======================================================= */}

      {selected && (

        <CustomerFormDialog
          mode="edit"
          isOpen={
            editOpen
          }
          businessId={
            business?.id ??
            null
          }
          detail={
            selected
          }
          onClose={() =>
            setEditOpen(
              false,
            )
          }
          onSaved={
            handleCustomerSaved
          }
        />

      )}

    </AppLayout>
  );
}


/* ============================================================
   CUSTOMER FORM
============================================================ */

function CustomerFormDialog({
  mode,
  isOpen,
  businessId,
  detail,
  onClose,
  onSaved,
}: {
  mode:
    | "add"
    | "edit";

  isOpen:
    boolean;

  businessId:
    | string
    | null;

  detail?:
    CustomerDetail;

  onClose:
    () => void;

  onSaved:
    (
      customerId: string,
    ) =>
      void |
      Promise<void>;
}) {
  const [
    name,
    setName,
  ] =
    React.useState("");


  const [
    phone,
    setPhone,
  ] =
    React.useState("");


  const [
    email,
    setEmail,
  ] =
    React.useState("");


  const [
    discount,
    setDiscount,
  ] =
    React.useState("0");


  const [
    notes,
    setNotes,
  ] =
    React.useState("");


  const [
    isActive,
    setIsActive,
  ] =
    React.useState(true);


  const [
    saving,
    setSaving,
  ] =
    React.useState(false);


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(null);


  React.useEffect(() => {
    if (!isOpen) {
      return;
    }


    if (
      mode ===
        "edit" &&
      detail
    ) {
      setName(
        detail.customer.name,
      );


      setPhone(
        detail.customer.phone,
      );


      setEmail(
        detail.customer.email ??
        "",
      );


      setDiscount(
        detail.customer
          .defaultDiscountPercent
          .toString(),
      );


      setNotes(
        detail.customer.notes,
      );


      setIsActive(
        detail.customer.isActive,
      );
    } else {
      setName("");

      setPhone("");

      setEmail("");

      setDiscount("0");

      setNotes("");

      setIsActive(true);
    }


    setError(null);
  }, [
    detail,
    isOpen,
    mode,
  ]);


  async function handleSave() {
    if (
      !businessId ||
      saving
    ) {
      return;
    }


    if (
      !name.trim()
    ) {
      setError(
        "Customer name is required.",
      );

      return;
    }


    if (
      !phone.trim()
    ) {
      setError(
        "Mobile number is required.",
      );

      return;
    }


    if (
      email.trim() &&
      !email.includes(
        "@",
      )
    ) {
      setError(
        "Enter a valid email address.",
      );

      return;
    }


    const parsedDiscount =
      Number(
        discount ||
        0,
      );


    if (
      !Number.isFinite(
        parsedDiscount,
      ) ||
      parsedDiscount <
        0 ||
      parsedDiscount >
        100
    ) {
      setError(
        "Permanent discount must be between 0% and 100%.",
      );

      return;
    }


    setSaving(true);

    setError(null);


    try {
      const customerId =
        await saveCustomer({
          businessId,

          customerId:
            mode ===
              "edit"
              ? detail?.customer.id
              : null,

          name:
            name.trim(),

          phone:
            phone.trim(),

          email:
            email.trim(),

          defaultDiscountPercent:
            parsedDiscount,

          notes:
            notes.trim(),

          isActive,
        });


      await onSaved(
        customerId,
      );
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog
      isOpen={
        isOpen
      }
      onClose={
        saving
          ? () => {}
          : onClose
      }
      title={
        mode ===
        "edit"
          ? "Edit Customer"
          : "Add Customer"
      }
      description={
        mode ===
        "edit"
          ? "Update customer information and permanent checkout discount."
          : "Register a customer using their mobile number."
      }
      className="max-h-[calc(100vh-2rem)] max-w-xl overflow-hidden"
    >

      <div className="max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">

        <div className="space-y-4 pb-1">

          {error && (

            <div className="rounded-[14px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">

              {
                error
              }

            </div>

          )}


          <Field
            label="Customer name"
          >

            <input
              value={
                name
              }
              disabled={
                saving
              }
              onChange={(
                event,
              ) =>
                setName(
                  event.target.value,
                )
              }
              placeholder="Kasun Perera"
              className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
            />

          </Field>


          <Field
            label="Mobile number"
          >

            <input
              value={
                phone
              }
              disabled={
                saving
              }
              onChange={(
                event,
              ) =>
                setPhone(
                  event.target.value,
                )
              }
              placeholder="077 123 4567"
              inputMode="tel"
              className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
            />

          </Field>


          <Field
            label="Email"
            optional
          >

            <input
              value={
                email
              }
              disabled={
                saving
              }
              onChange={(
                event,
              ) =>
                setEmail(
                  event.target.value,
                )
              }
              placeholder="customer@example.com"
              type="email"
              className="h-11 w-full rounded-[14px] border bg-background px-3 text-sm outline-none focus:border-primary"
            />

          </Field>


          <Field
            label="Permanent checkout discount"
            optional
          >

            <div className="relative">

              <input
                value={
                  discount
                }
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) =>
                  setDiscount(
                    event.target.value,
                  )
                }
                min="0"
                max="100"
                step="0.01"
                type="number"
                className="h-11 w-full rounded-[14px] border bg-background px-3 pr-10 text-sm outline-none focus:border-primary"
              />


              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>

            </div>


            <p className="text-[11px] leading-5 text-muted-foreground">
              Automatically applied whenever this registered customer is selected during checkout.
            </p>

          </Field>


          <Field
            label="Notes"
            optional
          >

            <textarea
              value={
                notes
              }
              disabled={
                saving
              }
              onChange={(
                event,
              ) =>
                setNotes(
                  event.target.value,
                )
              }
              rows={3}
              placeholder="Optional customer notes"
              className="w-full resize-none rounded-[14px] border bg-background px-3 py-3 text-sm outline-none focus:border-primary"
            />

          </Field>


          {/* ==================================================
              CUSTOMER STATUS
          =================================================== */}

          {mode ===
            "edit" && (

            <div
              className={`rounded-[18px] border p-4 transition-colors ${
                isActive
                  ? "border-emerald-500/25 bg-emerald-500/[0.04]"
                  : "bg-muted/20"
              }`}
            >

              <div className="flex items-center justify-between gap-4">

                <div className="min-w-0">

                  <div className="flex items-center gap-2">

                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        isActive
                          ? "bg-emerald-500"
                          : "bg-muted-foreground"
                      }`}
                    />


                    <p
                      className={`text-sm font-semibold ${
                        isActive
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >

                      {isActive
                        ? "Active customer"
                        : "Inactive customer"}

                    </p>

                  </div>


                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">

                    {isActive
                      ? "This customer can be selected and used during POS checkout."
                      : "This customer is hidden from POS checkout until reactivated."}

                  </p>

                </div>


                <button
                  type="button"
                  role="switch"
                  aria-checked={
                    isActive
                  }
                  aria-label="Customer active status"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    setIsActive(
                      (current) =>
                        !current,
                    )
                  }
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isActive
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-border bg-muted"
                  }`}
                >

                  <span
                    className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isActive
                        ? "translate-x-5"
                        : "translate-x-0"
                    }`}
                  />

                </button>

              </div>

            </div>

          )}


          {/* ==================================================
              ACTIONS
          =================================================== */}

          <div className="flex justify-end gap-2 border-t pt-4">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              disabled={
                saving
              }
              onClick={
                onClose
              }
            >
              Cancel
            </Button>


            <Button
              type="button"
              className="rounded-[14px]"
              disabled={
                saving
              }
              onClick={() =>
                void handleSave()
              }
            >

              {saving ? (

                <Loader2 className="mr-2 h-4 w-4 animate-spin" />

              ) : mode ===
                "edit" ? (

                <Pencil className="mr-2 h-4 w-4" />

              ) : (

                <Plus className="mr-2 h-4 w-4" />

              )}


              {saving
                ? "Saving…"
                : mode ===
                    "edit"
                  ? "Save Changes"
                  : "Add Customer"}

            </Button>

          </div>

        </div>

      </div>

    </Dialog>
  );
}


/* ============================================================
   CUSTOMER DETAILS
============================================================ */

function CustomerDetailDialog({
  detail,
  currencyCode,
  onClose,
  onEdit,
}: {
  detail:
    CustomerDetail;

  currencyCode:
    string;

  onClose:
    () => void;

  onEdit:
    () => void;
}) {
  return (
    <Dialog
      isOpen
      onClose={
        onClose
      }
      title={
        detail.customer.name
      }
      description={
        detail.customer.phone
      }
      className="max-h-[calc(100vh-2rem)] max-w-4xl overflow-hidden"
    >

      <div className="max-h-[calc(100vh-11rem)] overflow-y-auto pr-1">

        <div className="space-y-5">

          <div className="flex justify-end">

            <Button
              type="button"
              variant="outline"
              className="rounded-[14px]"
              onClick={
                onEdit
              }
            >

              <Pencil className="mr-2 h-4 w-4" />

              Edit Customer

            </Button>

          </div>


          <div className="grid gap-3 sm:grid-cols-3">

            <DetailStat
              icon={
                <Sparkles className="h-5 w-5" />
              }
              label="Loyalty points"
              value={
                detail.loyaltyPoints.toLocaleString()
              }
            />


            <DetailStat
              icon={
                <CircleDollarSign className="h-5 w-5" />
              }
              label="Lifetime spend"
              value={
                formatSaleMoney(
                  detail.lifetimeSpend,
                  currencyCode,
                )
              }
            />


            <DetailStat
              icon={
                <ShoppingBag className="h-5 w-5" />
              }
              label="Visits"
              value={
                detail.visits.toString()
              }
            />

          </div>


          <Card className="rounded-[20px]">

            <CardHeader>

              <CardTitle className="text-base">
                Customer
              </CardTitle>

            </CardHeader>


            <CardContent className="space-y-3">

              <InfoLine
                label="Phone"
                value={
                  detail.customer.phone
                }
              />


              <InfoLine
                label="Email"
                value={
                  detail.customer.email ??
                  "—"
                }
              />


              <InfoLine
                label="Permanent discount"
                value={`${detail.customer.defaultDiscountPercent}%`}
              />


              <InfoLine
                label="Status"
                value={
                  detail.customer.isActive
                    ? "Active"
                    : "Inactive"
                }
              />


              {detail.customer.notes && (

                <div className="border-t pt-3">

                  <p className="text-xs text-muted-foreground">
                    Notes
                  </p>


                  <p className="mt-1 text-sm">
                    {
                      detail.customer.notes
                    }
                  </p>

                </div>

              )}

            </CardContent>

          </Card>


          <Card className="rounded-[20px]">

            <CardHeader>

              <CardTitle className="text-base">
                Purchase History
              </CardTitle>

            </CardHeader>


            <CardContent>

              {detail.sales.length >
              0 ? (

                <div className="space-y-2">

                  {detail.sales.map(
                    (sale) => (

                      <div
                        key={
                          sale.id
                        }
                        className="flex flex-col gap-2 rounded-[14px] border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >

                        <div>

                          <p className="font-semibold">
                            {
                              sale.receiptNumber
                            }
                          </p>


                          <p className="mt-1 text-xs text-muted-foreground">

                            {
                              formatDate(
                                sale.createdAt,
                              )
                            }

                            {" · "}

                            {
                              saleStatusLabel(
                                sale.status,
                              )
                            }

                          </p>

                        </div>


                        <p className="font-bold">
                          {formatSaleMoney(
                            sale.netTotal,
                            sale.currencyCode,
                          )}
                        </p>

                      </div>

                    ),
                  )}

                </div>

              ) : (

                <p className="text-sm text-muted-foreground">
                  This customer has no linked transactions yet.
                </p>

              )}

            </CardContent>

          </Card>


          <Card className="rounded-[20px]">

            <CardHeader>

              <CardTitle className="text-base">
                Loyalty History
              </CardTitle>

            </CardHeader>


            <CardContent>

              {detail.loyaltyTransactions.length >
              0 ? (

                <div className="space-y-2">

                  {detail.loyaltyTransactions.map(
                    (transaction) => (

                      <div
                        key={
                          transaction.id
                        }
                        className="flex items-center justify-between gap-4 rounded-[14px] border p-3"
                      >

                        <div>

                          <p className="text-sm font-semibold">

                            {
                              transaction.description ||
                              transaction.type.replace(
                                /_/g,
                                " ",
                              )
                            }

                          </p>


                          <p className="mt-1 text-xs text-muted-foreground">
                            {
                              formatDate(
                                transaction.createdAt,
                              )
                            }
                          </p>

                        </div>


                        <span
                          className={`font-bold ${
                            transaction.pointsDelta >
                            0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : transaction.pointsDelta <
                                  0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >

                          {transaction.pointsDelta >
                          0
                            ? "+"
                            : ""}

                          {
                            transaction.pointsDelta
                          }

                        </span>

                      </div>

                    ),
                  )}

                </div>

              ) : (

                <p className="text-sm text-muted-foreground">
                  No loyalty activity yet.
                </p>

              )}

            </CardContent>

          </Card>

        </div>

      </div>

    </Dialog>
  );
}


/* ============================================================
   SMALL UI
============================================================ */

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;

  label:
    string;

  value:
    string;
}) {
  return (
    <Card className="rounded-[20px]">

      <CardContent className="flex items-center gap-3 p-4">

        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-muted">
          {
            icon
          }
        </div>


        <div>

          <p className="text-xs text-muted-foreground">
            {
              label
            }
          </p>


          <p className="mt-1 text-lg font-bold">
            {
              value
            }
          </p>

        </div>

      </CardContent>

    </Card>
  );
}


function SmallStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div>

      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {
          label
        }
      </p>


      <p className="mt-1 truncate text-sm font-semibold">
        {
          value
        }
      </p>

    </div>
  );
}


function DetailStat({
  icon,
  label,
  value,
}: {
  icon:
    React.ReactNode;

  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-[16px] border bg-muted/20 p-4">

      <div className="flex items-center gap-2 text-muted-foreground">

        {
          icon
        }


        <span className="text-xs">
          {
            label
          }
        </span>

      </div>


      <p className="mt-3 text-xl font-bold">
        {
          value
        }
      </p>

    </div>
  );
}


function InfoLine({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">

      <span className="text-sm text-muted-foreground">
        {
          label
        }
      </span>


      <span className="text-right text-sm font-medium">
        {
          value
        }
      </span>

    </div>
  );
}


function Field({
  label,
  optional = false,
  children,
}: {
  label:
    string;

  optional?:
    boolean;

  children:
    React.ReactNode;
}) {
  return (
    <div className="space-y-2">

      <label className="text-sm font-semibold">

        {
          label
        }


        {optional && (

          <span className="ml-1 font-normal text-muted-foreground">
            optional
          </span>

        )}

      </label>


      {
        children
      }

    </div>
  );
}