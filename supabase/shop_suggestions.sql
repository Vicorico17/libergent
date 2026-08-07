create extension if not exists pgcrypto;

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
