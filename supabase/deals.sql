-- Run after Supabase Auth is configured. Worker service role is the only direct writer.
create table if not exists public.deal_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_url text not null,
  listing_title text not null,
  marketplace text not null default '',
  listing_price text not null default '',
  brief jsonb not null,
  stage text not null default 'draft' check (stage in ('draft','contacting','negotiating','terms_agreed','buyer_accepted','completed','lost','cancelled')),
  paused_at timestamptz,
  agreed_price_ron bigint,
  agreed_terms text not null default '',
  buyer_accepted_at timestamptz,
  completed_at timestamptz,
  outcome_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_url)
);

create index if not exists deal_cases_user_updated_idx on public.deal_cases (user_id, updated_at desc);
alter table public.deal_cases enable row level security;
revoke all on table public.deal_cases from anon, authenticated;
grant all on table public.deal_cases to service_role;

create table if not exists public.deal_send_attempts (
  idempotency_key uuid primary key,
  deal_id uuid not null references public.deal_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_phone text not null,
  message text not null,
  status text not null default 'pending' check (status in ('pending','accepted','failed','unknown')),
  provider_message_id text not null default '',
  delivery_status text not null default 'unknown',
  history_saved boolean not null default false,
  error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deal_send_attempts_user_deal_idx on public.deal_send_attempts (user_id, deal_id, created_at desc);
alter table public.deal_send_attempts enable row level security;
revoke all on table public.deal_send_attempts from anon, authenticated;
grant all on table public.deal_send_attempts to service_role;

create table if not exists public.deal_events (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deal_cases(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  stage text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists deal_events_user_deal_idx on public.deal_events (user_id, deal_id, created_at desc);
alter table public.deal_events enable row level security;
revoke all on table public.deal_events from anon, authenticated;
grant all on table public.deal_events to service_role;

create or replace function public.log_deal_case_change() returns trigger language plpgsql security definer set search_path = public as $$
declare event_name text;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
  elsif old.stage is distinct from new.stage then
    event_name := 'stage_changed';
  elsif old.paused_at is distinct from new.paused_at then
    event_name := case when new.paused_at is null then 'resumed' else 'paused' end;
  elsif old.agreed_price_ron is distinct from new.agreed_price_ron or old.agreed_terms is distinct from new.agreed_terms then
    event_name := 'terms_updated';
  else
    return new;
  end if;
  insert into public.deal_events (deal_id, user_id, event_type, stage, details)
  values (new.id, new.user_id, event_name, new.stage,
    jsonb_build_object('agreedPriceRon', new.agreed_price_ron, 'agreedTerms', new.agreed_terms, 'outcomeReason', new.outcome_reason));
  return new;
end;
$$;

drop trigger if exists deal_case_change_log on public.deal_cases;
create trigger deal_case_change_log after insert or update on public.deal_cases
for each row execute function public.log_deal_case_change();
