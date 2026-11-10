-- Apply after billing.sql. All mutations are server-only and serialized per owner.
create table if not exists public.search_credit_wallets (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);
create table if not exists public.search_credit_grants (
  reference text primary key,
  user_id uuid not null references public.search_credit_wallets(user_id),
  amount integer not null check (amount > 0),
  remaining integer not null check (remaining >= 0 and remaining <= amount),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists search_credit_grants_owner on public.search_credit_grants(user_id);
create table if not exists public.search_credit_usage (
  user_id uuid not null references public.search_credit_wallets(user_id),
  request_id uuid not null,
  fingerprint text not null,
  cost integer not null check (cost > 0),
  state text not null check (state in ('pending', 'completed', 'refunded')),
  allocations jsonb not null default '{}',
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

create or replace function public.search_credit_wallet(
  p_user_id uuid, p_action text, p_reference text default null,
  p_amount integer default null, p_expires_at timestamptz default null,
  p_request_id uuid default null, p_fingerprint text default null,
  p_response jsonb default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  usage_row public.search_credit_usage%rowtype;
  grant_row public.search_credit_grants%rowtype;
  allocation record;
  total integer;
  needed integer;
  take integer;
  allocations jsonb := '{}';
  result jsonb := '{}';
begin
  if p_user_id is null or p_action not in ('status', 'grant', 'reserve', 'complete', 'refund') then
    raise exception 'Invalid wallet operation';
  end if;
  insert into search_credit_wallets(user_id) values(p_user_id) on conflict do nothing;
  perform 1 from search_credit_wallets where user_id = p_user_id for update;

  -- Interrupted workers release reservations on the next wallet interaction.
  for usage_row in select * from search_credit_usage where user_id = p_user_id
    and state = 'pending' and created_at < now() - interval '10 minutes'
  loop
    for allocation in select key, value from jsonb_each_text(usage_row.allocations) loop
      update search_credit_grants set remaining = remaining + allocation.value::integer
        where reference = allocation.key and user_id = p_user_id;
    end loop;
    update search_credit_usage set state = 'refunded' where user_id = p_user_id and request_id = usage_row.request_id;
  end loop;
  -- Retain idempotency records, but do not keep search content indefinitely.
  update search_credit_usage set response = null where user_id = p_user_id
    and response is not null and created_at < now() - interval '24 hours';

  if p_action = 'grant' then
    if p_reference is null or length(p_reference) > 200 or p_amount is null or p_amount < 1 or p_amount > 100000 then
      raise exception 'Invalid credit grant';
    end if;
    select * into grant_row from search_credit_grants where reference = p_reference;
    if found and (grant_row.user_id <> p_user_id or grant_row.amount <> p_amount
      or grant_row.expires_at is distinct from p_expires_at) then raise exception 'Grant reference conflict'; end if;
    insert into search_credit_grants(reference, user_id, amount, remaining, expires_at)
      values(p_reference, p_user_id, p_amount, p_amount, p_expires_at) on conflict do nothing;
  elsif p_action in ('reserve', 'complete', 'refund') then
    if p_request_id is null then raise exception 'Request ID required'; end if;
    select * into usage_row from search_credit_usage where user_id = p_user_id and request_id = p_request_id;
    if p_action = 'reserve' then
      if p_amount is null or p_amount < 1 or p_amount > 100 or p_fingerprint is null then raise exception 'Invalid reservation'; end if;
      if found then
        if usage_row.fingerprint <> p_fingerprint or usage_row.cost <> p_amount then
          result := jsonb_build_object('code', 'request_conflict');
        elsif usage_row.state = 'completed' and usage_row.response is not null then
          result := jsonb_build_object('replay', usage_row.response);
        else
          result := jsonb_build_object('code', case when usage_row.state = 'pending' then 'search_in_progress' else 'request_expired' end);
        end if;
      else
        select coalesce(sum(remaining),0) into total from search_credit_grants
          where user_id = p_user_id and (expires_at is null or expires_at > now());
        if total < p_amount then result := jsonb_build_object('code', 'insufficient_credits');
        else
          needed := p_amount;
          for grant_row in select * from search_credit_grants where user_id = p_user_id and remaining > 0
            and (expires_at is null or expires_at > now()) order by expires_at asc nulls last, created_at, reference
          loop
            take := least(needed, grant_row.remaining);
            update search_credit_grants set remaining = remaining - take where reference = grant_row.reference;
            allocations := allocations || jsonb_build_object(grant_row.reference, take);
            needed := needed - take;
            exit when needed = 0;
          end loop;
          insert into search_credit_usage(user_id, request_id, fingerprint, cost, state, allocations)
            values(p_user_id, p_request_id, p_fingerprint, p_amount, 'pending', allocations);
          result := jsonb_build_object('reserved', true);
        end if;
      end if;
    elsif found and usage_row.state = 'pending' then
      if p_action = 'refund' then
        for allocation in select key, value from jsonb_each_text(usage_row.allocations) loop
          update search_credit_grants set remaining = remaining + allocation.value::integer
            where reference = allocation.key and user_id = p_user_id;
        end loop;
        update search_credit_usage set state = 'refunded' where user_id = p_user_id and request_id = p_request_id;
      else
        if p_response is null then raise exception 'Completed result required'; end if;
        update search_credit_usage set state = 'completed', response = p_response where user_id = p_user_id and request_id = p_request_id;
        result := jsonb_build_object('completed', true);
      end if;
    elsif p_action = 'complete' then
      result := jsonb_build_object('code', 'request_expired');
    end if;
  end if;
  return result || (select jsonb_build_object(
    'hasCredits', exists(select 1 from search_credit_grants where user_id = p_user_id),
    'balance', coalesce(sum(remaining),0),
    'included', coalesce(sum(remaining) filter(where expires_at is not null),0),
    'purchased', coalesce(sum(remaining) filter(where expires_at is null),0),
    'renewsAt', min(expires_at) filter(where expires_at is not null)
  ) from search_credit_grants where user_id = p_user_id and (expires_at is null or expires_at > now()));
end;
$$;

alter table public.search_credit_wallets enable row level security;
alter table public.search_credit_grants enable row level security;
alter table public.search_credit_usage enable row level security;
revoke all on public.search_credit_wallets, public.search_credit_grants, public.search_credit_usage from public, anon, authenticated;
grant all on public.search_credit_wallets, public.search_credit_grants, public.search_credit_usage to service_role;
revoke all on function public.search_credit_wallet(uuid,text,text,integer,timestamptz,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.search_credit_wallet(uuid,text,text,integer,timestamptz,uuid,text,jsonb) to service_role;
notify pgrst, 'reload schema';
