create extension if not exists pgcrypto;

-- Enumerations
do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_condition') then
    create type public.listing_condition as enum (
      'unknown',
      'new',
      'like_new',
      'used_good',
      'used_fair',
      'for_parts',
      'refurbished'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'currency_strategy') then
    create type public.currency_strategy as enum (
      'as_listed',
      'fx_spot',
      'fx_daily_fix',
      'manual_override'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type public.listing_status as enum (
      'active',
      'delisted',
      'sold',
      'expired',
      'unknown'
    );
  end if;
end
$$;

create table if not exists public.marketplace_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_name text not null,
  base_url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_sellers (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.marketplace_sources(id),
  external_seller_id text not null,
  display_name text,
  seller_type text,
  profile_url text,
  location text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_seller_id)
);

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.marketplace_sources(id),
  seller_id uuid references public.marketplace_sellers(id),
  external_listing_id text not null,
  canonical_url text not null,
  title text not null default '',
  current_status public.listing_status not null default 'active',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  delisted_at timestamptz,
  ingest_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_listing_id),
  unique (source_id, canonical_url)
);

create table if not exists public.listing_item_snapshots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  observed_at timestamptz not null,
  title text not null default '',
  description text,
  listing_condition public.listing_condition not null default 'unknown',
  category text,
  attributes jsonb not null default '{}'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  source_payload jsonb,
  ingest_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (listing_id, observed_at)
);

create table if not exists public.listing_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  observed_at timestamptz not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency_code char(3) not null,
  normalized_amount_minor bigint,
  normalized_currency_code char(3),
  currency_strategy public.currency_strategy not null default 'as_listed',
  fx_rate numeric(14, 6),
  source_payload jsonb,
  ingest_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (listing_id, observed_at),
  check (currency_code = upper(currency_code)),
  check (normalized_currency_code is null or normalized_currency_code = upper(normalized_currency_code))
);

create table if not exists public.listing_trust_signals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  observed_at timestamptz not null,
  signal_key text not null,
  signal_value numeric(8, 4) not null,
  confidence numeric(5, 4) not null default 1.0 check (confidence >= 0 and confidence <= 1),
  reason text,
  ingest_idempotency_key text,
  created_at timestamptz not null default now(),
  unique (listing_id, signal_key, observed_at)
);

create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.marketplace_sources(id),
  query text not null default '',
  strategy text not null default 'direct',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  listings_seen integer not null default 0,
  listings_inserted integer not null default 0,
  listings_updated integer not null default 0,
  listings_delisted integer not null default 0,
  retention_days integer not null default 365 check (retention_days >= 30),
  retain_until timestamptz generated always as (started_at + (retention_days || ' days')::interval) stored,
  run_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ingest_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.ingest_runs(id) on delete cascade,
  source_id uuid not null references public.marketplace_sources(id),
  listing_id uuid references public.marketplace_listings(id) on delete set null,
  external_listing_id text,
  event_type text not null,
  observed_at timestamptz not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, external_listing_id, observed_at),
  unique (idempotency_key)
);

create index if not exists marketplace_listings_source_idx
  on public.marketplace_listings (source_id, updated_at desc);

create index if not exists listing_item_snapshots_listing_idx
  on public.listing_item_snapshots (listing_id, observed_at desc);

create index if not exists listing_price_snapshots_listing_idx
  on public.listing_price_snapshots (listing_id, observed_at desc);

create index if not exists listing_trust_signals_listing_idx
  on public.listing_trust_signals (listing_id, observed_at desc);

create index if not exists ingest_events_run_idx
  on public.ingest_events (run_id, observed_at desc);

-- Example listing lifecycle inserts: new -> updated -> delisted.
do $$
declare
  source_row_id uuid;
  seller_row_id uuid;
  listing_row_id uuid;
  run_row_id uuid;
