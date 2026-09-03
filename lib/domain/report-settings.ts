export type ReportPaperSize =
  | "a4"
  | "letter";


export type ReportOrientation =
  | "portrait"
  | "landscape";


export type ReportSettings = {
  businessId: string;

  displayName: string;

  addressLine1: string;

  addressLine2: string;

  phone: string;

  email: string;

  registrationNumber: string;

  reportTitle: string;

  footerMessage: string;

  paperSize:
    ReportPaperSize;

  orientation:
    ReportOrientation;

  showGrossRevenue:
    boolean;

  showRefunds:
    boolean;

  showCogs:
    boolean;

  showProfit:
    boolean;

  showSalesTrend:
    boolean;

  showPaymentBreakdown:
    boolean;

  showTopProducts:
    boolean;

  showTransactions:
    boolean;

  showGeneratedByNova:
    boolean;
};


export function defaultReportSettings(
  businessId: string,
): ReportSettings {
  return {
    businessId,

    displayName:
      "",

    addressLine1:
      "",

    addressLine2:
      "",

    phone:
      "",

    email:
      "",

    registrationNumber:
      "",

    reportTitle:
      "Sales Report",

    footerMessage:
      "Thank you for using NOVA POS.",

    paperSize:
      "a4",

    orientation:
      "portrait",

    showGrossRevenue:
      true,

    showRefunds:
      true,

    showCogs:
      true,

    showProfit:
      true,

    showSalesTrend:
      true,

    showPaymentBreakdown:
      true,

    showTopProducts:
      true,

    showTransactions:
      true,

    showGeneratedByNova:
      true,
  };
}