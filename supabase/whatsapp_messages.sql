create table if not exists public.whatsapp_messages (
  message_id text primary key,
  direction text not null check (direction in ('inbound', 'outbound')),
  channel text not null default 'whatsapp',
  from_number text not null,
  to_number text,
  text text not null,
  received_at timestamptz not null,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_from_number_idx
  on public.whatsapp_messages (from_number);

create index if not exists whatsapp_messages_received_at_idx
  on public.whatsapp_messages (received_at desc);

create index if not exists whatsapp_messages_user_id_idx
  on public.whatsapp_messages ((raw->>'userId'));

-- Conversation history is exposed only through the authenticated Worker API,
-- which validates the account and filters raw.userId server-side.
alter table public.whatsapp_messages enable row level security;
revoke all on table public.whatsapp_messages from anon, authenticated;
grant all on table public.whatsapp_messages to service_role;

-- Seller-wide stops are independent of buyer ownership and message retention.
create table if not exists public.whatsapp_contact_stops (
  seller_phone text primary key check (seller_phone ~ '^\+[0-9]{8,15}$'),
  stopped_at timestamptz not null default now()
);
alter table public.whatsapp_contact_stops enable row level security;
revoke all on table public.whatsapp_contact_stops from anon, authenticated;
grant all on table public.whatsapp_contact_stops to service_role;

-- Backfill recognized historical requests using the same forms as contact-stop.js.
insert into public.whatsapp_contact_stops (seller_phone, stopped_at)
select from_number, min(received_at) from public.whatsapp_messages
where direction = 'inbound' and from_number ~ '^\+[0-9]{8,15}$'
  and translate(lower(trim(text)), 'ăâîșşțţ', 'aaisstt') ~
    '^(please\s+)?stop[.!?\s]*$|\mnu mai (imi |ne |ma )?(trimite|scrie|contacta)\M|\mopreste\M|\m(do not|don''t) (message|contact|text)\M'
group by from_number
on conflict (seller_phone) do nothing;
