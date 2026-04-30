create table if not exists public.search_index_documents (
  listing_id uuid primary key references public.marketplace_listings(id) on delete cascade,
  source_key text not null,
  source_name text not null,
  canonical_url text not null,
  title text not null default '',
  description text not null default '',
  listing_condition public.listing_condition not null default 'unknown',
  location text not null default '',
  category text not null default '',
  current_status public.listing_status not null default 'unknown',
  normalized_price_minor bigint,
  normalized_currency_code char(3),
  observed_at timestamptz not null,
  searchable_text text not null default '',
  updated_at timestamptz not null default now(),
  check (normalized_currency_code is null or normalized_currency_code = upper(normalized_currency_code))
);

create index if not exists search_index_documents_status_idx
  on public.search_index_documents (current_status, updated_at desc);

create index if not exists search_index_documents_price_idx
  on public.search_index_documents (normalized_currency_code, normalized_price_minor);

create index if not exists search_index_documents_source_idx
  on public.search_index_documents (source_key, updated_at desc);
