export type NovaPlanCode =
  | "starter"
  | "pro"
  | "business";


export type NovaAvailablePlan = {
  id: string;

  code: NovaPlanCode;

  name: string;

  description: string;

  monthlyPriceLkr:
    | number
    | null;

  yearlyPriceLkr:
    | number
    | null;

  entitlements:
    Record<string, boolean>;

  usageLimits:
    Record<
      string,
      number | null
    >;

  sortOrder: number;
};


export type NovaCurrentSubscription = {
  configured: boolean;

  businessId?:
    string;

  subscriptionId?:
    string;

  status?:
    string;

  billingInterval?:
    "monthly"
    | "yearly";

  complimentaryMode?:
    "none"
    | "until_date"
    | "lifetime";

  complimentaryUntil?:
    string
    | null;

  complimentaryActive?:
    boolean;

  cancelAtPeriodEnd?:
    boolean;

  currentPeriodStart?:
    string
    | null;

  currentPeriodEnd?:
    string
    | null;

  plan?:
    {
      id: string;

      code: NovaPlanCode;

      name: string;

      isPublic: boolean;

      isActive: boolean;
    };

  entitlements?:
    Record<string, boolean>;

  usageLimits?:
    Record<
      string,
      number | null
    >;
};
