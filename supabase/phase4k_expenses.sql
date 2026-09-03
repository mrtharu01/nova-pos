-- ============================================================
-- NOVA POS
-- PHASE 4K — EXPENSES
-- ============================================================


-- ============================================================
-- EXPENSES TABLE
-- ============================================================

create table if not exists
public.expenses (

  id uuid primary key
    default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  expense_date date not null
    default current_date,

  category text not null
    default 'other'
    check (
      category in (
        'rent',
        'utilities',
        'salaries',
        'supplies',
        'transport',
        'marketing',
        'maintenance',
        'equipment',
        'fees',
        'other'
      )
    ),

  title text not null,

  vendor text,

  amount numeric(12,2) not null
    check (
      amount > 0
    ),

  payment_method public.nova_payment_method
    not null
    default 'cash',

  reference_number text,

  note text not null
    default '',

  created_by_user_id uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint expenses_id_business_unique
    unique (
      id,
      business_id
    )

);


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
expenses_business_date_idx

on public.expenses (
  business_id,
  expense_date desc
);


create index if not exists
expenses_business_category_idx

on public.expenses (
  business_id,
  category
);


create index if not exists
expenses_created_by_idx

on public.expenses (
  created_by_user_id
);


-- ============================================================
-- UPDATED AT
-- ============================================================

create or replace function
private.nova_touch_expense_updated_at()

returns trigger

language plpgsql

security definer

set search_path = ''

as $$

begin

  new.updated_at :=
    now();

  return new;

end;

$$;


drop trigger if exists
nova_expenses_touch_updated_at
on public.expenses;


create trigger
nova_expenses_touch_updated_at

before update

on public.expenses

for each row

execute function
private.nova_touch_expense_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table
public.expenses
enable row level security;


revoke all
on public.expenses
from anon;


grant
  select,
  insert,
  update,
  delete

on public.expenses

to authenticated;


-- SELECT

drop policy if exists
nova_expenses_select
on public.expenses;


create policy
nova_expenses_select

on public.expenses

for select

to authenticated

using (
  (
    select private.is_business_manager(
      business_id
    )
  )
);


-- INSERT

drop policy if exists
nova_expenses_insert
on public.expenses;


create policy
nova_expenses_insert

on public.expenses

for insert

to authenticated

with check (
  (
    select private.is_business_manager(
      business_id
    )
  )
  and
  created_by_user_id =
    (
      select auth.uid()
    )
);


-- UPDATE

drop policy if exists
nova_expenses_update
on public.expenses;


create policy
nova_expenses_update

on public.expenses

for update

to authenticated

using (
  (
    select private.is_business_manager(
      business_id
    )
  )
)

with check (
  (
    select private.is_business_manager(
      business_id
    )
  )
);


-- DELETE

drop policy if exists
nova_expenses_delete
on public.expenses;


create policy
nova_expenses_delete

on public.expenses

for delete

to authenticated

using (
  (
    select private.is_business_manager(
      business_id
    )
  )
);


-- ============================================================
-- EXPENSE REPORT RPC
-- ============================================================

