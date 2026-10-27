-- Independent from user_entitlements: a Premium renewal/cancellation must not
-- grant or revoke the separately purchased Agent service.
create table if not exists public.agent_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive'
    check (status in ('inactive', 'active', 'cancelled', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_entitlements enable row level security;
revoke all on table public.agent_entitlements from public, anon, authenticated;
grant all on table public.agent_entitlements to service_role;

-- No automatic migration from Premium: search access is not Agent access.
-- Grant/revoke only through trusted administration until Agent billing is ready.
notify pgrst, 'reload schema';
