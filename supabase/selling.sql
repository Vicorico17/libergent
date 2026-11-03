-- Run once in the Supabase SQL editor before enabling VINDE publishing.
-- Private tables are accessed only by the backend service role, never directly by browsers.
create table if not exists public.selling_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  listing jsonb not null,
  okazii_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.selling_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform = 'olx'),
  credentials text not null,
  primary key (user_id, platform)
);
create table if not exists public.selling_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists public.selling_feeds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid()
);
create table if not exists public.selling_publications (
  user_id uuid not null,
  listing_id uuid not null,
  platform text not null check (platform in ('olx', 'okazii')),
  status text not null check (status in ('sending', 'published', 'pending', 'failed', 'unknown', 'feed_ready')),
  provider_id text,
  provider_status text,
  url text not null default '',
  message text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, listing_id, platform),
  foreign key (user_id, listing_id) references public.selling_drafts(user_id, id) on delete cascade
);
alter table public.selling_publications drop constraint if exists selling_publications_status_check;
alter table public.selling_publications add constraint selling_publications_status_check
  check (status in ('sending', 'published', 'pending', 'failed', 'unknown', 'feed_ready', 'inactive', 'rejected'));
alter table public.selling_drafts enable row level security;
alter table public.selling_connections enable row level security;
alter table public.selling_oauth_states enable row level security;
alter table public.selling_feeds enable row level security;
alter table public.selling_publications enable row level security;
revoke all on public.selling_drafts, public.selling_connections, public.selling_oauth_states, public.selling_feeds, public.selling_publications from anon, authenticated;
grant all on public.selling_drafts, public.selling_connections, public.selling_oauth_states, public.selling_feeds, public.selling_publications to service_role;
-- Listing photos must be readable by marketplace importers. Uploads go through the authenticated API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('selling-images', 'selling-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
