"use client";

import * as React from "react";

import {
  Loader2,
  Printer,
  TriangleAlert,
} from "lucide-react";

import {
  Button,
} from "@/components/ui/button";

import {
  Dialog,
} from "@/components/ui/dialog";

import {
  ReportDocument,
} from "@/components/reports/ReportDocument";

import {
  fetchReportSettings,
} from "@/lib/data/report-settings";

import type {
  DashboardReport,
} from "@/lib/domain/dashboard";

import type {
  ReportSettings,
} from "@/lib/domain/report-settings";


type ReportPrintDialogProps = {
  isOpen:
    boolean;

  onClose:
    () => void;

  report:
    DashboardReport | null;

  businessId:
    string;

  businessName:
    string;

  currencyCode:
    string;
};


function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error
  ) {
    return error.message;
  }


  return "Report settings could not be loaded.";
}


export function ReportPrintDialog({
  isOpen,
  onClose,
  report,
  businessId,
  businessName,
  currencyCode,
}: ReportPrintDialogProps) {
  const [
    settings,
    setSettings,
  ] =
    React.useState<
      ReportSettings | null
    >(null);


  const [
    loading,
    setLoading,
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
    if (
      !isOpen ||
      !businessId
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
          await fetchReportSettings(
            businessId,
          );


        if (
          !cancelled
        ) {
          setSettings(
            result,
          );
        }
      } catch (cause) {
        if (
          !cancelled
        ) {
          setError(
            getErrorMessage(
              cause,
            ),
          );
        }
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
    businessId,
    isOpen,
  ]);


  function printReport() {
    window.print();
  }


  return (
    <Dialog
      isOpen={
        isOpen
      }
      onClose={
        onClose
      }
      title="Print Report"
      description="Preview the formatted NOVA report before printing or saving it as a PDF."
      className="max-h-[calc(100dvh-1rem)] max-w-[1100px] overflow-hidden"
    >

      <div className="flex max-h-[calc(100dvh-9rem)] flex-col">

        <div className="min-h-0 flex-1 overflow-auto rounded-[18px] bg-muted/40 p-4">

          {loading ? (

            <div className="flex min-h-[420px] items-center justify-center">

              <Loader2 className="h-7 w-7 animate-spin text-primary" />

            </div>

          ) : error ? (

            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">

              <TriangleAlert className="h-7 w-7 text-destructive" />


              <p className="mt-3 text-sm text-destructive">
                {
                  error
                }
              </p>

            </div>

          ) : report &&
            settings ? (

            <ReportDocument
              report={
                report
              }
              settings={
                settings
              }
              businessName={
                businessName
              }
              currencyCode={
                currencyCode
              }
            />

          ) : null}

        </div>


        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t pt-4">

          <Button
            type="button"
            variant="outline"
            className="rounded-[12px]"
            onClick={
              onClose
            }
          >
            Cancel
          </Button>


          <Button
            type="button"
            className="rounded-[12px]"
            disabled={
              loading ||
              !report ||
              !settings
            }
            onClick={
              printReport
            }
          >

            <Printer className="mr-2 h-4 w-4" />

            Print / Save PDF

          </Button>

        </div>

      </div>

    </Dialog>
  );
}