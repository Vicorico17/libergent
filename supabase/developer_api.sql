-- Apply before enabling LIBERGENT_DEVELOPER_API_ENABLED. No browser table access.
begin;
create table if not exists public.developer_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  disabled boolean not null default false
);
create table if not exists public.developer_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.developer_accounts(user_id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  mode text not null check (mode in ('test', 'live')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  prefix text not null,
  scopes text[] not null default array['search:read'],
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '90 days',
  revoked_at timestamptz
);
create index if not exists developer_api_keys_owner on public.developer_api_keys(user_id, created_at);
create table if not exists public.developer_request_usage (
  user_id uuid not null references public.developer_accounts(user_id) on delete cascade,
  mode text not null check (mode in ('test', 'live')),
  day_start timestamptz not null,
  minute_start timestamptz not null,
  day_requests integer not null default 0,
  minute_requests integer not null default 0,
  primary key(user_id, mode)
);
alter table public.developer_accounts enable row level security;
alter table public.developer_api_keys enable row level security;
alter table public.developer_request_usage enable row level security;
revoke all on public.developer_accounts, public.developer_api_keys, public.developer_request_usage from public, anon, authenticated;
grant all on public.developer_accounts, public.developer_api_keys, public.developer_request_usage to service_role;

-- The account row is the common lock for concurrent key creation and quota use.
create or replace function public.create_developer_key(p_user_id uuid, p_name text, p_mode text, p_hash text, p_prefix text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.developer_api_keys; blocked boolean; t timestamptz := clock_timestamp();
begin
  insert into public.developer_accounts(user_id) values(p_user_id) on conflict do nothing;
  select disabled into blocked from public.developer_accounts where user_id = p_user_id for update;
  if blocked then return jsonb_build_object('error', 'developer_account_disabled'); end if;
  if (select count(*) from public.developer_api_keys where user_id = p_user_id and revoked_at is null and expires_at > t) >= 5
    or (select count(*) from public.developer_api_keys where user_id = p_user_id and created_at >= date_trunc('day', t at time zone 'UTC') at time zone 'UTC') >= 20 then
    return jsonb_build_object('error', 'api_key_limit');
  end if;
  insert into public.developer_api_keys(user_id, name, mode, token_hash, prefix)
    values(p_user_id, p_name, p_mode, p_hash, p_prefix) returning * into k;
  return jsonb_build_object('key', to_jsonb(k) - 'token_hash' - 'user_id');
end $$;

create or replace function public.consume_developer_request(p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k public.developer_api_keys; u public.developer_request_usage; blocked boolean;
  t timestamptz; d timestamptz; m timestamptz; day_limit integer; minute_limit integer;
begin
  select * into k from public.developer_api_keys where token_hash = p_hash;
  if not found then return jsonb_build_object('error', 'invalid_api_key'); end if;
  select disabled into blocked from public.developer_accounts where user_id = k.user_id for update;
  if blocked then return jsonb_build_object('error', 'developer_account_disabled'); end if;
  -- Re-read under a row lock so concurrent revocation cannot be missed.
  select * into k from public.developer_api_keys where token_hash = p_hash for share;
  t := clock_timestamp();
  if not found or k.revoked_at is not null or k.expires_at <= t then return jsonb_build_object('error', 'invalid_api_key'); end if;
  if not ('search:read' = any(k.scopes)) then return jsonb_build_object('error', 'insufficient_scope'); end if;
  d := date_trunc('day', t at time zone 'UTC') at time zone 'UTC';
  m := date_trunc('minute', t);
  day_limit := case when k.mode = 'live' then 200 else 1000 end;
  minute_limit := case when k.mode = 'live' then 10 else 60 end;
  insert into public.developer_request_usage(user_id, mode, day_start, minute_start) values(k.user_id, k.mode, d, m) on conflict do nothing;
  select * into u from public.developer_request_usage where user_id = k.user_id and mode = k.mode;
  if u.day_start <> d then u.day_requests := 0; end if;
  if u.minute_start <> m then u.minute_requests := 0; end if;
  if u.day_requests >= day_limit then
    return jsonb_build_object('error', 'quota_exceeded', 'retryAfter', greatest(1, ceil(extract(epoch from (d + interval '24 hours' - t)))));
  end if;
  if u.minute_requests >= minute_limit then
    return jsonb_build_object('error', 'quota_exceeded', 'retryAfter', greatest(1, ceil(extract(epoch from (m + interval '1 minute' - t)))));
  end if;
  update public.developer_request_usage set day_start = d, minute_start = m, day_requests = u.day_requests + 1, minute_requests = u.minute_requests + 1
    where user_id = k.user_id and mode = k.mode;
  return jsonb_build_object('mode', k.mode, 'scopes', k.scopes);
end $$;

create or replace function public.developer_usage(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb := '{}'::jsonb; kind text; u public.developer_request_usage;
  t timestamptz := clock_timestamp(); d timestamptz; m timestamptz;
begin
  d := date_trunc('day', t at time zone 'UTC') at time zone 'UTC'; m := date_trunc('minute', t);
  foreach kind in array array['test', 'live'] loop
    select * into u from public.developer_request_usage where user_id = p_user_id and mode = kind;
    result := result || jsonb_build_object(kind, jsonb_build_object(
      'dayRequests', case when u.day_start = d then u.day_requests else 0 end,
      'minuteRequests', case when u.minute_start = m then u.minute_requests else 0 end,
      'dayResetsAt', d + interval '24 hours',
      'limits', jsonb_build_object('perDay', case when kind = 'live' then 200 else 1000 end, 'perMinute', case when kind = 'live' then 10 else 60 end)));
  end loop;
  return result;
end $$;
revoke all on function public.create_developer_key(uuid,text,text,text,text), public.consume_developer_request(text), public.developer_usage(uuid) from public, anon, authenticated;
grant execute on function public.create_developer_key(uuid,text,text,text,text), public.consume_developer_request(text), public.developer_usage(uuid) to service_role;
notify pgrst, 'reload schema';
commit;
