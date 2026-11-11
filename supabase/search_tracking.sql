create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- Fresh-install baseline for moderated catalog growth. Existing deployments can run
-- supabase/shop_suggestions.sql independently; statements are idempotent.
create table if not exists public.shop_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  url text not null check (url ~* '^https?://'),
  niche text not null check (char_length(niche) between 2 and 40),
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.shop_suggestions enable row level security;
create index if not exists shop_suggestions_status_created_at_idx on public.shop_suggestions (status, created_at desc);

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
  user_id uuid,
  query text not null default '',
  feedback text not null check (feedback in ('like', 'dislike')),
  reason text not null default '',
  correction_text text not null default '',
  session_id text not null default '',
  search_id text not null default '',
  listing_fingerprint text not null default '',
  original_rank integer,
  algorithm_version text not null default '',
  applied_action text not null default '',
  query_understanding jsonb not null default '{}'::jsonb,
  listing_features jsonb not null default '{}'::jsonb,
  offer jsonb,
  offer_title text not null default '',
  offer_site text not null default '',
  offer_url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.offer_feedback
  add column if not exists reason text not null default '',
  add column if not exists user_id uuid,
  add column if not exists correction_text text not null default '',
  add column if not exists session_id text not null default '',
  add column if not exists search_id text not null default '',
  add column if not exists listing_fingerprint text not null default '',
  add column if not exists original_rank integer,
  add column if not exists algorithm_version text not null default '',
  add column if not exists applied_action text not null default '',
  add column if not exists query_understanding jsonb not null default '{}'::jsonb,
  add column if not exists listing_features jsonb not null default '{}'::jsonb;

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

create table if not exists public.vehicle_price_observations (
  id uuid primary key default gen_random_uuid(),
  listing_url text not null,
  source text not null default '',
  title text not null default '',
  price_ron numeric not null check (price_ron >= 0),
  observed_day date not null default current_date,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (listing_url, observed_day)
);

create table if not exists public.user_entitlements (
  user_id uuid primary key,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'past_due', 'cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  query text not null,
  criteria jsonb not null default '{}'::jsonb,
  events jsonb not null default '{}'::jsonb,
  frequency text not null default 'daily' check (frequency in ('daily', 'immediate')),
  channel text not null default 'email_and_in_app',
  status text not null default 'active' check (status in ('active', 'paused')),
  last_checked_at timestamptz,
  next_check_at timestamptz not null default now(),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alert_listing_state (
  alert_id uuid not null references public.alert_profiles(id) on delete cascade,
  listing_url text not null,
  latest_price_ron numeric not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  primary key (alert_id, listing_url)
);

create table if not exists public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alert_profiles(id) on delete cascade,
  user_id uuid not null,
  event_type text not null check (event_type in ('new_strong_match', 'price_drop', 'better_than_shortlist')),
  event_key text not null unique,
  listing_url text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.alert_events(id) on delete cascade,
  user_id uuid not null,
  channel text not null,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text not null default '',
  error text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now()
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
alter table public.offer_feedback enable row level security;
alter table public.saved_searches enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.alert_profiles enable row level security;
alter table public.alert_listing_state enable row level security;
alter table public.alert_events enable row level security;
alter table public.notification_deliveries enable row level security;

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

create index if not exists offer_feedback_user_created_at_idx
  on public.offer_feedback (user_id, created_at desc);

create index if not exists offer_feedback_reason_query_idx
  on public.offer_feedback (reason, query);

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

create index if not exists vehicle_price_observations_listing_date_idx
  on public.vehicle_price_observations (listing_url, observed_at asc);

create index if not exists alert_profiles_due_idx on public.alert_profiles (status, next_check_at);
create index if not exists alert_profiles_user_idx on public.alert_profiles (user_id, created_at desc);
create index if not exists alert_events_user_idx on public.alert_events (user_id, created_at desc);
create index if not exists notification_deliveries_user_idx on public.notification_deliveries (user_id, created_at desc);

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
revoke all on table public.offer_feedback from anon, authenticated;
revoke all on table public.email_leads from anon, authenticated;
grant all on table public.email_leads to service_role;
revoke all on table public.saved_searches from anon, authenticated;
grant all on table public.saved_searches to service_role;
revoke all on table public.user_entitlements from anon, authenticated;
revoke all on table public.alert_profiles from anon, authenticated;
revoke all on table public.alert_listing_state from anon, authenticated;
revoke all on table public.alert_events from anon, authenticated;
revoke all on table public.notification_deliveries from anon, authenticated;
grant all on table public.user_entitlements to service_role;
grant all on table public.alert_profiles to service_role;
grant all on table public.alert_listing_state to service_role;
grant all on table public.alert_events to service_role;
grant all on table public.notification_deliveries to service_role;
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

-- Account alerts: atomic quotas, fenced scans and durable notification batches.
-- Reapply this file before deploying the matching Worker.
alter table public.alert_profiles add column if not exists lease_until timestamptz not null default '-infinity';
alter table public.alert_profiles add column if not exists lease_token uuid;
alter table public.alert_profiles add column if not exists baseline_sources text[] not null default '{}';
alter table public.alert_events drop constraint if exists alert_events_event_type_check;
alter table public.alert_events add constraint alert_events_event_type_check
  check (event_type in ('new_match', 'new_strong_match', 'price_drop', 'better_than_shortlist'));

create or replace function public.enforce_alert_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'active' and (TG_OP = 'INSERT' or old.status <> 'active' or old.user_id <> new.user_id) then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 818));
    if (select count(*) from public.alert_profiles where user_id = new.user_id and status = 'active' and id <> new.id) >= 5 then
      raise exception 'Maximum 5 active alerts per account' using errcode = '23514';
    end if;
  end if;
  if new.status = 'paused' then new.lease_token := null; new.lease_until := '-infinity'; end if;
  return new;
