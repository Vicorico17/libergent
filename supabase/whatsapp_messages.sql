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
