create extension if not exists pgcrypto;
create extension if not exists unaccent;

create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  condition text not null default 'any',
  provider text not null default 'auto',
  site_keys jsonb not null default '[]'::jsonb,
  searched_at timestamptz not null default now(),
  successful_marketplaces integer not null default 0,
  marketplaces integer not null default 0,
  total_listings integer not null default 0,
  credits_used numeric not null default 0,
  best_offer jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.search_query_stats (
  query text primary key,
  search_count bigint not null default 0,
  last_searched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.keyword_stats (
  keyword text primary key,
  search_count bigint not null default 0,
  last_searched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offer_feedback (
  id uuid primary key default gen_random_uuid(),
  query text not null default '',
  feedback text not null check (feedback in ('like', 'dislike')),
  reason text not null default '',
  offer jsonb,
  offer_title text not null default '',
  offer_site text not null default '',
  offer_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.offer_feedback
  add column if not exists reason text not null default '';

create table if not exists public.email_leads (
  email text primary key,
  source text not null default 'search_results_popup',
  query text not null default '',
  page_path text not null default '',
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  query text not null,
  source text not null default 'search_results_save',
  page_path text not null default '',
  notifications_enabled boolean not null default true,
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, query)
);

alter table public.email_leads
  drop constraint if exists email_leads_email_check,
  drop constraint if exists email_leads_email_format_check;

alter table public.email_leads
  add constraint email_leads_email_format_check
  check (
    email = lower(btrim(email))
    and position('@' in email) > 1
    and position('.' in split_part(email, '@', 2)) > 1
    and position(' ' in email) = 0
  );

alter table public.email_leads enable row level security;
alter table public.saved_searches enable row level security;

create index if not exists search_events_searched_at_idx
  on public.search_events (searched_at desc);

create index if not exists search_events_query_idx
  on public.search_events (query);

create index if not exists search_query_stats_count_idx
  on public.search_query_stats (search_count desc, last_searched_at desc);

create index if not exists keyword_stats_count_idx
  on public.keyword_stats (search_count desc, last_searched_at desc);

create index if not exists offer_feedback_created_at_idx
  on public.offer_feedback (created_at desc);

create index if not exists offer_feedback_query_idx
  on public.offer_feedback (query);

create index if not exists offer_feedback_site_idx
  on public.offer_feedback (offer_site);

create index if not exists email_leads_updated_at_idx
  on public.email_leads (updated_at desc);

create index if not exists email_leads_created_at_idx
  on public.email_leads (created_at desc);

create index if not exists email_leads_source_idx
  on public.email_leads (source);

create index if not exists saved_searches_updated_at_idx
  on public.saved_searches (updated_at desc);

create index if not exists saved_searches_notifications_idx
  on public.saved_searches (notifications_enabled, last_checked_at);

create or replace function public.log_search_event(
  query_value text,
  condition_value text default 'any',
  provider_value text default 'auto',
  site_keys_value jsonb default '[]'::jsonb,
  searched_at_value timestamptz default now(),
  successful_marketplaces_value integer default 0,
  marketplaces_value integer default 0,
  total_listings_value integer default 0,
  credits_used_value numeric default 0,
  best_offer_value jsonb default null
)
returns void
language plpgsql
security definer
as $$
declare
  normalized_query text;
  normalized_text text;
  keyword_value text;
begin
  insert into public.search_events (
    query,
    condition,
    provider,
    site_keys,
    searched_at,
    successful_marketplaces,
    marketplaces,
    total_listings,
    credits_used,
    best_offer
  )
  values (
    query_value,
    condition_value,
    provider_value,
    coalesce(site_keys_value, '[]'::jsonb),
    coalesce(searched_at_value, now()),
    coalesce(successful_marketplaces_value, 0),
    coalesce(marketplaces_value, 0),
    coalesce(total_listings_value, 0),
    coalesce(credits_used_value, 0),
    best_offer_value
  );

  normalized_query := btrim(coalesce(query_value, ''));

  if normalized_query <> '' then
    insert into public.search_query_stats (query, search_count, last_searched_at, created_at, updated_at)
    values (normalized_query, 1, coalesce(searched_at_value, now()), now(), now())
    on conflict (query) do update
      set search_count = public.search_query_stats.search_count + 1,
          last_searched_at = excluded.last_searched_at,
          updated_at = now();

    normalized_text := regexp_replace(unaccent(lower(normalized_query)), '[^a-z0-9]+', ' ', 'g');

    for keyword_value in
      select token
      from regexp_split_to_table(normalized_text, '\s+') as token
      where length(token) >= 3
    loop
      insert into public.keyword_stats (keyword, search_count, last_searched_at, created_at, updated_at)
      values (keyword_value, 1, coalesce(searched_at_value, now()), now(), now())
      on conflict (keyword) do update
        set search_count = public.keyword_stats.search_count + 1,
            last_searched_at = excluded.last_searched_at,
            updated_at = now();
    end loop;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.search_events to service_role;
grant all on table public.search_query_stats to service_role;
grant all on table public.keyword_stats to service_role;
grant all on table public.offer_feedback to service_role;
revoke all on table public.email_leads from anon, authenticated;
grant all on table public.email_leads to service_role;
revoke all on table public.saved_searches from anon, authenticated;
grant all on table public.saved_searches to service_role;
grant execute on function public.log_search_event(
  text,
  text,
  text,
  jsonb,
  timestamptz,
  integer,
  integer,
  integer,
  numeric,
  jsonb
) to service_role;

notify pgrst, 'reload schema';
