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


export type PlatformAdminMember = {
  userId: string;

  email: string;

  role: PlatformAdminRole;

  createdAt: string;

  createdByUserId:
    | string
    | null;
};


export type PlatformSubscriptionPlanCode =
  | "starter"
  | "pro"
  | "business";


export type PlatformSubscriptionPlan = {
  id: string;

  code: PlatformSubscriptionPlanCode;

  name: string;

  description: string;

  isPublic: boolean;

  isActive: boolean;

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

  updatedAt: string;
};


export type PlatformSubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled"
  | "expired";


export type PlatformBillingInterval =
  | "monthly"
  | "yearly";


export type PlatformComplimentaryMode =
  | "none"
  | "until_date"
  | "lifetime";


export type PlatformBusinessSubscription = {
  businessId: string;

  businessName: string;

  ownerEmail: string;

  subscriptionId:
    | string
    | null;

  planCode:
    | PlatformSubscriptionPlanCode
    | null;

  planName:
    | string
    | null;

  status:
    | PlatformSubscriptionStatus
    | null;

  billingInterval:
    | PlatformBillingInterval
    | null;

  complimentaryMode:
    | PlatformComplimentaryMode
    | null;

  complimentaryUntil:
    | string
    | null;

  complimentaryActive:
    | boolean
    | null;

  cancelAtPeriodEnd:
    | boolean
    | null;

  currentPeriodStart:
    | string
    | null;

  currentPeriodEnd:
    | string
    | null;

  provider:
    | string
    | null;

  updatedAt:
    | string
    | null;
};


export type PlatformBackupEventKind =
  | "database_dump"
  | "storage_snapshot"
  | "tenant_export"
  | "restore_test";


export type PlatformBackupEventStatus =
  | "success"
  | "failed";


export type PlatformBackupOverview = {
  latestDatabaseDumpAt:
    | string
    | null;

  latestStorageSnapshotAt:
    | string
    | null;

  latestRestoreTestAt:
    | string
    | null;

  tenantExportCount: number;
};


export type PlatformBackupEvent = {
  id: string;

  kind: PlatformBackupEventKind;

  status: PlatformBackupEventStatus;

  businessId:
    | string
    | null;

  businessName:
    | string
    | null;

  actorUserId:
    | string
    | null;

  actorEmail:
    | string
    | null;

  note: string;

  metadata:
    Record<string, unknown>;

  occurredAt: string;

  createdAt: string;
};


export type PlatformBusinessProductionReadiness = {
  business: {
    id: string;
    name: string;
    ownerUserId: string;
    ownerEmail: string;
    currencyCode: string;
    timezone: string;
    createdAt: string;
  };

  subscription:
    | {
        subscriptionId: string;
        status: PlatformSubscriptionStatus;
        billingInterval: PlatformBillingInterval;
        complimentaryMode: PlatformComplimentaryMode;
        complimentaryUntil:
          | string
          | null;
        planCode: PlatformSubscriptionPlanCode;
        planName: string;
      }
    | null;

  counts: {
    activeProducts: number;
    activeVariants: number;
    activeLocations: number;
    inventoryLevels: number;
    activeStaff: number;
    completedSales: number;
  };

  automaticChecks: {
    ownerConfirmed: boolean;
    catalogConfigured: boolean;
    inventoryConfigured: boolean;
    receiptConfigured: boolean;
    subscriptionActive: boolean;
    lifetimeComplimentary: boolean;
    realTransactionCompleted: boolean;
    tenantExportCompleted: boolean;
    databaseBackupRecorded: boolean;
    storageSnapshotRecorded: boolean;
    restoreTestRecorded: boolean;
  };

  latestSaleAt:
    | string
    | null;

  manualChecks: {
    businessDetailsVerified: boolean;
    staffAccessVerified: boolean;
    scannerVerified: boolean;
    receiptPrintVerified: boolean;
    backupFilesVerified: boolean;
    trainingCompleted: boolean;
    notes: string;
  };

  automaticReady: boolean;
  manualReady: boolean;
  readyToHandoff: boolean;
  handoffApproved: boolean;

  approvedAt:
    | string
    | null;

  approvedByUserId:
    | string
    | null;
};
