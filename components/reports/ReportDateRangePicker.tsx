"use client";

import * as React from "react";

import {
  CalendarDays,
  Check,
  ChevronDown,
  X,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Input,
} from "@/components/ui/input";


type DateRange = {
  startDate:
    string;

  endDate:
    string;
};


type ReportDateRangePickerProps = {
  startDate:
    string;

  endDate:
    string;

  disabled?:
    boolean;

  onApply:
    (
      range:
        DateRange,
    ) => void;
};


function parseDateValue(
  value:
    string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return null;
  }


  const [
    year,
    month,
    day,
  ] =
    value
      .split(
        "-",
      )
      .map(
        Number,
      );


  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
      ),
    );


  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }


  return date;
}


function formatRangeDate(
  value:
    string,
) {
  const date =
    parseDateValue(
      value,
    );


  if (!date) {
    return "—";
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

      timeZone:
        "UTC",
    },
  ).format(
    date,
  );
}


function rangeError(
  startDate:
    string,
  endDate:
    string,
) {
  const start =
    parseDateValue(
      startDate,
    );


  const end =
    parseDateValue(
      endDate,
    );


  if (
    !start ||
    !end
  ) {
    return "Choose both a start date and an end date.";
  }


  if (
    start.getTime() >
    end.getTime()
  ) {
    return "Start date cannot be after end date.";
  }


  const days =
    Math.round(
      (
        end.getTime() -
        start.getTime()
      ) /
        86_400_000,
    );


  if (
    days >
    366
  ) {
    return "Report range cannot exceed 367 calendar days.";
  }


  return null;
}


function localDate(
  date:
    Date,
) {
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


function previousMonthRange(): DateRange {
  const now =
    new Date();


  const start =
    new Date(
      now.getFullYear(),
      now.getMonth() -
        1,
      1,
    );


  const end =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
    );


  return {
    startDate:
      localDate(
        start,
      ),

    endDate:
      localDate(
        end,
      ),
  };
}


function thisMonthRange(): DateRange {
  const now =
    new Date();


  return {
    startDate:
      localDate(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        ),
      ),

    endDate:
      localDate(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ),
      ),
  };
}


