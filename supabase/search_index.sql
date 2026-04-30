create table if not exists public.search_index_documents (
  listing_id text primary key,
  title text not null,
  description text,
  searchable_text text not null,
  condition text not null default 'unknown',
  location text,
  price_amount numeric,
  price_currency text,
  source_updated_at timestamptz,
  indexed_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_search_index_documents_indexed_at
  on public.search_index_documents (indexed_at desc);

create index if not exists idx_search_index_documents_location
  on public.search_index_documents (location);

create index if not exists idx_search_index_documents_condition
  on public.search_index_documents (condition);