create or replace function
public.get_expense_report(

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


  v_total numeric(14,2) :=
    0;


  v_count bigint :=
    0;


  v_average numeric(14,2) :=
    0;


  v_category_breakdown jsonb :=
    '[]'::jsonb;


  v_daily_expenses jsonb :=
    '[]'::jsonb;


  v_recent_expenses jsonb :=
    '[]'::jsonb;


begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  if v_user_id is null then

    raise exception
      'Authentication required'

      using errcode =
        '42501';

  end if;


  if p_business_id is null then

    raise exception
      'Business is required';

  end if;


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
      'Expense reporting range cannot exceed 366 days';

  end if;


  -- ==========================================================
  -- SUMMARY
  -- ==========================================================

  select

    coalesce(
      sum(
        expense_record.amount
      ),
      0
    ),

    count(*)

  into

    v_total,

    v_count

  from public.expenses
    as expense_record

  where
    expense_record.business_id =
      p_business_id

    and
    expense_record.expense_date >=
      p_start_date

    and
    expense_record.expense_date <=
      p_end_date;


  if
    v_count >
    0
  then

    v_average :=
      round(
        v_total /
        v_count,
        2
      );

  end if;


  -- ==========================================================
  -- CATEGORY BREAKDOWN
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'category',
          summary.category,

          'amount',
          summary.amount,

          'count',
          summary.expense_count

        )

        order by
          summary.amount desc

      ),

      '[]'::jsonb

    )

  into
    v_category_breakdown

  from (

    select

      expense_record.category,

      sum(
        expense_record.amount
      )::numeric(14,2)
        as amount,

      count(*)::bigint
        as expense_count

    from public.expenses
      as expense_record

    where
      expense_record.business_id =
        p_business_id

      and
      expense_record.expense_date >=
        p_start_date

      and
      expense_record.expense_date <=
        p_end_date

    group by
      expense_record.category

  ) as summary;


  -- ==========================================================
  -- DAILY EXPENSES
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'date',
          daily.expense_date,

          'amount',
          daily.amount,

          'count',
          daily.expense_count

        )

        order by
          daily.expense_date

      ),

      '[]'::jsonb

    )

  into
    v_daily_expenses

  from (

    select

      calendar.day::date
        as expense_date,

      coalesce(
        expense_summary.amount,
        0
      )::numeric(14,2)
        as amount,

      coalesce(
        expense_summary.expense_count,
        0
      )::bigint
        as expense_count

    from pg_catalog.generate_series(

      p_start_date::timestamp,

      p_end_date::timestamp,

      interval '1 day'

    ) as calendar(day)

    left join (

      select

        expense_record.expense_date,

        sum(
          expense_record.amount
        )::numeric(14,2)
          as amount,

        count(*)::bigint
          as expense_count

      from public.expenses
        as expense_record

      where
        expense_record.business_id =
          p_business_id

        and
        expense_record.expense_date >=
          p_start_date

        and
        expense_record.expense_date <=
          p_end_date

      group by
        expense_record.expense_date

    ) as expense_summary

    on
      expense_summary.expense_date =
        calendar.day::date

  ) as daily;


  -- ==========================================================
  -- RECENT EXPENSES
  -- ==========================================================

  select

    coalesce(

      jsonb_agg(

        jsonb_build_object(

          'id',
          recent.id,

          'date',
          recent.expense_date,

          'category',
          recent.category,

          'title',
          recent.title,

          'vendor',
          recent.vendor,

          'amount',
          recent.amount,

          'paymentMethod',
          recent.payment_method,

          'referenceNumber',
          recent.reference_number,

          'note',
          recent.note

        )

        order by
          recent.expense_date desc,
          recent.created_at desc

      ),

      '[]'::jsonb

    )

  into
    v_recent_expenses

  from (

    select
      expense_record.*

    from public.expenses
      as expense_record

    where
      expense_record.business_id =
        p_business_id

      and
      expense_record.expense_date >=
        p_start_date

      and
      expense_record.expense_date <=
        p_end_date

    order by
      expense_record.expense_date desc,
      expense_record.created_at desc

    limit 10

  ) as recent;


  -- ==========================================================
  -- RESULT
  -- ==========================================================

  return jsonb_build_object(

    'businessId',
    p_business_id,

    'startDate',
    p_start_date,

    'endDate',
    p_end_date,

    'summary',
    jsonb_build_object(

      'total',
      round(
        v_total,
        2
      ),

      'count',
      v_count,

      'average',
      round(
        v_average,
        2
      )

    ),

    'categoryBreakdown',
    v_category_breakdown,

    'dailyExpenses',
    v_daily_expenses,

    'recentExpenses',
    v_recent_expenses

  );

end;

$$;


-- ============================================================
-- RPC SECURITY
-- ============================================================

revoke all
on function
public.get_expense_report(
  uuid,
  date,
  date
)
from
  public,
  anon;


grant execute
on function
public.get_expense_report(
  uuid,
  date,
  date
)
to authenticated;


comment on table
public.expenses

is
'NOVA POS operating expenses. Inventory COGS is tracked separately and should not be duplicated here.';


comment on function
public.get_expense_report(
  uuid,
  date,
  date
)

is
'NOVA POS manager-only expense reporting RPC.';


notify pgrst,
'reload schema';