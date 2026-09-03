export type ReceiptPaperWidth =
  | "58mm"
  | "80mm";

export type ReceiptSettingsForm = {
  paperWidth: ReceiptPaperWidth;

  autoPrint: boolean;

  displayName: string;

  addressLine1: string;

  addressLine2: string;

  phone: string;

  email: string;

  taxRegistrationNumber: string;

  footerMessage: string;

  showSku: boolean;

  showCashier: boolean;

  showCustomer: boolean;
};

export const DEFAULT_RECEIPT_SETTINGS:
  ReceiptSettingsForm = {
    paperWidth:
      "80mm",

    autoPrint:
      false,

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

    taxRegistrationNumber:
      "",

    footerMessage:
      "Thank you for shopping with us!",

    showSku:
      true,

    showCashier:
      true,

    showCustomer:
      true,
  };