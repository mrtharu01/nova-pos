-- ============================================================
-- NOVA POS
-- PHASE 4I — LOYALTY SETTINGS
-- ============================================================


-- ============================================================
-- UPDATE LOYALTY SETTINGS
--
-- Manager / Owner only.
-- ============================================================

create or replace function
public.update_loyalty_settings(

  p_business_id uuid,

  p_enabled boolean,

  p_spend_amount_per_earn numeric,

  p_points_earned integer,

  p_redeem_points integer,

  p_redeem_value numeric,

  p_minimum_redeem_points integer,

  p_maximum_discount_percent numeric,

  p_allow_cashier_redeem boolean,

  p_require_verified_phone_for_redemption boolean
    default false

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_result jsonb;

begin


  -- ==========================================================
  -- PERMISSION
  -- ==========================================================

  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then

    raise exception
      'Manager access required'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- VALIDATION
  -- ==========================================================

  if
    coalesce(
      p_spend_amount_per_earn,
      0
    ) <= 0
  then

    raise exception
      'Spend amount must be greater than zero';

  end if;


  if
    coalesce(
      p_points_earned,
      0
    ) <= 0
  then

    raise exception
      'Points earned must be greater than zero';

  end if;


  if
    coalesce(
      p_redeem_points,
      0
    ) <= 0
  then

    raise exception
      'Redeem points must be greater than zero';

  end if;


  if
    coalesce(
      p_redeem_value,
      0
    ) <= 0
  then

    raise exception
      'Redeem value must be greater than zero';

  end if;


  if
    coalesce(
      p_minimum_redeem_points,
      0
    ) < 0
  then

    raise exception
      'Minimum redemption cannot be negative';

  end if;


  if
    coalesce(
      p_maximum_discount_percent,
      -1
    ) < 0

    or

    p_maximum_discount_percent >
      100
  then

    raise exception
      'Maximum loyalty discount must be between 0 and 100 percent';

  end if;


  /*
   * Minimum redemption should use whole redemption blocks.
   */

  if
    p_minimum_redeem_points > 0

    and

    mod(
      p_minimum_redeem_points,
      p_redeem_points
    ) <> 0
  then

    raise exception
      'Minimum redemption must be a multiple of the redemption point block';

  end if;


  -- ==========================================================
  -- UPSERT
  -- ==========================================================

  insert into public.loyalty_settings (

    business_id,

    enabled,

    spend_amount_per_earn,

    points_earned,

    redeem_points,

    redeem_value,

    minimum_redeem_points,

    maximum_discount_percent,

    allow_cashier_redeem,

    require_verified_phone_for_redemption,

    updated_at

  )

  values (

    p_business_id,

    coalesce(
      p_enabled,
      false
    ),

    round(
      p_spend_amount_per_earn,
      2
    ),

    p_points_earned,

    p_redeem_points,

    round(
      p_redeem_value,
      2
    ),

    p_minimum_redeem_points,

    round(
      p_maximum_discount_percent,
      2
    ),

    coalesce(
      p_allow_cashier_redeem,
      true
    ),

    /*
     * Keep OTP optional.
     *
     * It remains false unless explicitly enabled later.
     */
    coalesce(
      p_require_verified_phone_for_redemption,
      false
    ),

    now()

  )

  on conflict (
    business_id
  )

  do update

  set

    enabled =
      excluded.enabled,

    spend_amount_per_earn =
      excluded.spend_amount_per_earn,

    points_earned =
      excluded.points_earned,

    redeem_points =
      excluded.redeem_points,

    redeem_value =
      excluded.redeem_value,

    minimum_redeem_points =
      excluded.minimum_redeem_points,

    maximum_discount_percent =
      excluded.maximum_discount_percent,

    allow_cashier_redeem =
      excluded.allow_cashier_redeem,

    require_verified_phone_for_redemption =
      excluded.require_verified_phone_for_redemption,

    updated_at =
      now();


  -- ==========================================================
  -- RETURN CURRENT SETTINGS
  -- ==========================================================

  select

    jsonb_build_object(

      'enabled',
      setting_record.enabled,

      'spendAmountPerEarn',
      setting_record.spend_amount_per_earn,

      'pointsEarned',
      setting_record.points_earned,

      'redeemPoints',
      setting_record.redeem_points,

      'redeemValue',
      setting_record.redeem_value,

      'minimumRedeemPoints',
      setting_record.minimum_redeem_points,

      'maximumDiscountPercent',
      setting_record.maximum_discount_percent,

      'allowCashierRedeem',
      setting_record.allow_cashier_redeem,

      'requireVerifiedPhoneForRedemption',
      setting_record.require_verified_phone_for_redemption

    )

  into
    v_result

  from public.loyalty_settings
    as setting_record

  where
    setting_record.business_id =
      p_business_id;


  return
    v_result;

end;

$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function
public.update_loyalty_settings(
  uuid,
  boolean,
  numeric,
  integer,
  integer,
  numeric,
  integer,
  numeric,
  boolean,
  boolean
)

from
  public,
  anon;


grant execute
on function
public.update_loyalty_settings(
  uuid,
  boolean,
  numeric,
  integer,
  integer,
  numeric,
  integer,
  numeric,
  boolean,
  boolean
)

to authenticated;


comment on function
public.update_loyalty_settings(
  uuid,
  boolean,
  numeric,
  integer,
  integer,
  numeric,
  integer,
  numeric,
  boolean,
  boolean
)

is
'NOVA POS manager-only loyalty program configuration.';


notify pgrst,
'reload schema';