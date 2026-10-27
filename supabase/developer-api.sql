-- Run once before enabling self-service API keys. No production migration is automatic.
create table if not exists public.developer_accounts (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.developer_api_keys (
  id uuid primary key,
  owner_id uuid not null references public.developer_accounts(owner_id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  mode text not null check (mode in ('test', 'live')),
  prefix text not null,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (scopes @> array['search:read'] and scopes <@ array['search:read','listings:details']),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days'),
  revoked_at timestamptz
);
create index if not exists developer_api_keys_owner on public.developer_api_keys(owner_id, created_at desc);
alter table public.developer_accounts enable row level security;
alter table public.developer_api_keys enable row level security;
revoke all on public.developer_accounts, public.developer_api_keys from public, anon, authenticated;
grant all on public.developer_accounts, public.developer_api_keys to service_role;

create or replace function public.create_developer_key(p_owner uuid, p_id uuid, p_name text, p_mode text, p_scopes text[], p_prefix text, p_hash text)
returns setof public.developer_api_keys
language plpgsql security definer set search_path = public
as $$
begin
  -- Serializes creation across all projects/modes/keys for an account.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));
  insert into public.developer_accounts(owner_id) values(p_owner) on conflict do nothing;
  if exists(select 1 from public.developer_accounts where owner_id = p_owner and disabled) then
    raise exception 'developer_account_disabled';
  end if;
  if (select count(*) from public.developer_api_keys where owner_id = p_owner and revoked_at is null and expires_at > now()) >= 5
    or (select count(*) from public.developer_api_keys where owner_id = p_owner and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'api_key_limit';
  end if;
  -- Retain recent audit metadata; prevent unbounded history from repeated rotation.
  delete from public.developer_api_keys where owner_id = p_owner and created_at < now() - interval '90 days'
    and (revoked_at is not null or expires_at <= now());
  return query insert into public.developer_api_keys(id, owner_id, name, mode, prefix, key_hash, scopes)
    values(p_id, p_owner, p_name, p_mode, p_prefix, p_hash, p_scopes) returning *;
end;
$$;
create or replace function public.revoke_developer_key(p_owner uuid, p_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
begin
  update public.developer_api_keys set revoked_at = coalesce(revoked_at, now()) where id = p_id and owner_id = p_owner;
  return found;
end;
$$;
create or replace function public.lookup_developer_key(p_hash text)
returns table(owner_id uuid, mode text, scopes text[], expires_at timestamptz)
language sql security definer set search_path = public
as $$
  select k.owner_id, k.mode, k.scopes, k.expires_at from public.developer_api_keys k
  join public.developer_accounts a on a.owner_id = k.owner_id
  join auth.users u on u.id = k.owner_id
  where k.key_hash = p_hash and k.revoked_at is null and k.expires_at > now() and not a.disabled
    and u.email_confirmed_at is not null and coalesce(u.banned_until, now()) <= now();
$$;
revoke all on function public.create_developer_key(uuid,uuid,text,text,text[],text,text) from public, anon, authenticated;
revoke all on function public.revoke_developer_key(uuid,uuid) from public, anon, authenticated;
revoke all on function public.lookup_developer_key(text) from public, anon, authenticated;
grant execute on function public.create_developer_key(uuid,uuid,text,text,text[],text,text) to service_role;
grant execute on function public.revoke_developer_key(uuid,uuid) to service_role;
grant execute on function public.lookup_developer_key(text) to service_role;
notify pgrst, 'reload schema';
