-- Meridian Operations — Supabase schema
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- PLANS -------------------------------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_xaf integer not null,
  usage_credits integer, -- null = unlimited
  duration_days integer, -- null = credit-based only
  tools text[], -- null = all tools
  active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- USERS -------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  pin_hash text not null,
  role text not null default 'user' check (role in ('user','admin')),
  plan_id uuid references plans(id),
  usage_remaining integer,
  plan_expires_at timestamptz,
  free_uses_left integer not null default 10,
  device_sig text,
  created_at timestamptz default now()
);

-- DEVICE FINGERPRINT DEDUPE ----------------------------
create table if not exists used_fingerprints (
  device_sig text primary key,
  email text not null,
  created_at timestamptz default now()
);

-- TRANSACTIONS -----------------------------------------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  plan_id uuid references plans(id),
  ashtech_transaction_id text,
  amount_gross integer not null,
  amount_credited integer,
  currency text default 'XAF',
  status text not null default 'pending' check (status in ('pending','success','failed')),
  phone text,
  operator text,
  country_code text,
  created_at timestamptz default now()
);

-- TOOL USAGE LOG ---------------------------------------
create table if not exists tool_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  tool text not null,
  created_at timestamptz default now()
);

-- TICKETS / SUPPORT ------------------------------------
create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  email text not null,
  subject text not null,
  body text not null,
  status text not null default 'open' check (status in ('open','pending_admin','closed')),
  created_at timestamptz default now()
);

create table if not exists ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references tickets(id) on delete cascade,
  sender text not null check (sender in ('user','admin')),
  body text not null,
  attachment_url text,
  created_at timestamptz default now()
);

-- FEATURE REQUESTS -------------------------------------
create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  title text not null,
  body text,
  status text default 'open',
  created_at timestamptz default now()
);

-- SITE SETTINGS ----------------------------------------
create table if not exists site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- RLS (permissive for anon – refine in prod)
alter table plans enable row level security;
alter table users enable row level security;
alter table used_fingerprints enable row level security;
alter table transactions enable row level security;
alter table tool_usage enable row level security;
alter table tickets enable row level security;
alter table ticket_messages enable row level security;
alter table feature_requests enable row level security;
alter table site_settings enable row level security;

-- dev policies
do $$ begin
if not exists (select 1 from pg_policies where tablename='plans') then
  create policy "plans_read_all" on plans for select using (true);
  create policy "plans_write_all" on plans for all using (true) with check (true);
end if;
end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='users') then
  create policy "users_all" on users for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='used_fingerprints') then
  create policy "fp_all" on used_fingerprints for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='transactions') then
  create policy "tx_all" on transactions for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='tool_usage') then
  create policy "tu_all" on tool_usage for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='tickets') then
  create policy "t_all" on tickets for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='ticket_messages') then
  create policy "tm_all" on ticket_messages for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='feature_requests') then
  create policy "fr_all" on feature_requests for all using (true) with check (true);
end if; end $$;

do $$ begin
if not exists (select 1 from pg_policies where tablename='site_settings') then
  create policy "ss_all" on site_settings for all using (true) with check (true);
end if; end $$;

-- Seed plans
insert into plans (code,name,price_xaf,usage_credits,duration_days,tools,sort_order)
values
 ('trial','Trial 10',0,10,null,null,0),
 ('p30','Starter 30',500,30,null,null,10),
 ('p100','Pro 100',900,100,null,null,20),
 ('p500','Scale 500',1900,500,null,null,30),
 ('unlimited_1m','Unlimited 30 days',2400,null,30,null,40)
on conflict (code) do nothing;

-- Seed admin user (pin: 2370)
insert into users (email,pin_hash,role,free_uses_left)
values (
 'honesttech237@gmail.com',
 encode(digest('2370|meridian|v2','sha256'),'hex'),
 'admin',
 9999
)
on conflict (email) do update set role='admin';

-- default site settings
insert into site_settings (key,value) values
('support_email', '"honesttech237@gmail.com"'),
('ashtech_api_key', '""'),
('ashtech_webhook_secret', '""')
on conflict (key) do nothing;
