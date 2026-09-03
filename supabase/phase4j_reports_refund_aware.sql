-- ============================================================
-- NOVA POS
-- PHASE 4J — REFUND-AWARE REPORTING ENGINE
-- ============================================================

create or replace function
public.get_dashboard_report(

  p_business_id uuid,

  p_start_date date,

  p_end_date date

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


  v_timezone text;

  v_start_ts timestamptz;

  v_end_ts timestamptz;


  v_gross_revenue numeric(14,2) :=
    0;

  v_refund_amount numeric(14,2) :=
    0;

  v_revenue numeric(14,2) :=
    0;

  v_transactions bigint :=
    0;

  v_refunds bigint :=
    0;

  v_items_sold bigint :=
    0;

  v_average_sale numeric(14,2) :=
    0;

  v_cogs numeric(14,2) :=
    0;

  v_gross_profit numeric(14,2) :=
    0;


  v_daily_sales jsonb :=
    '[]'::jsonb;

  v_payment_breakdown jsonb :=
    '[]'::jsonb;

  v_top_products jsonb :=
    '[]'::jsonb;

  v_low_stock jsonb :=
    '[]'::jsonb;

  v_recent_sales jsonb :=
    '[]'::jsonb;


begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if
    v_user_id is null
  then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if
    p_business_id is null
  then

    raise exception
      'Business is required';

  end if;


  if not (
    select private.is_business_member(
      p_business_id
    )
  ) then

    raise exception
      'You do not have access to this business'

      using errcode =
        '42501';

  end if;


  -- ==========================================================
  -- RANGE
  -- ==========================================================

  if
    p_start_date is null
    or
    p_end_date is null
  then

    raise exception
      'Start date and end date are required';

  end if;


  if
    p_start_date >
    p_end_date
  then

    raise exception
      'Start date cannot be after end date';

  end if;


  if
    (
      p_end_date -
      p_start_date
    ) > 366
  then

    raise exception
      'Reporting range cannot exceed 366 days';

  end if;


  -- ==========================================================
  -- BUSINESS TIMEZONE
  -- ==========================================================

  select

    coalesce(
      nullif(
        business_record.timezone,
        ''
      ),
      'Asia/Colombo'
    )

  into
    v_timezone

  from public.businesses
    as business_record

  where
    business_record.id =
      p_business_id;


  if
    v_timezone is null
  then

    raise exception
      'Business could not be found';

  end if;


  v_start_ts :=
    (
      p_start_date::timestamp
      at time zone
      v_timezone
    );


  v_end_ts :=
    (
      (
        p_end_date +
        1
      )::timestamp
      at time zone
      v_timezone
    );


  -- ==========================================================
  -- SUMMARY
  --
  -- Reports are based on sales created inside the selected
  -- range, adjusted using all refunds belonging to those sales.
  --
  -- Voided sales contribute zero.
  -- ==========================================================

  with scoped_sales as (

    select

      sale_record.id,

      sale_record.total,

      sale_record.item_quantity_total

    from public.sales
      as sale_record

    where
      sale_record.business_id =
        p_business_id

      and
      sale_record.created_at >=
        v_start_ts

      and
      sale_record.created_at <
        v_end_ts

      and
      sale_record.status <>
        'voided'::public.nova_sale_status

  ),

  refund_totals as (

    select

      refund_record.sale_id,

      sum(
        refund_record.amount
      )::numeric(14,2)
        as refund_amount,

      count(*)::bigint
        as refund_count

    from public.sale_refunds
      as refund_record

    join scoped_sales
      as scoped_sale

      on
        scoped_sale.id =
          refund_record.sale_id

    where
      refund_record.business_id =
        p_business_id

    group by
      refund_record.sale_id

  ),

  refund_quantities as (

    select

      refund_item.sale_id,

      sum(
        refund_item.quantity
      )::bigint
        as refunded_quantity

    from public.sale_refund_items
      as refund_item

    join scoped_sales
      as scoped_sale

      on
        scoped_sale.id =
          refund_item.sale_id

    where
      refund_item.business_id =
        p_business_id

    group by
      refund_item.sale_id

  )

  select

    coalesce(
      sum(
        scoped_sale.total
      ),
      0
    )::numeric(14,2),

    coalesce(
      sum(
        coalesce(
          refund_total.refund_amount,
          0
        )
      ),
      0
    )::numeric(14,2),

    count(*)::bigint,

    coalesce(
      sum(
        scoped_sale.item_quantity_total
        -
        coalesce(
          refund_quantity.refunded_quantity,
          0
        )
      ),
      0
    )::bigint,

    coalesce(
      sum(
        coalesce(
          refund_total.refund_count,
          0
        )
      ),
      0
    )::bigint

  into

    v_gross_revenue,

    v_refund_amount,

    v_transactions,

    v_items_sold,

    v_refunds

  from scoped_sales
    as scoped_sale

  left join refund_totals
    as refund_total

    on
      refund_total.sale_id =
        scoped_sale.id

  left join refund_quantities
    as refund_quantity

    on
      refund_quantity.sale_id =
        scoped_sale.id;


  v_revenue :=
    round(
      v_gross_revenue -
      v_refund_amount,
      2
    );


  if
    v_transactions >
    0
  then

    v_average_sale :=
      round(
        v_revenue /
        v_transactions,
        2
      );

  else

    v_average_sale :=
      0;

  end if;


  -- ==========================================================
  -- COST OF GOODS
  --
  -- Restocked refunded units reverse COGS.
  --
  -- A refunded item that is NOT restocked still keeps its cost
  -- because the business lost the item.
  -- ==========================================================

  with restocked_quantities as (

    select

      refund_item.sale_item_id,

      sum(
        case
          when
            refund_item.restocked
          then
            refund_item.quantity
          else
            0
        end
      )::integer
        as restocked_quantity

    from public.sale_refund_items
      as refund_item

    where
      refund_item.business_id =
        p_business_id

    group by
      refund_item.sale_item_id

  )

  select

    coalesce(
      sum(

        coalesce(
          item_record.unit_cost,
          0
        )

        *

        greatest(
          item_record.quantity
          -
          coalesce(
            restocked.restocked_quantity,
            0
          ),
          0
        )

      ),
      0
    )::numeric(14,2)

  into
    v_cogs

  from public.sale_items
    as item_record

  join public.sales
    as sale_record

    on
      sale_record.id =
        item_record.sale_id

    and
      sale_record.business_id =
        item_record.business_id

  left join restocked_quantities
    as restocked

    on
      restocked.sale_item_id =
        item_record.id

  where
    sale_record.business_id =
      p_business_id

    and
    sale_record.created_at >=
      v_start_ts

    and
    sale_record.created_at <
      v_end_ts

    and
    sale_record.status <>
      'voided'::public.nova_sale_status;


  v_gross_profit :=
    round(
      v_revenue -
      v_cogs,
      2
    );


  -- ==========================================================
  -- DAILY NET SALES
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(

        jsonb_build_object(

          'date',
          trend.sale_date,

          'revenue',
          trend.revenue,

          'transactions',
          trend.transactions,

          'itemsSold',
          trend.items_sold

        )

        order by
          trend.sale_date

      ),
      '[]'::jsonb
    )

  into
    v_daily_sales

  from (

    select

      calendar.day::date
        as sale_date,

      coalesce(
        daily.revenue,
        0
      )::numeric(14,2)
        as revenue,

      coalesce(
        daily.transactions,
        0
      )::bigint
        as transactions,

      coalesce(
        daily.items_sold,
        0
      )::bigint
        as items_sold

    from pg_catalog.generate_series(

      p_start_date::timestamp,

      p_end_date::timestamp,

      interval '1 day'

    ) as calendar(day)


    left join (

      with refund_totals as (

        select

          refund_record.sale_id,

          sum(
            refund_record.amount
          )::numeric(14,2)
            as refund_amount

        from public.sale_refunds
          as refund_record

        where
          refund_record.business_id =
            p_business_id

        group by
          refund_record.sale_id

      ),

      refund_quantities as (

        select

          refund_item.sale_id,

          sum(
            refund_item.quantity
          )::bigint
            as refunded_quantity

        from public.sale_refund_items
          as refund_item

        where
          refund_item.business_id =
            p_business_id

        group by
          refund_item.sale_id

      )

      select

        (
          sale_record.created_at
          at time zone
          v_timezone
        )::date
          as sale_date,

        sum(
          sale_record.total
          -
          coalesce(
            refund_total.refund_amount,
            0
          )
        )::numeric(14,2)
          as revenue,

        count(*)::bigint
          as transactions,

        sum(
          sale_record.item_quantity_total
          -
          coalesce(
            refund_quantity.refunded_quantity,
            0
          )
        )::bigint
          as items_sold

      from public.sales
        as sale_record

      left join refund_totals
        as refund_total

        on
          refund_total.sale_id =
            sale_record.id

      left join refund_quantities
        as refund_quantity

        on
          refund_quantity.sale_id =
            sale_record.id

      where
        sale_record.business_id =
          p_business_id

        and
        sale_record.created_at >=
          v_start_ts

        and
        sale_record.created_at <
          v_end_ts

        and
        sale_record.status <>
          'voided'::public.nova_sale_status

      group by
        (
          sale_record.created_at
          at time zone
          v_timezone
        )::date

    ) as daily

    on
      daily.sale_date =
        calendar.day::date

  ) as trend;


  -- ==========================================================
  -- PAYMENT BREAKDOWN
  --
  -- Original payment = positive
  -- Refund            = negative
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(

        jsonb_build_object(

          'method',
          payment_summary.method,

          'amount',
          payment_summary.amount,

          'transactions',
          payment_summary.transactions

        )

        order by
          payment_summary.amount desc

      ),
      '[]'::jsonb
    )

  into
    v_payment_breakdown

  from (

    with scoped_sales as (

      select
        sale_record.id

      from public.sales
        as sale_record

      where
        sale_record.business_id =
          p_business_id

        and
        sale_record.created_at >=
          v_start_ts

        and
        sale_record.created_at <
          v_end_ts

        and
        sale_record.status <>
          'voided'::public.nova_sale_status

    ),

    payment_ledger as (

      select

        payment_record.method::text
          as method,

        payment_record.sale_id,

        payment_record.amount
          as amount

      from public.payments
        as payment_record

      join scoped_sales
        as scoped_sale

        on
          scoped_sale.id =
            payment_record.sale_id

      where
        payment_record.business_id =
          p_business_id


      union all


      select

        refund_record.refund_method::text
          as method,

        refund_record.sale_id,

        -refund_record.amount
          as amount

      from public.sale_refunds
        as refund_record

      join scoped_sales
        as scoped_sale

        on
          scoped_sale.id =
            refund_record.sale_id

      where
        refund_record.business_id =
          p_business_id

    )

    select

      payment_ledger.method,

      round(
        sum(
          payment_ledger.amount
        ),
        2
      )::numeric(14,2)
        as amount,

      count(
        distinct
        payment_ledger.sale_id
      )::bigint
        as transactions

    from payment_ledger

    group by
      payment_ledger.method

  ) as payment_summary;


  -- ==========================================================
  -- TOP PRODUCTS — NET OF REFUNDS
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(

        jsonb_build_object(

          'productId',
          product_summary.product_id,

          'name',
          product_summary.product_name,

          'quantity',
          product_summary.quantity,

          'revenue',
          product_summary.revenue

        )

        order by

          product_summary.revenue desc,

          product_summary.quantity desc

      ),
      '[]'::jsonb
    )

  into
    v_top_products

  from (

    with refunded_items as (

      select

        refund_item.sale_item_id,

        sum(
          refund_item.quantity
        )::integer
          as refunded_quantity,

        sum(
          refund_item.line_refund_total
        )::numeric(14,2)
          as refunded_amount

      from public.sale_refund_items
        as refund_item

      where
        refund_item.business_id =
          p_business_id

      group by
        refund_item.sale_item_id

    )

    select

      item_record.product_id,

      item_record.product_name,

      sum(
        greatest(
          item_record.quantity
          -
          coalesce(
            refunded.refunded_quantity,
            0
          ),
          0
        )
      )::bigint
        as quantity,

      round(
        sum(
          greatest(
            item_record.line_total
            -
            coalesce(
              refunded.refunded_amount,
              0
            ),
            0
          )
        ),
        2
      )::numeric(14,2)
        as revenue

    from public.sale_items
      as item_record

    join public.sales
      as sale_record

      on
        sale_record.id =
          item_record.sale_id

      and
        sale_record.business_id =
          item_record.business_id

    left join refunded_items
      as refunded

      on
        refunded.sale_item_id =
          item_record.id

    where
      sale_record.business_id =
        p_business_id

      and
      sale_record.created_at >=
        v_start_ts

      and
      sale_record.created_at <
        v_end_ts

      and
      sale_record.status <>
        'voided'::public.nova_sale_status

    group by

      item_record.product_id,

      item_record.product_name

    having

      sum(
        greatest(
          item_record.quantity
          -
          coalesce(
            refunded.refunded_quantity,
            0
          ),
          0
        )
      ) > 0

    order by

      revenue desc,

      quantity desc

    limit 8

  ) as product_summary;


  -- ==========================================================
  -- LOW STOCK
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(

        jsonb_build_object(

          'productId',
          stock_summary.product_id,

          'variantId',
          stock_summary.variant_id,

          'productName',
          stock_summary.product_name,

          'variantName',
          stock_summary.variant_name,

          'sku',
          stock_summary.sku,

          'stock',
          stock_summary.stock,

          'threshold',
          stock_summary.threshold

        )

        order by

          stock_summary.stock asc,

          stock_summary.product_name asc

      ),
      '[]'::jsonb
    )

  into
    v_low_stock

  from (

    select

      product_record.id
        as product_id,

      variant_record.id
        as variant_id,

      product_record.name
        as product_name,

      variant_record.name
        as variant_name,

      variant_record.sku,

      inventory_record.on_hand
        as stock,

      inventory_record.low_stock_threshold
        as threshold

    from public.inventory_levels
      as inventory_record

    join public.inventory_locations
      as location_record

      on
        location_record.id =
          inventory_record.location_id

      and
        location_record.business_id =
          inventory_record.business_id

    join public.product_variants
      as variant_record

      on
        variant_record.id =
          inventory_record.variant_id

      and
        variant_record.business_id =
          inventory_record.business_id

    join public.products
      as product_record

      on
        product_record.id =
          variant_record.product_id

      and
        product_record.business_id =
          variant_record.business_id

    where
      inventory_record.business_id =
        p_business_id

      and
      location_record.is_default =
        true

      and
      location_record.is_active =
        true

      and
      variant_record.is_active =
        true

      and
      product_record.status =
        'active'::public.nova_product_status

      and
      inventory_record.on_hand <=
        inventory_record.low_stock_threshold

    order by

      inventory_record.on_hand asc,

      product_record.name asc

    limit 8

  ) as stock_summary;


  -- ==========================================================
  -- RECENT SALES
  -- ==========================================================

  select

    coalesce(
      jsonb_agg(

        jsonb_build_object(

          'id',
          recent.id,

          'receiptNumber',
          recent.receipt_number,

          'createdAt',
          recent.created_at,

          'customerName',
          recent.customer_name,

          'total',
          recent.total,

          'refundAmount',
          recent.refund_amount,

          'netTotal',
          recent.net_total,

          'currencyCode',
          recent.currency_code,

          'status',
          recent.status,

          'itemQuantityTotal',
          recent.item_quantity_total

        )

        order by
          recent.created_at desc

      ),
      '[]'::jsonb
    )

  into
    v_recent_sales

  from (

    select

      sale_record.id,

      sale_record.receipt_number,

      sale_record.created_at,

      sale_record.customer_name,

      sale_record.total,

      coalesce(
        refund_total.refund_amount,
        0
      )::numeric(14,2)
        as refund_amount,

      case

        when
          sale_record.status =
            'voided'::public.nova_sale_status

        then
          0::numeric

        else
          greatest(
            sale_record.total
            -
            coalesce(
              refund_total.refund_amount,
              0
            ),
            0
          )

      end::numeric(14,2)
        as net_total,

      sale_record.currency_code,

      sale_record.status::text
        as status,

      case

        when
          sale_record.status =
            'voided'::public.nova_sale_status

        then
          0

        else
          greatest(
            sale_record.item_quantity_total
            -
            coalesce(
              refund_quantity.refunded_quantity,
              0
            ),
            0
          )

      end
        as item_quantity_total

    from public.sales
      as sale_record

    left join (

      select

        refund_record.sale_id,

        sum(
          refund_record.amount
        )::numeric(14,2)
          as refund_amount

      from public.sale_refunds
        as refund_record

      where
        refund_record.business_id =
          p_business_id

      group by
        refund_record.sale_id

    ) as refund_total

      on
        refund_total.sale_id =
          sale_record.id

    left join (

      select

        refund_item.sale_id,

        sum(
          refund_item.quantity
        )::integer
          as refunded_quantity

      from public.sale_refund_items
        as refund_item

      where
        refund_item.business_id =
          p_business_id

      group by
        refund_item.sale_id

    ) as refund_quantity

      on
        refund_quantity.sale_id =
          sale_record.id

    where
      sale_record.business_id =
        p_business_id

      and
      sale_record.created_at >=
        v_start_ts

      and
      sale_record.created_at <
        v_end_ts

    order by
      sale_record.created_at desc

    limit 10

  ) as recent;


  -- ==========================================================
  -- RESULT
  -- ==========================================================

  return jsonb_build_object(

    'businessId',
    p_business_id,

    'timezone',
    v_timezone,

    'startDate',
    p_start_date,

    'endDate',
    p_end_date,


    'summary',
    jsonb_build_object(

      'grossRevenue',
      round(
        v_gross_revenue,
        2
      ),

      'refundAmount',
      round(
        v_refund_amount,
        2
      ),

      'revenue',
      round(
        v_revenue,
        2
      ),

      'transactions',
      v_transactions,

      'refunds',
      v_refunds,

      'itemsSold',
      v_items_sold,

      'averageSale',
      round(
        v_average_sale,
        2
      ),

      'cogs',
      round(
        v_cogs,
        2
      ),

      'grossProfit',
      round(
        v_gross_profit,
        2
      )

    ),


    'dailySales',
    v_daily_sales,

    'paymentBreakdown',
    v_payment_breakdown,

    'topProducts',
    v_top_products,

    'lowStock',
    v_low_stock,

    'recentSales',
    v_recent_sales

  );

end;

$$;


-- ============================================================
-- SECURITY
-- ============================================================

revoke all
on function
public.get_dashboard_report(
  uuid,
  date,
  date
)

from
  public,
  anon;


grant execute
on function
public.get_dashboard_report(
  uuid,
  date,
  date
)

to authenticated;


comment on function
public.get_dashboard_report(
  uuid,
  date,
  date
)

is
'NOVA refund-aware sales and profitability reporting engine.';


notify pgrst,
'reload schema';