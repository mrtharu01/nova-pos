-- ============================================================
-- NOVA POS
-- DASHBOARD REPORTING ENGINE
--
-- Refund / return / void aware
--
-- Reporting model:
--
--   completed sale
--     = full sale value
--
--   partially refunded sale
--     = original sale - refunds
--
--   fully refunded sale
--     = 0 net revenue
--
--   voided sale
--     = completely excluded
--
-- Refunds are attributed back to the original sale date.
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


  v_revenue numeric(14,2) :=
    0;

  v_transactions bigint :=
    0;

  v_items_sold bigint :=
    0;

  v_average_sale numeric(14,2) :=
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
  -- AUTHENTICATION
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
  -- DATE VALIDATION
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
      'Dashboard reporting range cannot exceed 366 days';

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
  -- Revenue:
  --
  -- original sale
  -- minus all refunds belonging to the sale
  --
  -- Voided sales contribute nothing.
  --
  -- Items sold:
  --
  -- original quantity
  -- minus all refunded quantity
  -- ==========================================================

  select

    coalesce(
      sum(
        greatest(
          sale_record.total
          -
          coalesce(
            refund_summary.refunded_amount,
            0
          ),
          0
        )
      ),
      0
    )::numeric(14,2),

    count(*)::bigint,

    coalesce(
      sum(
        greatest(
          sale_record.item_quantity_total
          -
          coalesce(
            refund_item_summary.refunded_quantity,
            0
          ),
          0
        )
      ),
      0
    )::bigint

  into

    v_revenue,

    v_transactions,

    v_items_sold

  from public.sales
    as sale_record


  left join lateral (

    select

      coalesce(
        sum(
          refund_record.amount
        ),
        0
      )::numeric(14,2)
        as refunded_amount

    from public.sale_refunds
      as refund_record

    where
      refund_record.business_id =
        sale_record.business_id

      and
      refund_record.sale_id =
        sale_record.id

  ) as refund_summary

    on true


  left join lateral (

    select

      coalesce(
        sum(
          refund_item.quantity
        ),
        0
      )::bigint
        as refunded_quantity

    from public.sale_refund_items
      as refund_item

    where
      refund_item.business_id =
        sale_record.business_id

      and
      refund_item.sale_id =
        sale_record.id

  ) as refund_item_summary

    on true


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


  -- ==========================================================
  -- AVERAGE SALE
  -- ==========================================================

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
  -- GROSS PROFIT
  --
  -- Original:
  --
  --   line revenue
  --   -
  --   COGS
  --
  -- After refund:
  --
  --   line revenue
  --   -
  --   refunded revenue
  --   -
  --   remaining COGS
  --
  -- If the returned unit is restocked,
  -- its COGS is reversed.
  --
  -- If it is NOT restocked, the business still carries
  -- that cost because the item was lost/damaged/etc.
  --
  -- Example:
  --
  -- sold for      1000
  -- cost           600
  -- profit         400
  --
  -- fully refunded + restocked
  -- profit           0
  --
  -- fully refunded + NOT restocked
  -- profit        -600
  -- ==========================================================

  select

    coalesce(
      sum(

        (
          item_record.line_total
          -
          coalesce(
            refund_summary.refunded_revenue,
            0
          )
        )

        -

        (
          item_record.unit_cost

          *

          greatest(
            item_record.quantity
            -
            coalesce(
              refund_summary.restocked_quantity,
              0
            ),
            0
          )
        )

      ),
      0
    )::numeric(14,2)

  into
    v_gross_profit

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


  left join lateral (

    select

      coalesce(
        sum(
          refund_item.line_refund_total
        ),
        0
      )::numeric(14,2)
        as refunded_revenue,


      coalesce(
        sum(
          case
            when
              refund_item.restocked
            then
              refund_item.quantity
            else
              0
          end
        ),
        0
      )::bigint
        as restocked_quantity


    from public.sale_refund_items
      as refund_item


    where
      refund_item.business_id =
        item_record.business_id

      and
      refund_item.sale_item_id =
        item_record.id

  ) as refund_summary

    on true


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


  -- ==========================================================
  -- DAILY NET SALES
  --
  -- Refunds remain attached to the original sale date.
  --
  -- This means the dashboard graph represents the current
  -- net result of transactions created on each day.
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

      select

        (
          sale_record.created_at
          at time zone
          v_timezone
        )::date
          as sale_date,


        sum(
          greatest(
            sale_record.total
            -
            coalesce(
              refund_summary.refunded_amount,
              0
            ),
            0
          )
        )::numeric(14,2)
          as revenue,


        count(*)::bigint
          as transactions,


        sum(
          greatest(
            sale_record.item_quantity_total
            -
            coalesce(
              refund_item_summary.refunded_quantity,
              0
            ),
            0
          )
        )::bigint
          as items_sold


      from public.sales
        as sale_record


      left join lateral (

        select

          coalesce(
            sum(
              refund_record.amount
            ),
            0
          )::numeric(14,2)
            as refunded_amount

        from public.sale_refunds
          as refund_record

        where
          refund_record.business_id =
            sale_record.business_id

          and
          refund_record.sale_id =
            sale_record.id

      ) as refund_summary

        on true


      left join lateral (

        select

          coalesce(
            sum(
              refund_item.quantity
            ),
            0
          )::bigint
            as refunded_quantity

        from public.sale_refund_items
          as refund_item

        where
          refund_item.business_id =
            sale_record.business_id

          and
          refund_item.sale_id =
            sale_record.id

      ) as refund_item_summary

        on true


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
  -- Original payments are positive.
  -- Refund methods are negative.
  --
  -- Example:
  --
  -- Cash sale       +5000
  -- Cash refund     -1500
  --
  -- Cash net         3500
  --
  -- A fully refunded payment therefore becomes zero.
  --
  -- Payment status itself is NOT used to remove the original
  -- payment because partially_refunded/refunded payments still
  -- represent the original money received.
  --
  -- Voided transactions are excluded completely.
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

    select

      payment_event.method,

      sum(
        payment_event.amount
      )::numeric(14,2)
        as amount,

      count(
        distinct
        payment_event.sale_id
      )::bigint
        as transactions


    from (

      -- ======================================================
      -- ORIGINAL PAYMENT
      -- ======================================================

      select

        payment_record.method::text
          as method,

        payment_record.amount::numeric(14,2)
          as amount,

        payment_record.sale_id
          as sale_id


      from public.payments
        as payment_record


      join public.sales
        as sale_record

        on
          sale_record.id =
            payment_record.sale_id

        and
          sale_record.business_id =
            payment_record.business_id


      where
        payment_record.business_id =
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

        and
        payment_record.status <>
          'voided'::public.nova_payment_status


      union all


      -- ======================================================
      -- REFUND PAYMENT
      -- ======================================================

      select

        refund_record.refund_method::text
          as method,

        (
          -refund_record.amount
        )::numeric(14,2)
          as amount,

        refund_record.sale_id
          as sale_id


      from public.sale_refunds
        as refund_record


      join public.sales
        as sale_record

        on
          sale_record.id =
            refund_record.sale_id

        and
          sale_record.business_id =
            refund_record.business_id


      where
        refund_record.business_id =
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

    ) as payment_event


    group by
      payment_event.method

  ) as payment_summary;


  -- ==========================================================
  -- TOP PRODUCTS
  --
  -- Quantity and revenue are now NET.
  --
  -- Original sale item:
  --
  --   + quantity
  --   + revenue
  --
  -- Refund:
  --
  --   - quantity
  --   - revenue
  --
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

    select

      product_event.product_id,

      product_event.product_name,


      sum(
        product_event.quantity
      )::bigint
        as quantity,


      sum(
        product_event.revenue
      )::numeric(14,2)
        as revenue


    from (

      -- ======================================================
      -- ORIGINAL SOLD PRODUCT
      -- ======================================================

      select

        item_record.product_id
          as product_id,

        item_record.product_name
          as product_name,

        item_record.quantity::bigint
          as quantity,

        item_record.line_total::numeric(14,2)
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


      union all


      -- ======================================================
      -- REFUNDED PRODUCT
      -- ======================================================

      select

        refund_item.product_id
          as product_id,

        refund_item.product_name
          as product_name,

        (
          -refund_item.quantity
        )::bigint
          as quantity,

        (
          -refund_item.line_refund_total
        )::numeric(14,2)
          as revenue


      from public.sale_refund_items
        as refund_item


      join public.sales
        as sale_record

        on
          sale_record.id =
            refund_item.sale_id

        and
          sale_record.business_id =
            refund_item.business_id


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

    ) as product_event


    group by

      product_event.product_id,

      product_event.product_name


    having

      sum(
        product_event.quantity
      ) <> 0

      or

      sum(
        product_event.revenue
      ) <> 0


    order by

      revenue desc,

      quantity desc


    limit 5

  ) as product_summary;


  -- ==========================================================
  -- LOW STOCK
  --
  -- Current inventory snapshot.
  --
  -- Not date-range dependent.
  --
  -- Refund restocking already updates inventory_levels,
  -- so no special calculation is needed here.
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

      variant_record.sku
        as sku,

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
  --
  -- total = current NET amount
  --
  -- itemQuantityTotal = current NET quantity
  --
  -- voided:
  --
  -- total = 0
  -- quantity = 0
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
          recent.net_total,

          'currencyCode',
          recent.currency_code,

          'status',
          recent.status,

          'itemQuantityTotal',
          recent.net_item_quantity

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

      sale_record.currency_code,

      sale_record.status::text
        as status,


      case

        when
          sale_record.status =
            'voided'::public.nova_sale_status

        then
          0::numeric(14,2)

        else
          greatest(
            sale_record.total
            -
            coalesce(
              refund_summary.refunded_amount,
              0
            ),
            0
          )::numeric(14,2)

      end
        as net_total,


      case

        when
          sale_record.status =
            'voided'::public.nova_sale_status

        then
          0::bigint

        else
          greatest(
            sale_record.item_quantity_total
            -
            coalesce(
              refund_item_summary.refunded_quantity,
              0
            ),
            0
          )::bigint

      end
        as net_item_quantity


    from public.sales
      as sale_record


    left join lateral (

      select

        coalesce(
          sum(
            refund_record.amount
          ),
          0
        )::numeric(14,2)
          as refunded_amount

      from public.sale_refunds
        as refund_record

      where
        refund_record.business_id =
          sale_record.business_id

        and
        refund_record.sale_id =
          sale_record.id

    ) as refund_summary

      on true


    left join lateral (

      select

        coalesce(
          sum(
            refund_item.quantity
          ),
          0
        )::bigint
          as refunded_quantity

      from public.sale_refund_items
        as refund_item

      where
        refund_item.business_id =
          sale_record.business_id

        and
        refund_item.sale_id =
          sale_record.id

    ) as refund_item_summary

      on true


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


    limit 8

  ) as recent;


  -- ==========================================================
  -- FINAL REPORT
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

      'revenue',
      round(
        v_revenue,
        2
      ),

      'transactions',
      v_transactions,

      'itemsSold',
      v_items_sold,

      'averageSale',
      round(
        v_average_sale,
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
'NOVA POS secure refund-aware dashboard reporting function.';