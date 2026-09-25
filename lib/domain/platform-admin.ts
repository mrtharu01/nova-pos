export type PlatformAdminRole =
  | "owner"
  | "admin"
  | "support";


export type PlatformAdminAccess = {
  isPlatformAdmin: boolean;

  userId: string;

  role:
    | PlatformAdminRole
    | null;
};


export type PlatformAdminOverview = {
  businessCount: number;

  activeStaffCount: number;

  platformAdminCount: number;

  businessesLast30Days: number;
};


export type PlatformBusiness = {
  id: string;

  name: string;

  ownerUserId: string;

  ownerEmail: string;

  currencyCode: string;

  timezone: string;

  staffCount: number;

  createdAt: string;
};


export type PlatformAuditEntry = {
  id: string;

  actorUserId:
    | string
    | null;

  actorEmail:
    | string
    | null;

  action: string;

  targetBusinessId:
    | string
    | null;

  targetBusinessName:
    | string
    | null;

  metadata:
    Record<string, unknown>;

  createdAt: string;
};
