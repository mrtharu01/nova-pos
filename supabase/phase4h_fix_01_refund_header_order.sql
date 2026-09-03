create or replace function
public.refund_sale(

  p_business_id uuid,

  p_sale_id uuid,

  p_items jsonb,

  p_refund_method public.nova_payment_method,

  p_reason text default '',

  p_note text default ''

)

returns jsonb

language plpgsql

security definer

set search_path = ''

as $$

declare

  v_user_id uuid :=
    (
      select auth.uid()
    );


  v_sale public.sales%rowtype;


  v_refund_id uuid :=
    gen_random_uuid();

  v_refund_sequence bigint;

  v_refund_number text;


  v_total_refund numeric(12,2) :=
    0;


  v_total_original_quantity integer :=
    0;

  v_total_refunded_quantity integer :=
    0;


  v_item jsonb;

  v_sale_item public.sale_items%rowtype;


  v_requested_quantity integer;

  v_restock boolean;


  v_already_refunded_quantity integer;

  v_remaining_quantity integer;


  v_already_refunded_amount numeric(12,2);

  v_remaining_amount numeric(12,2);

  v_line_refund numeric(12,2);

  v_unit_refund numeric(12,2);


  v_inventory_before integer;

  v_inventory_after integer;


begin

  if v_user_id is null then
    raise exception
      'Authentication required'
      using errcode = '42501';
  end if;


  if not (
    select private.is_business_manager(
      p_business_id
    )
  ) then
    raise exception
      'Manager access required for refunds'
      using errcode = '42501';
  end if;


  if
    p_items is null
    or
    jsonb_typeof(
      p_items
    ) <> 'array'
    or
    jsonb_array_length(
      p_items
    ) = 0
  then
    raise exception
      'Select at least one item to refund';
  end if;


  select
    sale_record.*

  into
    v_sale

  from public.sales
    as sale_record

  where
    sale_record.id =
      p_sale_id

    and
    sale_record.business_id =
      p_business_id

  for update;


  if not found then
    raise exception
      'Sale not found';
  end if;


  if
    v_sale.status =
      'voided'::public.nova_sale_status
  then
    raise exception
      'A voided sale cannot be refunded';
  end if;


  if
    v_sale.status =
      'refunded'::public.nova_sale_status
  then
    raise exception
      'This sale has already been fully refunded';
  end if;


  select
    identity_record.refund_sequence,
    identity_record.refund_number

  into
    v_refund_sequence,
    v_refund_number

  from private.next_refund_identity(
    p_business_id
  )
    as identity_record;


  /*
   * Create temporary refund header first.
   *
   * Amount is calculated afterwards.
   */

  insert into public.sale_refunds (

    id,
    business_id,
    sale_id,
    refund_sequence,
    refund_number,
    refund_method,
    amount,
    reason,
    note,
    actor_user_id

  )

  values (

    v_refund_id,
    p_business_id,
    p_sale_id,
    v_refund_sequence,
    v_refund_number,
    p_refund_method,

    0.01,

    trim(
      coalesce(
        p_reason,
        ''
      )
    ),

    trim(
      coalesce(
        p_note,
        ''
      )
    ),

    v_user_id

  );


  for v_item in

    select
      value

    from jsonb_array_elements(
      p_items
    )

  loop

    begin

      v_requested_quantity :=
        (
          v_item
          ->>
          'quantity'
        )::integer;

    exception
      when others then

        raise exception
          'Invalid refund quantity';

    end;


    if
      v_requested_quantity is null
      or
      v_requested_quantity <= 0
    then
      raise exception
        'Refund quantity must be greater than zero';
    end if;


    v_restock :=
      coalesce(
        (
          v_item
          ->>
          'restock'
        )::boolean,
        true
      );


    select
      item_record.*

    into
      v_sale_item

    from public.sale_items
      as item_record

    where
      item_record.id =
        (
          v_item
          ->>
          'saleItemId'
        )::uuid

      and
      item_record.sale_id =
        p_sale_id

      and
      item_record.business_id =
        p_business_id

    for update;


    if not found then
      raise exception
        'Refund item does not belong to this sale';
    end if;


    select

      coalesce(
        sum(
          refund_item.quantity
        ),
        0
      ),

      coalesce(
        sum(
          refund_item.line_refund_total
        ),
        0
      )

    into

      v_already_refunded_quantity,

      v_already_refunded_amount

    from public.sale_refund_items
      as refund_item

    where
      refund_item.sale_item_id =
        v_sale_item.id;


    v_remaining_quantity :=
      v_sale_item.quantity
      -
      v_already_refunded_quantity;


    if
      v_requested_quantity >
      v_remaining_quantity
    then

      raise exception
        'Refund quantity exceeds remaining quantity for %',
        v_sale_item.product_name;

    end if;


    v_remaining_amount :=
      v_sale_item.line_total
      -
      v_already_refunded_amount;


    if
      v_requested_quantity =
      v_remaining_quantity
    then

      v_line_refund :=
        v_remaining_amount;

    else

      v_line_refund :=
        round(
          (
            v_sale_item.line_total
            *
            v_requested_quantity
            /
            v_sale_item.quantity
          ),
          2
        );

    end if;


    if
      v_line_refund <= 0
    then
      raise exception
        'Calculated refund amount is invalid';
    end if;


    v_unit_refund :=
      round(
        v_line_refund
        /
        v_requested_quantity,
        2
      );


    insert into public.sale_refund_items (

      business_id,
      refund_id,
      sale_id,
      sale_item_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      sku,
      quantity,
      unit_refund_amount,
      line_refund_total,
      restocked

    )

    values (

      p_business_id,
      v_refund_id,
      p_sale_id,
      v_sale_item.id,
      v_sale_item.product_id,
      v_sale_item.variant_id,
      v_sale_item.product_name,
      v_sale_item.variant_name,
      v_sale_item.sku,
      v_requested_quantity,
      v_unit_refund,
      v_line_refund,
      v_restock

    );


    v_total_refund :=
      v_total_refund
      +
      v_line_refund;


    if
      v_restock
      and
      v_sale_item.variant_id is not null
    then

      select
        inventory.on_hand

      into
        v_inventory_before

      from public.inventory_levels
        as inventory

      where
        inventory.business_id =
          p_business_id

        and
        inventory.location_id =
          v_sale.location_id

        and
        inventory.variant_id =
          v_sale_item.variant_id

      for update;


      if not found then
        raise exception
          'Inventory level could not be found for returned item';
      end if;


      v_inventory_after :=
        v_inventory_before
        +
        v_requested_quantity;


      update public.inventory_levels
        as inventory

      set

        on_hand =
          v_inventory_after,

        updated_at =
          now()

      where
        inventory.business_id =
          p_business_id

        and
        inventory.location_id =
          v_sale.location_id

        and
        inventory.variant_id =
          v_sale_item.variant_id;


      insert into public.inventory_movements (

        business_id,
        location_id,
        variant_id,
        movement_type,
        quantity_delta,
        quantity_before,
        quantity_after,
        reason,
        note,
        reference_type,
        reference_id,
        actor_user_id

      )

      values (

        p_business_id,
        v_sale.location_id,
        v_sale_item.variant_id,
        'return'::public.nova_inventory_movement_type,
        v_requested_quantity,
        v_inventory_before,
        v_inventory_after,
        'Customer return',
        v_refund_number,
        'refund',
        v_refund_id,
        v_user_id

      );

    end if;

  end loop;


  update public.sale_refunds
    as refund_record

  set
    amount =
      v_total_refund

  where
    refund_record.id =
      v_refund_id;


  select
    coalesce(
      sum(
        item_record.quantity
      ),
      0
    )

  into
    v_total_original_quantity

  from public.sale_items
    as item_record

  where
    item_record.sale_id =
      p_sale_id

    and
    item_record.business_id =
      p_business_id;


  select
    coalesce(
      sum(
        refund_item.quantity
      ),
      0
    )

  into
    v_total_refunded_quantity

  from public.sale_refund_items
    as refund_item

  where
    refund_item.sale_id =
      p_sale_id

    and
    refund_item.business_id =
      p_business_id;


  if
    v_total_refunded_quantity >=
    v_total_original_quantity
  then

    update public.sales
      as sale_record

    set
      status =
        'refunded'::public.nova_sale_status,
      updated_at =
        now()

    where
      sale_record.id =
        p_sale_id

      and
      sale_record.business_id =
        p_business_id;


    update public.payments
      as payment_record

    set
      status =
        'refunded'::public.nova_payment_status

    where
      payment_record.sale_id =
        p_sale_id

      and
      payment_record.business_id =
        p_business_id;

  else

    update public.sales
      as sale_record

    set
      status =
        'partially_refunded'::public.nova_sale_status,
      updated_at =
        now()

    where
      sale_record.id =
        p_sale_id

      and
      sale_record.business_id =
        p_business_id;


    update public.payments
      as payment_record

    set
      status =
        'partially_refunded'::public.nova_payment_status

    where
      payment_record.sale_id =
        p_sale_id

      and
      payment_record.business_id =
        p_business_id;

  end if;


  return jsonb_build_object(

    'refundId',
    v_refund_id,

    'refundNumber',
    v_refund_number,

    'saleId',
    p_sale_id,

    'amount',
    v_total_refund,

    'saleStatus',
    case
      when
        v_total_refunded_quantity >=
        v_total_original_quantity
      then
        'refunded'
      else
        'partially_refunded'
    end

  );

end;

$$;


revoke all
on function
public.refund_sale(
  uuid,
  uuid,
  jsonb,
  public.nova_payment_method,
  text,
  text
)
from
  public,
  anon;


grant execute
on function
public.refund_sale(
  uuid,
  uuid,
  jsonb,
  public.nova_payment_method,
  text,
  text
)
to authenticated;