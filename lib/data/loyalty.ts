"use client";

import {
  createClient,
} from "@/lib/supabase/client";


export type LoyaltySettings = {
  enabled: boolean;

  spendAmountPerEarn: number;

  pointsEarned: number;

  redeemPoints: number;

  redeemValue: number;

  minimumRedeemPoints: number;

  maximumDiscountPercent: number;

  allowCashierRedeem: boolean;

  requireVerifiedPhoneForRedemption: boolean;
};


export type UpdateLoyaltySettingsInput = {
  businessId: string;

  enabled: boolean;

  spendAmountPerEarn: number;

  pointsEarned: number;

  redeemPoints: number;

  redeemValue: number;

  minimumRedeemPoints: number;

  maximumDiscountPercent: number;

  allowCashierRedeem: boolean;

  requireVerifiedPhoneForRedemption?: boolean;
};


type LoyaltySettingsRow = {
  enabled: boolean;

  spend_amount_per_earn:
    | number
    | string;

  points_earned:
    | number
    | string;

  redeem_points:
    | number
    | string;

  redeem_value:
    | number
    | string;

  minimum_redeem_points:
    | number
    | string;

  maximum_discount_percent:
    | number
    | string;

  allow_cashier_redeem:
    boolean;

  require_verified_phone_for_redemption:
    boolean;
};


type UnknownRecord = {
  [key: string]:
    unknown;
};


function numberValue(
  value: unknown,
) {
  const result =
    Number(
      value ??
      0,
    );


  return Number.isFinite(
    result,
  )
    ? result
    : 0;
}


function objectValue(
  value: unknown,
): UnknownRecord {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value,
    )
  ) {
    return value as
      UnknownRecord;
  }


  return {};
}


/* ============================================================
   FETCH
============================================================ */

export async function fetchLoyaltySettings(
  businessId: string,
): Promise<LoyaltySettings> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase
      .from(
        "loyalty_settings",
      )
      .select(
        `
        enabled,
        spend_amount_per_earn,
        points_earned,
        redeem_points,
        redeem_value,
        minimum_redeem_points,
        maximum_discount_percent,
        allow_cashier_redeem,
        require_verified_phone_for_redemption
        `,
      )
      .eq(
        "business_id",
        businessId,
      )
      .maybeSingle();


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const row =
    data as
      | LoyaltySettingsRow
      | null;


  if (!row) {
    return {
      enabled: false,

      spendAmountPerEarn: 100,

      pointsEarned: 1,

      redeemPoints: 100,

      redeemValue: 100,

      minimumRedeemPoints: 100,

      maximumDiscountPercent: 50,

      allowCashierRedeem: true,

      requireVerifiedPhoneForRedemption: false,
    };
  }


  return {
    enabled:
      row.enabled,

    spendAmountPerEarn:
      numberValue(
        row.spend_amount_per_earn,
      ),

    pointsEarned:
      numberValue(
        row.points_earned,
      ),

    redeemPoints:
      numberValue(
        row.redeem_points,
      ),

    redeemValue:
      numberValue(
        row.redeem_value,
      ),

    minimumRedeemPoints:
      numberValue(
        row.minimum_redeem_points,
      ),

    maximumDiscountPercent:
      numberValue(
        row.maximum_discount_percent,
      ),

    allowCashierRedeem:
      row.allow_cashier_redeem,

    requireVerifiedPhoneForRedemption:
      row.require_verified_phone_for_redemption,
  };
}


/* ============================================================
   UPDATE
============================================================ */

export async function updateLoyaltySettings(
  input:
    UpdateLoyaltySettingsInput,
): Promise<LoyaltySettings> {
  const supabase =
    createClient();


  const {
    data,
    error,
  } =
    await supabase.rpc(
      "update_loyalty_settings",
      {
        p_business_id:
          input.businessId,

        p_enabled:
          input.enabled,

        p_spend_amount_per_earn:
          input.spendAmountPerEarn,

        p_points_earned:
          input.pointsEarned,

        p_redeem_points:
          input.redeemPoints,

        p_redeem_value:
          input.redeemValue,

        p_minimum_redeem_points:
          input.minimumRedeemPoints,

        p_maximum_discount_percent:
          input.maximumDiscountPercent,

        p_allow_cashier_redeem:
          input.allowCashierRedeem,

        /*
         * SMS OTP is not connected yet.
         * Keep this false for now.
         */
        p_require_verified_phone_for_redemption:
          input.requireVerifiedPhoneForRedemption ??
          false,
      },
    );


  if (error) {
    throw new Error(
      error.message,
    );
  }


  const row =
    objectValue(
      data,
    );


  return {
    enabled:
      row.enabled ===
      true,

    spendAmountPerEarn:
      numberValue(
        row.spendAmountPerEarn,
      ),

    pointsEarned:
      numberValue(
        row.pointsEarned,
      ),

    redeemPoints:
      numberValue(
        row.redeemPoints,
      ),

    redeemValue:
      numberValue(
        row.redeemValue,
      ),

    minimumRedeemPoints:
      numberValue(
        row.minimumRedeemPoints,
      ),

    maximumDiscountPercent:
      numberValue(
        row.maximumDiscountPercent,
      ),

    allowCashierRedeem:
      row.allowCashierRedeem !==
      false,

    requireVerifiedPhoneForRedemption:
      row.requireVerifiedPhoneForRedemption ===
      true,
  };
}