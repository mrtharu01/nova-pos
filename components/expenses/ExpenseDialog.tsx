"use client";

import * as React from "react";

import {
  Check,
  Loader2,
  TriangleAlert,
  WalletCards,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  Input,
} from "@/components/ui/input";

import {
  saveExpense,
} from "@/lib/data/expenses";

import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from "@/lib/domain/expenses";

import type {
  PaymentMethod,
} from "@/lib/domain/sales";


type ExpenseDialogProps = {
  isOpen:
    boolean;

  onClose:
    () => void;

  businessId:
    string;

  expense?:
    Expense | null;

  onSaved:
    (
      expense:
        Expense,
    ) =>
      void |
      Promise<void>;
};


function todayValue() {
  const date =
    new Date();


  const year =
    date.getFullYear();


  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      "0",
    );


  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );


  return `${year}-${month}-${day}`;
}


function errorMessage(
  error:
    unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }


  return "Expense could not be saved.";
}


export function ExpenseDialog({
  isOpen,
  onClose,
  businessId,
  expense = null,
  onSaved,
}: ExpenseDialogProps) {
  const [
    expenseDate,
    setExpenseDate,
  ] =
    React.useState(
      todayValue(),
    );


  const [
    category,
    setCategory,
  ] =
    React.useState<ExpenseCategory>(
      "other",
    );


  const [
    title,
    setTitle,
  ] =
    React.useState("");


  const [
    vendor,
    setVendor,
  ] =
    React.useState("");


  const [
    amount,
    setAmount,
  ] =
    React.useState("");


  const [
    paymentMethod,
    setPaymentMethod,
  ] =
    React.useState<PaymentMethod>(
      "cash",
    );


  const [
    referenceNumber,
    setReferenceNumber,
  ] =
    React.useState("");


  const [
    note,
    setNote,
  ] =
    React.useState("");


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


    setExpenseDate(
      expense?.expenseDate ??
        todayValue(),
    );


    setCategory(
      expense?.category ??
        "other",
    );


    setTitle(
      expense?.title ??
        "",
    );


    setVendor(
      expense?.vendor ??
        "",
    );


    setAmount(
      expense
        ? expense.amount.toString()
        : "",
    );


    setPaymentMethod(
      expense?.paymentMethod ??
        "cash",
    );


    setReferenceNumber(
      expense?.referenceNumber ??
        "",
    );


    setNote(
      expense?.note ??
        "",
    );


    setError(
      null,
    );
  }, [
    expense,
    isOpen,
  ]);


  async function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();


    if (saving) {
      return;
    }


    if (!title.trim()) {
      setError(
        "Enter an expense title.",
      );

      return;
    }


    const numericAmount =
      Number(
        amount,
      );


    if (
      !Number.isFinite(
        numericAmount,
      ) ||
      numericAmount <=
        0
    ) {
      setError(
        "Enter a valid expense amount.",
      );

      return;
    }


    setSaving(
      true,
    );


    setError(
      null,
    );


    try {
      const result =
        await saveExpense({
          id:
            expense?.id,

          businessId,

          expenseDate,

          category,

          title,

          vendor,

          amount:
            numericAmount,

          paymentMethod,

          referenceNumber,

          note,
        });


      await onSaved(
        result,
      );


      onClose();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
        ),
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <Dialog
      isOpen={
        isOpen
      }
      onClose={() => {
        if (
          !saving
        ) {
          onClose();
        }
      }}
      title={
        expense
          ? "Edit Expense"
          : "Add Expense"
      }
      description={
        expense
          ? "Update this operating expense."
          : "Record a business operating expense."
      }
      className="max-h-[calc(100dvh-1rem)] max-w-xl overflow-hidden"
    >

      <form
        onSubmit={
          handleSubmit
        }
        className="flex max-h-[calc(100dvh-9rem)] flex-col"
      >

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">

          <div className="rounded-[18px] border bg-muted/20 p-4">

            <div className="flex items-start gap-3">

              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-primary/10 text-primary">

                <WalletCards className="h-5 w-5" />

              </div>


              <div>

                <p className="text-sm font-semibold">
                  Operating expense
                </p>


                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Stock sold through NOVA already contributes to COGS. Do not enter normal product cost here again.
                </p>

              </div>

            </div>

          </div>


          <div className="grid gap-4 sm:grid-cols-2">

            <Field
              label="Date"
            >

              <Input
                type="date"
                value={
                  expenseDate
                }
                required
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) =>
                  setExpenseDate(
                    event.target.value,
                  )
                }
              />

            </Field>


            <Field
              label="Category"
            >

              <select
                value={
                  category
                }
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) =>
                  setCategory(
                    event.target.value as
                      ExpenseCategory,
                  )
                }
                className="h-10 w-full rounded-[12px] border bg-background px-3 text-sm outline-none focus:border-primary"
              >

                {EXPENSE_CATEGORIES.map(
                  (item) => (

                    <option
                      key={
                        item.value
                      }
                      value={
                        item.value
                      }
                    >
                      {
                        item.label
                      }
                    </option>

                  ),
                )}

              </select>

            </Field>

          </div>


          <Field
            label="Expense title"
          >

            <Input
              value={
                title
              }
              required
              disabled={
                saving
              }
              placeholder="Example: September electricity bill"
              onChange={(
                event,
              ) =>
                setTitle(
                  event.target.value,
                )
              }
            />

          </Field>


          <div className="grid gap-4 sm:grid-cols-2">

            <Field
              label="Vendor / Payee"
              optional
            >

              <Input
                value={
                  vendor
                }
                disabled={
                  saving
                }
                placeholder="CEB, landlord, supplier..."
                onChange={(
                  event,
                ) =>
                  setVendor(
                    event.target.value,
                  )
                }
              />

            </Field>


            <Field
              label="Amount"
            >

              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={
                  amount
                }
                required
                disabled={
                  saving
                }
                placeholder="0.00"
                onChange={(
                  event,
                ) =>
                  setAmount(
                    event.target.value,
                  )
                }
              />

            </Field>

          </div>


          <div className="grid gap-4 sm:grid-cols-2">

            <Field
              label="Payment method"
            >

              <select
                value={
                  paymentMethod
                }
                disabled={
                  saving
                }
                onChange={(
                  event,
                ) =>
                  setPaymentMethod(
                    event.target.value as
                      PaymentMethod,
                  )
                }
                className="h-10 w-full rounded-[12px] border bg-background px-3 text-sm outline-none focus:border-primary"
              >

                <option value="cash">
                  Cash
                </option>

                <option value="card">
                  Card
                </option>

                <option value="bank_transfer">
                  Bank transfer
                </option>

                <option value="other">
                  Other
                </option>

              </select>

            </Field>


            <Field
              label="Reference number"
              optional
            >

              <Input
                value={
                  referenceNumber
                }
                disabled={
                  saving
                }
                placeholder="Invoice / transfer reference"
                onChange={(
                  event,
                ) =>
                  setReferenceNumber(
                    event.target.value,
                  )
                }
              />

            </Field>

          </div>


          <Field
            label="Notes"
            optional
          >

            <textarea
              value={
                note
              }
              disabled={
                saving
              }
              rows={
                4
              }
              placeholder="Optional information for your records"
              onChange={(
                event,
              ) =>
                setNote(
                  event.target.value,
                )
              }
              className="w-full resize-none rounded-[14px] border bg-background px-3 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:opacity-50"
            />

          </Field>


          {error && (

            <div className="flex items-start gap-2 rounded-[16px] border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">

              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />

              <span>
                {
                  error
                }
              </span>

            </div>

          )}

        </div>


        <div className="mt-5 flex shrink-0 gap-2 border-t bg-background pt-4">

          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded-[14px]"
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
            type="submit"
            className="flex-1 rounded-[14px]"
            disabled={
              saving
            }
          >

            {saving ? (

              <Loader2 className="mr-2 h-4 w-4 animate-spin" />

            ) : (

              <Check className="mr-2 h-4 w-4" />

            )}


            {saving
              ? "Saving…"
              : expense
                ? "Save Changes"
                : "Add Expense"}

          </Button>

        </div>

      </form>

    </Dialog>
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

      <label className="text-sm font-medium">

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