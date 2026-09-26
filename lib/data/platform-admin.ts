"use client";

import {
  createPlatformClient,
} from "@/lib/supabase/platform-client";

import type {
  PlatformAdminMember,
  PlatformAdminOverview,
  PlatformAdminRole,
  PlatformAuditEntry,
  PlatformBillingInterval,
  PlatformBusiness,
  PlatformBackupEvent,
  PlatformBackupEventKind,
  PlatformBackupEventStatus,
  PlatformBackupOverview,
  PlatformBusinessProductionReadiness,
  PlatformBusinessSubscription,
  PlatformComplimentaryMode,
  PlatformSubscriptionPlan,
  PlatformSubscriptionPlanCode,
  PlatformSubscriptionStatus,
} from "@/lib/domain/platform-admin";


export async function fetchPlatformOverview():
Promise<PlatformAdminOverview> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_platform_admin_overview",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data as
    PlatformAdminOverview;
}


export async function fetchPlatformBusinesses(
  search = "",
): Promise<PlatformBusiness[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_businesses",
      {
        p_search:
          search,

        p_limit:
          250,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformBusiness[];
}


export async function fetchPlatformAudit():
Promise<PlatformAuditEntry[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_admin_audit",
      {
        p_limit:
          100,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformAuditEntry[];
}


export async function fetchPlatformAdmins():
Promise<PlatformAdminMember[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_admins",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformAdminMember[];
}


export async function addPlatformAdmin(
  email: string,
  role: PlatformAdminRole,
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "add_platform_admin",
      {
        p_email:
          email.trim(),

        p_role:
          role,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function setPlatformAdminRole(
  userId: string,
  role: PlatformAdminRole,
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "set_platform_admin_role",
      {
        p_user_id:
          userId,

        p_role:
          role,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function removePlatformAdmin(
  userId: string,
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "remove_platform_admin",
      {
        p_user_id:
          userId,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function fetchPlatformSubscriptionPlans():
Promise<PlatformSubscriptionPlan[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_subscription_plans",
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformSubscriptionPlan[];
}


export async function savePlatformSubscriptionPlan(
  input: {
    code:
      PlatformSubscriptionPlanCode;

    name:
      string;

    description:
      string;

    monthlyPriceLkr:
      number | null;

    yearlyPriceLkr:
      number | null;

    isPublic:
      boolean;

    isActive:
      boolean;

    entitlements:
      Record<string, boolean>;

    usageLimits:
      Record<
        string,
        number | null
      >;
  },
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_platform_subscription_plan",
      {
        p_code:
          input.code,

        p_name:
          input.name.trim(),

        p_description:
          input.description.trim(),

        p_monthly_price_lkr:
          input.monthlyPriceLkr,

        p_yearly_price_lkr:
          input.yearlyPriceLkr,

        p_is_public:
          input.isPublic,

        p_is_active:
          input.isActive,

        p_entitlements:
          input.entitlements,

        p_usage_limits:
          input.usageLimits,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function fetchPlatformBusinessSubscriptions(
  search = "",
): Promise<PlatformBusinessSubscription[]> {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_business_subscriptions",
      {
        p_search:
          search,

        p_limit:
          500,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return (
    data ??
    []
  ) as PlatformBusinessSubscription[];
}


export async function savePlatformBusinessSubscription(
  input: {
    businessId:
      string;

    planCode:
      PlatformSubscriptionPlanCode;

    status:
      PlatformSubscriptionStatus;

    billingInterval:
      PlatformBillingInterval;

    complimentaryMode:
      PlatformComplimentaryMode;

    complimentaryUntil:
      string | null;

    cancelAtPeriodEnd:
      boolean;
  },
) {
  const supabase =
    createPlatformClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_platform_business_subscription",
      {
        p_business_id:
          input.businessId,

        p_plan_code:
          input.planCode,

        p_status:
          input.status,

        p_billing_interval:
          input.billingInterval,

        p_complimentary_mode:
          input.complimentaryMode,

        p_complimentary_until:
          input.complimentaryUntil,

        p_cancel_at_period_end:
          input.cancelAtPeriodEnd,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  return data;
}


export async function fetchPlatformBackupOverview():
Promise<PlatformBackupOverview> {
  const supabase =
    createPlatformClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_platform_backup_overview",
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data as
    PlatformBackupOverview;
}


export async function fetchPlatformBackupEvents():
Promise<PlatformBackupEvent[]> {
  const supabase =
    createPlatformClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "list_platform_backup_events",
      {
        p_limit:
          100,
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return (
    data ??
    []
  ) as PlatformBackupEvent[];
}


export async function recordPlatformBackupEvent(
  input: {
    kind:
      PlatformBackupEventKind;

    status:
      PlatformBackupEventStatus;

    businessId?:
      string | null;

    note?:
      string;

    metadata?:
      Record<string, unknown>;

    occurredAt?:
      string;
  },
) {
  const supabase =
    createPlatformClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "record_platform_backup_event",
      {
        p_kind:
          input.kind,

        p_status:
          input.status,

        p_target_business_id:
          input.businessId ??
          null,

        p_note:
          input.note ??
          "",

        p_metadata:
          input.metadata ??
          {},

        p_occurred_at:
          input.occurredAt ??
          new Date()
            .toISOString(),
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data as string;
}


export async function fetchPlatformBusinessProductionReadiness(
  businessId: string,
): Promise<PlatformBusinessProductionReadiness> {
  const supabase =
    createPlatformClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_platform_business_production_readiness",
      {
        p_business_id:
          businessId,
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data as
    PlatformBusinessProductionReadiness;
}


export async function savePlatformBusinessHandoffChecklist(
  input: {
    businessId: string;
    businessDetailsVerified: boolean;
    staffAccessVerified: boolean;
    scannerVerified: boolean;
    receiptPrintVerified: boolean;
    backupFilesVerified: boolean;
    trainingCompleted: boolean;
    notes: string;
  },
): Promise<PlatformBusinessProductionReadiness> {
  const supabase =
    createPlatformClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "save_platform_business_handoff_checklist",
      {
        p_business_id:
          input.businessId,

        p_business_details_verified:
          input.businessDetailsVerified,

        p_staff_access_verified:
          input.staffAccessVerified,

        p_scanner_verified:
          input.scannerVerified,

        p_receipt_print_verified:
          input.receiptPrintVerified,

        p_backup_files_verified:
          input.backupFilesVerified,

        p_training_completed:
          input.trainingCompleted,

        p_notes:
          input.notes.trim(),
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data as
    PlatformBusinessProductionReadiness;
}


export async function setPlatformBusinessHandoffApproval(
  businessId: string,
  approved: boolean,
): Promise<PlatformBusinessProductionReadiness> {
  const supabase =
    createPlatformClient();

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "set_platform_business_handoff_approval",
      {
        p_business_id:
          businessId,

        p_approved:
          approved,
      },
    );

  if (error) {
    throw new Error(
      error.message,
    );
  }

  return data as
    PlatformBusinessProductionReadiness;
}