export function ReportDateRangePicker({
  startDate,
  endDate,
  disabled =
    false,
  onApply,
}: ReportDateRangePickerProps) {
  const [
    open,
    setOpen,
  ] =
    React.useState(
      false,
    );


  const [
    draftStartDate,
    setDraftStartDate,
  ] =
    React.useState(
      startDate,
    );


  const [
    draftEndDate,
    setDraftEndDate,
  ] =
    React.useState(
      endDate,
    );


  const [
    error,
    setError,
  ] =
    React.useState<
      string | null
    >(
      null,
    );


  const wrapperRef =
    React.useRef<
      HTMLDivElement | null
    >(
      null,
    );


  React.useEffect(() => {
    if (
      !open
    ) {
      return;
    }


    function handlePointerDown(
      event:
        PointerEvent,
    ) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as
            Node,
        )
      ) {
        setOpen(
          false,
        );


        setError(
          null,
        );
      }
    }


    function handleKeyDown(
      event:
        KeyboardEvent,
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        setOpen(
          false,
        );


        setError(
          null,
        );
      }
    }


    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );


    document.addEventListener(
      "keydown",
      handleKeyDown,
    );


    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );


      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    open,
  ]);


  function openPicker() {
    if (
      disabled
    ) {
      return;
    }


    setDraftStartDate(
      startDate,
    );


    setDraftEndDate(
      endDate,
    );


    setError(
      null,
    );


    setOpen(
      (
        current,
      ) =>
        !current,
    );
  }


  function applyRange() {
    const validationError =
      rangeError(
        draftStartDate,
        draftEndDate,
      );


    if (
      validationError
    ) {
      setError(
        validationError,
      );


      return;
    }


    onApply({
      startDate:
        draftStartDate,

      endDate:
        draftEndDate,
    });


    setError(
      null,
    );


    setOpen(
      false,
    );
  }


  function applyQuickRange(
    range:
      DateRange,
  ) {
    setDraftStartDate(
      range.startDate,
    );


    setDraftEndDate(
      range.endDate,
    );


    setError(
      null,
    );
  }


  return (
    <div
      ref={
        wrapperRef
      }
      className="relative"
    >

      <button
        type="button"
        disabled={
          disabled
        }
        aria-expanded={
          open
        }
        onClick={
          openPicker
        }
        className="
          flex
          min-h-10
          items-center
          gap-2
          rounded-[12px]
          border
          bg-background
          px-3
          py-2
          text-left
          text-xs
          font-medium
          shadow-sm
          transition-colors
          hover:bg-muted/50
          disabled:cursor-not-allowed
          disabled:opacity-60
        "
      >

        <CalendarDays className="h-4 w-4 shrink-0 text-primary" />


        <span className="whitespace-nowrap">

          {formatRangeDate(
            startDate,
          )}

          {" — "}

          {formatRangeDate(
            endDate,
          )}

        </span>


        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
            open
              ? "rotate-180"
              : ""
          }`}
        />

      </button>


      {open && (

        <div
          className="
            absolute
            right-0
            top-[calc(100%+0.5rem)]
            z-50
            w-[min(380px,calc(100vw-2rem))]
            rounded-[20px]
            border
            bg-popover
            p-4
            text-popover-foreground
            shadow-2xl
          "
        >

          <div className="mb-4 flex items-start justify-between gap-4">

            <div>

              <p className="text-sm font-bold">
                Custom date range
              </p>


              <p className="mt-1 text-xs text-muted-foreground">
                Reports, CSV exports and printouts will all use this exact range.
              </p>

            </div>


            <button
              type="button"
              className="rounded-[10px] p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                setOpen(
                  false,
                );


                setError(
                  null,
                );
              }}
              aria-label="Close date range picker"
            >

              <X className="h-4 w-4" />

            </button>

          </div>


          <div className="mb-4 flex flex-wrap gap-2">

            <button
              type="button"
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/70"
              onClick={() =>
                applyQuickRange(
                  thisMonthRange(),
                )
              }
            >
              This Month
            </button>


            <button
              type="button"
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/70"
              onClick={() =>
                applyQuickRange(
                  previousMonthRange(),
                )
              }
            >
              Previous Month
            </button>

          </div>


          <div className="grid gap-3 sm:grid-cols-2">

            <div>

              <label
                htmlFor="nova-report-start-date"
                className="mb-1.5 block text-xs font-semibold text-muted-foreground"
              >
                Start date
              </label>


              <Input
                id="nova-report-start-date"
                type="date"
                value={
                  draftStartDate
                }
                onChange={(
                  event,
                ) => {
                  setDraftStartDate(
                    event.target.value,
                  );


                  setError(
                    null,
                  );
                }}
              />

            </div>


            <div>

              <label
                htmlFor="nova-report-end-date"
                className="mb-1.5 block text-xs font-semibold text-muted-foreground"
              >
                End date
              </label>


              <Input
                id="nova-report-end-date"
                type="date"
                value={
                  draftEndDate
                }
                onChange={(
                  event,
                ) => {
                  setDraftEndDate(
                    event.target.value,
                  );


                  setError(
                    null,
                  );
                }}
              />

            </div>

          </div>


          {error && (

            <div className="mt-3 rounded-[12px] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {
                error
              }
            </div>

          )}


          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4">

            <Button
              type="button"
              variant="outline"
              className="rounded-[12px]"
              onClick={() => {
                setOpen(
                  false,
                );


                setError(
                  null,
                );
              }}
            >
              Cancel
            </Button>


            <Button
              type="button"
              className="rounded-[12px]"
              onClick={
                applyRange
              }
            >

              <Check className="mr-2 h-4 w-4" />

              Apply Range

            </Button>

          </div>

        </div>

      )}

    </div>
  );
}