end $$;
drop trigger if exists alert_active_limit on public.alert_profiles;
create trigger alert_active_limit before insert or update on public.alert_profiles
for each row execute function public.enforce_alert_limit();
revoke all on function public.enforce_alert_limit() from public, anon, authenticated;
grant execute on function public.enforce_alert_limit() to service_role;

create table if not exists public.alert_email_outbox (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alert_profiles(id) on delete cascade,
  user_id uuid not null,
  email text not null,
  query text not null,
  events jsonb not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped','unknown')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  attempted_at timestamptz,
  error text not null default '',
  provider_message_id text not null default '',
  created_at timestamptz not null default now()
);
alter table public.alert_email_outbox enable row level security;
revoke all on public.alert_email_outbox from anon, authenticated;
grant all on public.alert_email_outbox to service_role;
create index if not exists alert_email_outbox_due_idx on public.alert_email_outbox(status, next_attempt_at);

create or replace function public.commit_alert_scan(p_id uuid, p_token uuid, p_states jsonb, p_events jsonb, p_sources text[])
returns integer language plpgsql set search_path = public as $$
declare p public.alert_profiles; e jsonb; saved public.alert_events; batch jsonb := '[]'; n integer := 0;
begin
  select * into p from public.alert_profiles where id = p_id for update;
  if not found or p.status <> 'active' or p.lease_token is distinct from p_token or p.lease_until <= now() then
    raise exception 'Alert scan lease expired';
  end if;
  -- Only a successfully committed baseline enables future notifications.
  if p.last_checked_at is not null then
    for e in select value from jsonb_array_elements(p_events) where value->'payload'->>'source' = any(p.baseline_sources) loop
      insert into public.alert_events(alert_id,user_id,event_type,event_key,listing_url,payload)
      values(p.id,p.user_id,e->>'type',e->>'eventKey',e->>'listingUrl',e->'payload')
      on conflict(event_key) do nothing returning * into saved;
      if found then
        batch := batch || jsonb_build_array(to_jsonb(saved)); n := n + 1;
        if p.frequency = 'immediate' then
          insert into public.alert_email_outbox(alert_id,user_id,email,query,events)
          values(p.id,p.user_id,p.email,p.query,jsonb_build_array(to_jsonb(saved)));
        end if;
      end if;
    end loop;
    if n > 0 and p.frequency = 'daily' then
      insert into public.alert_email_outbox(alert_id,user_id,email,query,events) values(p.id,p.user_id,p.email,p.query,batch);
    end if;
  end if;
  for e in select value from jsonb_array_elements(p_states) loop
    insert into public.alert_listing_state(alert_id,listing_url,latest_price_ron,snapshot)
    values(p.id,e->>'url',(e->>'priceRon')::numeric,e)
    on conflict(alert_id,listing_url) do update set latest_price_ron=excluded.latest_price_ron, snapshot=excluded.snapshot,last_seen_at=now();
  end loop;
  update public.alert_profiles set last_checked_at=now(),last_error='',
    baseline_sources=array(select distinct unnest(p.baseline_sources || p_sources)),
    next_check_at=now() + case when p.frequency='immediate' then interval '1 hour' else interval '1 day' end,
    lease_until='-infinity',lease_token=null,updated_at=now() where id=p.id;
  return n;
end $$;
revoke all on function public.commit_alert_scan(uuid,uuid,jsonb,jsonb,text[]) from public, anon, authenticated;
grant execute on function public.commit_alert_scan(uuid,uuid,jsonb,jsonb,text[]) to service_role;

create or replace function public.claim_alert_emails(p_limit integer default 20)
returns setof public.alert_email_outbox language plpgsql set search_path = public as $$
begin
  -- A crashed/timeout submission has an uncertain outcome; never blindly resend.
  update public.alert_email_outbox set status='unknown',error='Delivery interrupted; reconcile with provider before retry.'
    where status='sending' and attempted_at < now()-interval '5 minutes';
  return query
  with due as (
    select o.id from public.alert_email_outbox o join public.alert_profiles p on p.id=o.alert_id
    where o.status in ('queued','failed') and o.attempts < 3 and o.next_attempt_at <= now() and p.status='active'
    order by o.next_attempt_at,o.id limit least(greatest(p_limit,1),20) for update of o skip locked
  ) update public.alert_email_outbox o set status='sending',attempts=attempts+1,attempted_at=now()
    from due where o.id=due.id returning o.*;
end $$;
revoke all on function public.claim_alert_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_alert_emails(integer) to service_role;
