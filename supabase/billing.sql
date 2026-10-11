create table if not exists public.billing_customers (
  user_id uuid primary key,
  stripe_customer_id text not null unique,
  stripe_subscription_id text unique,
  last_event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.billing_customers enable row level security;
revoke all on table public.billing_customers from anon, authenticated;
grant all on table public.billing_customers to service_role;

create or replace function public.apply_billing_subscription(
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_expires_at timestamptz,
  p_event_created bigint
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  existing public.billing_customers%rowtype;
  applied_user_id uuid;
begin
  if p_user_id is null or p_customer_id !~ '^cus_' or p_subscription_id !~ '^sub_'
     or p_status not in ('active', 'past_due', 'cancelled') then
    raise exception 'Invalid billing subscription';
  end if;

  select * into existing from public.billing_customers where user_id = p_user_id for update;
  if found and existing.last_event_created > p_event_created then return false; end if;
  if exists (select 1 from public.billing_customers where stripe_customer_id = p_customer_id and user_id <> p_user_id) then
    raise exception 'Stripe customer belongs to another user';
  end if;

  insert into public.billing_customers (user_id, stripe_customer_id, stripe_subscription_id, last_event_created)
  values (p_user_id, p_customer_id, p_subscription_id, p_event_created)
  on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    last_event_created = excluded.last_event_created, updated_at = now()
  where public.billing_customers.last_event_created <= excluded.last_event_created
  returning user_id into applied_user_id;
  if applied_user_id is null then return false; end if;

  insert into public.user_entitlements (user_id, plan, status, expires_at)
  values (p_user_id, 'premium', p_status, p_expires_at)
  on conflict (user_id) do update set plan = 'premium', status = excluded.status,
    expires_at = excluded.expires_at, updated_at = now();
  return true;
end;
$$;

revoke all on function public.apply_billing_subscription(uuid, text, text, text, timestamptz, bigint) from public, anon, authenticated;
grant execute on function public.apply_billing_subscription(uuid, text, text, text, timestamptz, bigint) to service_role;

notify pgrst, 'reload schema';
