create table if not exists public.email_leads (
  email text primary key check (email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  source text not null default 'search_results_popup',
  query text not null default '',
  page_path text not null default '',
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_leads_updated_at_idx
  on public.email_leads (updated_at desc);

create index if not exists email_leads_source_idx
  on public.email_leads (source);

grant usage on schema public to anon, authenticated, service_role;
grant all on table public.email_leads to service_role;

notify pgrst, 'reload schema';
