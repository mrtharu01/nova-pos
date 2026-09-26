-- ============================================================
-- NOVA POS
-- Pre-handoff tenant plan surface
-- ============================================================
--
-- Gives authenticated business users a read-only view of the
-- active public NOVA plan catalog. Subscription changes remain
-- controlled by NOVA Platform until the payment gateway and
-- self-service billing flow are introduced.
-- ============================================================


create or replace function
public.list_my_available_subscription_plans()

returns jsonb

language plpgsql

stable

security definer

set search_path = ''

as $$

declare

  v_business_id uuid;

  v_result jsonb :=
    '[]'::jsonb;

begin

  v_business_id :=
    private.current_business_id();


  if
    v_business_id is null
  then

    raise exception
      'Active NOVA business required'
      using errcode =
        '42501';

  end if;


  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',
          plan.id,

          'code',
          plan.code,

          'name',
          plan.name,

          'description',
          plan.description,

          'monthlyPriceLkr',
          plan.monthly_price_lkr,

          'yearlyPriceLkr',
          plan.yearly_price_lkr,

          'entitlements',
          plan.entitlements,

          'usageLimits',
          plan.usage_limits,

          'sortOrder',
          plan.sort_order
        )
        order by
          plan.sort_order,
          plan.code
      ),
      '[]'::jsonb
    )

  into
    v_result

  from public.subscription_plans
    as plan

  where
    plan.is_active is true

    and
    plan.is_public is true

    and
    plan.code in (
      'starter',
      'pro',
      'business'
    );


  return
    v_result;

end;

$$;


revoke all
on function
public.list_my_available_subscription_plans()
from
  public,
  anon;


grant execute
on function
public.list_my_available_subscription_plans()
to authenticated;


notify pgrst,
'reload schema';
