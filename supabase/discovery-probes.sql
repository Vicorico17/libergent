create extension if not exists pgcrypto;

create table if not exists public.discovery_probe_terms (
  query text primary key check (char_length(query) between 3 and 80),
  origin text not null check (origin in ('search_history', 'result_expansion', 'manual')),
  parent_query text,
  search_count integer not null default 0 check (search_count >= 0),
  priority integer not null default 10 check (priority between 0 and 100),
  useful_count integer not null default 0 check (useful_count >= 0),
  irrelevant_count integer not null default 0 check (irrelevant_count >= 0),
  status text not null default 'queued' check (status in ('queued', 'ignored')),
  last_probed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_probe_terms_due_idx
  on public.discovery_probe_terms (status, last_probed_at asc nulls first, priority desc, search_count desc);

create table if not exists public.discovery_probe_runs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  source_site text not null,
  parent_query text,
  outcome text not null check (outcome in ('results', 'empty', 'error')),
  results_count integer not null default 0,
  parsed_count integer not null default 0,
  failed_sources jsonb not null default '[]'::jsonb,
  offers jsonb not null default '[]'::jsonb,
  suggested_queries jsonb not null default '[]'::jsonb,
  elapsed_ms integer not null default 0,
  error text not null default '',
  searched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists discovery_probe_runs_searched_at_idx
  on public.discovery_probe_runs (searched_at desc);

create table if not exists public.discovery_probe_state (
  id smallint primary key default 1 check (id = 1),
  lease_until timestamptz not null default 'epoch',
  lease_token text,
  source_cursor integer not null default 0 check (source_cursor >= 0),
  updated_at timestamptz not null default now()
);

insert into public.discovery_probe_state (id) values (1)
on conflict (id) do nothing;

create table if not exists public.discovery_probe_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  query text not null,
  feedback text not null check (feedback in ('useful', 'irrelevant')),
  created_at timestamptz not null default now(),
  unique (user_id, query)
);

alter table public.discovery_probe_terms enable row level security;
alter table public.discovery_probe_runs enable row level security;
alter table public.discovery_probe_state enable row level security;
alter table public.discovery_probe_feedback enable row level security;

revoke all on table public.discovery_probe_terms from anon, authenticated;
revoke all on table public.discovery_probe_runs from anon, authenticated;
revoke all on table public.discovery_probe_state from anon, authenticated;
revoke all on table public.discovery_probe_feedback from anon, authenticated;
grant all on table public.discovery_probe_terms to service_role;
grant all on table public.discovery_probe_runs to service_role;
grant all on table public.discovery_probe_state to service_role;
grant all on table public.discovery_probe_feedback to service_role;

create or replace function public.record_discovery_probe_feedback(
  query_value text,
  user_value uuid,
  feedback_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prior_feedback text;
begin
  if feedback_value not in ('useful', 'irrelevant') then
    raise exception 'Unsupported discovery feedback';
  end if;
  if not exists (select 1 from public.discovery_probe_terms where query = query_value) then
    raise exception 'Discovery query not found';
  end if;

  select feedback into prior_feedback
  from public.discovery_probe_feedback
  where user_id = user_value and query = query_value;

  insert into public.discovery_probe_feedback (user_id, query, feedback)
  values (user_value, query_value, feedback_value)
  on conflict (user_id, query) do update
    set feedback = excluded.feedback, created_at = now();

  update public.discovery_probe_terms
  set useful_count = greatest(0, useful_count + (case when feedback_value = 'useful' then 1 else 0 end) - (case when prior_feedback = 'useful' then 1 else 0 end)),
      irrelevant_count = greatest(0, irrelevant_count + (case when feedback_value = 'irrelevant' then 1 else 0 end) - (case when prior_feedback = 'irrelevant' then 1 else 0 end)),
      priority = greatest(0, least(100, priority + (case when feedback_value = 'useful' then 5 else -5 end) - (case when prior_feedback = 'useful' then 5 else case when prior_feedback = 'irrelevant' then -5 else 0 end end))),
      updated_at = now()
  where query = query_value;
end;
$$;

revoke all on function public.record_discovery_probe_feedback(text, uuid, text) from public, anon, authenticated;
grant execute on function public.record_discovery_probe_feedback(text, uuid, text) to service_role;
