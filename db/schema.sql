-- Bracerum Park · Central de Relacionamento Instagram
-- Estrutura do banco. Pode ser executada várias vezes sem efeito colateral.

create extension if not exists pgcrypto;

create table if not exists automations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  keywords      text[] not null default '{}',
  match_mode    text not null default 'contains',   -- contains | exact
  post_ids      text[] not null default '{}',       -- vazio = todas as publicações
  delivery_mode text not null default 'button',     -- button | direct
  public_reply  boolean not null default true,
  default_lang  text not null default 'pt',
  content       jsonb not null,
  pdf_url       text,
  pdf_name      text,
  pdf_size      integer,
  active        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists contacts (
  ig_user_id  text primary key,
  username    text,
  full_name   text,
  lang        text,
  company     text,
  phone       text,
  notes       text,
  stage       text not null default 'novo',
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

create table if not exists deliveries (
  id            uuid primary key default gen_random_uuid(),
  automation_id uuid references automations(id) on delete set null,
  comment_id    text not null unique,
  media_id      text,
  ig_user_id    text,
  username      text,
  comment_text  text,
  lang          text,
  status        text not null default 'received',  -- received | awaiting | delivered | duplicate | failed
  error         text,
  link_clicks   integer not null default 0,
  created_at    timestamptz not null default now(),
  opened_at     timestamptz,
  delivered_at  timestamptz
);
create index if not exists deliveries_user_idx on deliveries (ig_user_id, status, created_at desc);
create index if not exists deliveries_auto_idx on deliveries (automation_id, created_at desc);

create table if not exists messages (
  id          bigserial primary key,
  ig_user_id  text not null,
  direction   text not null,                       -- in | out
  body        text,
  mid         text unique,
  created_at  timestamptz not null default now()
);
create index if not exists messages_user_idx on messages (ig_user_id, created_at desc);

create table if not exists settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

create table if not exists event_log (
  id          bigserial primary key,
  level       text not null default 'info',        -- info | warn | error
  message     text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists event_log_created_idx on event_log (created_at desc);
