-- ============================================================
-- NOVA POS
-- PHASE 3D — REMOTE PHONE SCANNER
-- ============================================================

create table if not exists public.remote_scanner_sessions (
  id uuid primary key default gen_random_uuid(),

  business_id uuid not null
    references public.businesses(id)
    on delete cascade,

  created_by uuid not null
    default auth.uid()
    references auth.users(id)
    on delete cascade,

  pair_token uuid not null
    default gen_random_uuid(),

  status text not null
    default 'active'
    check (
      status in (
        'active',
        'closed'
      )
    ),

  expires_at timestamptz not null
    default (
      now() + interval '8 hours'
    ),

  closed_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  unique (pair_token)
);


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists
remote_scanner_sessions_business_id_idx
on public.remote_scanner_sessions (
  business_id
);


create index if not exists
remote_scanner_sessions_created_by_idx
on public.remote_scanner_sessions (
  created_by
);


create index if not exists
remote_scanner_sessions_pair_token_idx
on public.remote_scanner_sessions (
  pair_token
);


create index if not exists
remote_scanner_sessions_active_idx
on public.remote_scanner_sessions (
  business_id,
  status,
  expires_at
);


-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

drop trigger if exists
remote_scanner_sessions_set_updated_at
on public.remote_scanner_sessions;


create trigger
remote_scanner_sessions_set_updated_at

before update
on public.remote_scanner_sessions

for each row

execute function public.set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

alter table
public.remote_scanner_sessions
enable row level security;


-- Remove default table access first.

revoke all
on public.remote_scanner_sessions
from anon;


revoke all
on public.remote_scanner_sessions
from authenticated;


grant
select,
insert,
update
on public.remote_scanner_sessions
to authenticated;


-- ============================================================
-- SELECT
-- Business members may see scanner sessions for their business.
-- ============================================================

drop policy if exists
nova_remote_scanner_sessions_select
on public.remote_scanner_sessions;


create policy
nova_remote_scanner_sessions_select

on public.remote_scanner_sessions

for select

to authenticated

using (
  (
    select private.is_business_member(
      business_id
    )
  )
);


-- ============================================================
-- INSERT
-- Any authenticated active business member can create
-- a scanner session.
-- ============================================================

drop policy if exists
nova_remote_scanner_sessions_insert
on public.remote_scanner_sessions;


create policy
nova_remote_scanner_sessions_insert

on public.remote_scanner_sessions

for insert

to authenticated

with check (

  (
    select private.is_business_member(
      business_id
    )
  )

  and created_by = (
    select auth.uid()
  )

  and expires_at > now()

  and expires_at <= (
    now() + interval '24 hours'
  )

);


-- ============================================================
-- UPDATE
-- Only the user who created the pairing session may close it.
-- ============================================================

drop policy if exists
nova_remote_scanner_sessions_update
on public.remote_scanner_sessions;


create policy
nova_remote_scanner_sessions_update

on public.remote_scanner_sessions

for update

to authenticated

using (

  (
    select private.is_business_member(
      business_id
    )
  )

  and created_by = (
    select auth.uid()
  )

)

with check (

  (
    select private.is_business_member(
      business_id
    )
  )

  and created_by = (
    select auth.uid()
  )

);


-- ============================================================
-- PUBLIC PAIRING LOOKUP
--
-- The phone does NOT get direct table access.
--
-- It only knows a high-entropy UUID pair token.
--
-- This function returns only safe information required
-- to establish the temporary scanner connection.
-- ============================================================

drop function if exists
public.resolve_remote_scanner_session(text);


create or replace function
public.resolve_remote_scanner_session(
  p_pair_token text
)

returns table (

  session_id uuid,

  business_name text,

  expires_at timestamptz

)

language sql

stable

security definer

set search_path = ''

as $$

  select

    scanner_session.id,

    business.name,

    scanner_session.expires_at

  from public.remote_scanner_sessions
    as scanner_session

  join public.businesses
    as business

    on business.id =
      scanner_session.business_id

  where

    lower(
      scanner_session.pair_token::text
    )
    =
    lower(
      trim(p_pair_token)
    )

    and scanner_session.status =
      'active'

    and scanner_session.expires_at >
      now()

  limit 1;

$$;


revoke all
on function
public.resolve_remote_scanner_session(text)
from public;


grant execute
on function
public.resolve_remote_scanner_session(text)
to anon;


grant execute
on function
public.resolve_remote_scanner_session(text)
to authenticated;


comment on table
public.remote_scanner_sessions
is
'Temporary NOVA POS sessions used to pair a phone camera with a laptop POS terminal.';


comment on function
public.resolve_remote_scanner_session(text)
is
'Validates a temporary scanner pair token without exposing scanner session table access.';