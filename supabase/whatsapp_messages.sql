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
