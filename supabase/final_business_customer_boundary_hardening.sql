-- ============================================================
-- NOVA POS
-- FINAL BUSINESS + CUSTOMER BOUNDARY HARDENING
--
-- Run AFTER:
--
--   phase4i_customers_loyalty.sql
--   auth_v2_production_hardening.sql
--   auth_v2_invitation_account_fix.sql
--
-- Purpose:
--
--   1. Business creation is only allowed through
--      bootstrap_business().
--
--   2. Authenticated browser clients cannot directly INSERT
--      or DELETE rows in public.businesses.
--
--   3. Cashiers may create/edit normal customer information,
--      including customers that already have a permanent
--      discount, but they cannot assign or change that
--      permanent discount.
-- ============================================================



-- ============================================================
-- 1. BUSINESS TABLE — FAIL CLOSED FOR CREATE / DELETE
-- ============================================================

revoke insert
on table public.businesses
from authenticated;


revoke delete
on table public.businesses
from authenticated;


drop policy if exists
businesses_insert_owner
on public.businesses;


drop policy if exists
businesses_delete_owner
on public.businesses;


/*
 * Keep only the columns that authenticated Managers/Owners are
 * intentionally allowed to update.
 */

revoke update
on table public.businesses
from authenticated;


grant update (
  name,
  currency_code,
  timezone
)
on table public.businesses
to authenticated;



-- ============================================================
-- 2. CUSTOMER SAVE RPC
--
-- Active business members:
--
--   Owner   -> create/edit customer + permanent discount
--   Manager -> create/edit customer + permanent discount
--   Cashier -> create/edit normal customer information
--
-- Cashiers:
--
--   • cannot assign a discount to a new customer
--   • cannot change an existing permanent discount
--   • CAN edit a customer who already has a discount, provided
--     that discount value remains unchanged
-- ============================================================

create or replace function
public.save_customer(

  p_business_id uuid,

  p_customer_id uuid,

  p_name text,

  p_phone text,

  p_email text default null,

  p_default_discount_percent numeric default 0,

  p_notes text default '',

  p_is_active boolean default true

)

returns uuid

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_customer_id uuid;


  v_is_manager boolean :=
    false;


  v_discount numeric(5,2) :=
    greatest(
      0,
      least(
        coalesce(
          p_default_discount_percent,
          0
        ),
        100
      )
    );


  v_existing_discount numeric(5,2);


begin

  if
    v_user_id
    is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if not (
    select
      private.is_business_member(
        p_business_id
      )
  ) then

    raise exception
      'Business access required'

      using errcode =
        '42501';

  end if;


  v_is_manager :=
    (
      select
        private.is_business_manager(
          p_business_id
        )
    );


  if
    btrim(
      coalesce(
        p_name,
        ''
      )
    ) = ''
  then

    raise exception
      'Customer name is required';

  end if;


  if
    private.normalize_customer_phone(
      p_phone
    ) = ''
  then

    raise exception
      'Customer phone number is required';

  end if;


  if
    p_customer_id
    is null
  then

    if
      v_discount > 0

      and

      not v_is_manager
    then

      raise exception
        'Manager access is required to assign customer discounts'

        using errcode =
          '42501';

    end if;


    insert into public.customers (

      business_id,

      name,

      phone,

      phone_normalized,

      email,

      default_discount_percent,

      notes,

      is_active

    )

    values (

      p_business_id,

      btrim(
        p_name
      ),

      btrim(
        p_phone
      ),

      private.normalize_customer_phone(
        p_phone
      ),

      nullif(
        btrim(
          coalesce(
            p_email,
            ''
          )
        ),
        ''
      ),

      v_discount,

      coalesce(
        p_notes,
        ''
      ),

      coalesce(
        p_is_active,
        true
      )

    )

    returning id

    into
      v_customer_id;


  else

    select
      customer_record.default_discount_percent

    into
      v_existing_discount

    from public.customers
      as customer_record

    where
      customer_record.id =
        p_customer_id

      and
      customer_record.business_id =
        p_business_id

    for update;


    if
      not found
    then

      raise exception
        'Customer not found';

    end if;


    if
      not v_is_manager
    then

      if
        v_discount <>
          coalesce(
            v_existing_discount,
            0
          )
      then

        raise exception
          'Manager access is required to change customer discounts'

          using errcode =
            '42501';

      end if;


      v_discount :=
        coalesce(
          v_existing_discount,
          0
        );

    end if;


    update public.customers

    set

      name =
        btrim(
          p_name
        ),

      phone =
        btrim(
          p_phone
        ),

      phone_normalized =
        private.normalize_customer_phone(
          p_phone
        ),

      email =
        nullif(
          btrim(
            coalesce(
              p_email,
              ''
            )
          ),
          ''
        ),

      default_discount_percent =
        v_discount,

      notes =
        coalesce(
          p_notes,
          ''
        ),

      is_active =
        coalesce(
          p_is_active,
          true
        )

    where
      id =
        p_customer_id

      and
      business_id =
        p_business_id

    returning id

    into
      v_customer_id;

  end if;


  return
    v_customer_id;


exception

  when unique_violation then

    raise exception
      'A customer with this phone number already exists';

end;

$$;



-- ============================================================
-- 3. RPC PERMISSIONS
-- ============================================================

revoke all
on function
public.save_customer(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  text,
  boolean
)
from
  public,
  anon;


grant execute
on function
public.save_customer(
  uuid,
  uuid,
  text,
  text,
  text,
  numeric,
  text,
  boolean
)
to authenticated;



-- ============================================================
-- 4. POSTGREST SCHEMA REFRESH
-- ============================================================

notify pgrst,
'reload schema';