begin
  insert into public.marketplace_sources (source_key, source_name, base_url)
  values ('example-market', 'Example Market', 'https://example.market')
  on conflict (source_key) do update
    set source_name = excluded.source_name
  returning id into source_row_id;

  insert into public.marketplace_sellers (source_id, external_seller_id, display_name, seller_type, profile_url, location)
  values (source_row_id, 'seller-42', 'Example Seller', 'private', 'https://example.market/u/seller-42', 'Bucharest')
  on conflict (source_id, external_seller_id) do update
    set last_seen_at = now()
  returning id into seller_row_id;

  insert into public.marketplace_listings (
    source_id,
    seller_id,
    external_listing_id,
    canonical_url,
    title,
    current_status,
    first_seen_at,
    last_seen_at,
    ingest_idempotency_key
  )
  values (
    source_row_id,
    seller_row_id,
    'listing-1001',
    'https://example.market/listing/1001',
    'iPhone 15 Pro 256GB',
    'active',
    '2026-04-01T10:00:00Z',
    '2026-04-01T10:00:00Z',
    'example-market:listings:listing-1001:create'
  )
  on conflict (source_id, external_listing_id) do update
    set title = excluded.title,
        last_seen_at = excluded.last_seen_at
  returning id into listing_row_id;

  insert into public.ingest_runs (source_id, query, strategy, status, started_at, finished_at, listings_seen, listings_inserted)
  values (source_row_id, 'iphone 15 pro', 'direct', 'done', '2026-04-01T10:00:00Z', '2026-04-01T10:01:00Z', 1, 1)
  returning id into run_row_id;

  insert into public.listing_item_snapshots (
    listing_id,
    observed_at,
    title,
    description,
    listing_condition,
    attributes,
    image_urls,
    ingest_idempotency_key
  )
  values (
    listing_row_id,
    '2026-04-01T10:00:00Z',
    'iPhone 15 Pro 256GB',
    'Like new, complete box.',
    'like_new',
    '{"storage":"256GB","color":"black"}'::jsonb,
    '["https://example.market/images/1001.jpg"]'::jsonb,
    'example-market:item-snapshot:listing-1001:2026-04-01T10:00:00Z'
  )
  on conflict (listing_id, observed_at) do nothing;

  insert into public.listing_price_snapshots (
    listing_id,
    observed_at,
    amount_minor,
    currency_code,
    normalized_amount_minor,
    normalized_currency_code,
    currency_strategy,
    fx_rate,
    ingest_idempotency_key
  )
  values
  (
    listing_row_id,
    '2026-04-01T10:00:00Z',
    1399900,
    'RON',
    1399900,
    'RON',
    'as_listed',
    null,
    'example-market:price-snapshot:listing-1001:2026-04-01T10:00:00Z'
  ),
  (
    listing_row_id,
    '2026-04-03T11:00:00Z',
    1349900,
    'RON',
    1349900,
    'RON',
    'as_listed',
    null,
    'example-market:price-snapshot:listing-1001:2026-04-03T11:00:00Z'
  )
  on conflict (listing_id, observed_at) do nothing;

  insert into public.listing_trust_signals (
    listing_id,
    observed_at,
    signal_key,
    signal_value,
    confidence,
    reason,
    ingest_idempotency_key
  )
  values (
    listing_row_id,
    '2026-04-03T11:00:00Z',
    'price_outlier_score',
    0.91,
    0.88,
    'Price close to local median and coherent seller metadata.',
    'example-market:signal:listing-1001:2026-04-03T11:00:00Z:price_outlier_score'
  )
  on conflict (listing_id, signal_key, observed_at) do nothing;

  update public.marketplace_listings
  set title = 'iPhone 15 Pro 256GB - price reduced',
      last_seen_at = '2026-04-03T11:00:00Z',
      updated_at = now()
  where id = listing_row_id;

  insert into public.ingest_events (
    run_id,
    source_id,
    listing_id,
    external_listing_id,
    event_type,
    observed_at,
    idempotency_key,
    payload
  )
  values
  (
    run_row_id,
    source_row_id,
    listing_row_id,
    'listing-1001',
    'listing_new',
    '2026-04-01T10:00:00Z',
    'example-market:event:listing-1001:new:2026-04-01T10:00:00Z',
    '{"status":"active"}'::jsonb
  ),
  (
    run_row_id,
    source_row_id,
    listing_row_id,
    'listing-1001',
    'listing_updated',
    '2026-04-03T11:00:00Z',
    'example-market:event:listing-1001:updated:2026-04-03T11:00:00Z',
    '{"status":"active","price_minor":1349900}'::jsonb
  ),
  (
    run_row_id,
    source_row_id,
    listing_row_id,
    'listing-1001',
    'listing_delisted',
    '2026-04-10T09:00:00Z',
    'example-market:event:listing-1001:delisted:2026-04-10T09:00:00Z',
    '{"status":"delisted"}'::jsonb
  )
  on conflict (idempotency_key) do nothing;

  update public.marketplace_listings
  set current_status = 'delisted',
      delisted_at = '2026-04-10T09:00:00Z',
      last_seen_at = '2026-04-10T09:00:00Z',
      updated_at = now()
  where id = listing_row_id;
end
$$;

-- Rollback notes:
-- 1) Drop dependent tables in reverse order to avoid FK violations:
--    ingest_events, ingest_runs, listing_trust_signals, listing_price_snapshots,
--    listing_item_snapshots, marketplace_listings, marketplace_sellers, marketplace_sources.
-- 2) After tables are dropped, remove enums if no longer referenced:
--    listing_status, currency_strategy, listing_condition.
-- 3) Keep retention defaults unless policy changes; ingest_runs.retain_until is generated from retention_days.
