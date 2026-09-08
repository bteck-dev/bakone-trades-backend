-- ============================================================
-- BAKONE TRADES â€” SUPABASE SCHEMA
-- Run this in Supabase â†’ SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- â”€â”€ ADMINS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists admins (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  password text not null,
  created_at timestamptz default now()
);

-- â”€â”€ PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  version text,
  slug text not null unique,
  description text,
  features jsonb default '[]',
  price numeric(10,2) not null,
  image_url text,
  payment_link text,
  is_visible boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- â”€â”€ ORDERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- key_status tracks manual delivery (admin sends key via WhatsApp/Email)
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_id text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  product_id uuid references products(id),
  product_name text not null,
  amount numeric(10,2) not null,
  currency text default 'ZAR',
  payment_status text default 'pending' check (payment_status in ('pending','paid','failed','cancelled')),
  payfast_payment_id text,
  payment_provider text default 'ikhokha',
  payment_method text default 'card' check (payment_method in ('card','eft','apple_pay','google_pay')),
  -- Manual delivery tracking
  key_status text default 'pending_delivery' check (key_status in ('pending_delivery','delivered','cancelled')),
  delivery_method text check (delivery_method in ('whatsapp','email','both')),
  delivered_by uuid references admins(id),
  delivered_at timestamptz,
  delivery_notes text,
  whatsapp_link text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- â”€â”€ LICENSE NOTES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Admin notes about key delivery (no keys stored here â€” RoboTrader handles that)
create table if not exists license_notes (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  note text not null,
  order_id text references orders(order_id),
  created_by uuid references admins(id),
  created_at timestamptz default now()
);

-- â”€â”€ AUDIT LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  action text not null,
  admin_id uuid references admins(id),
  entity_type text,
  entity_id text,
  description text not null,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz default now()
);

-- â”€â”€ MESSAGE LOGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists conversation_threads (
  id uuid primary key default uuid_generate_v4(),
  order_id text references orders(order_id),
  customer_email text,
  customer_phone text,
  customer_name text,
  subject text,
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists message_logs (
  id uuid primary key default uuid_generate_v4(),
  thread_id uuid references conversation_threads(id),
  order_id text references orders(order_id),
  channel text not null check (channel in ('email','whatsapp')),
  direction text not null default 'outbound' check (direction in ('inbound','outbound')),
  recipient text not null,
  sender text,
  subject text,
  body_text text,
  body_html text,
  status text not null default 'draft' check (status in ('draft','prepared','sent','delivered','read','received','failed')),
  provider_message_id text,
  provider_response jsonb,
  error_message text,
  provider_status text,
  provider_timestamp timestamptz,
  sent_by uuid references admins(id),
  sent_at timestamptz,
  created_at timestamptz default now()
);

alter table message_logs add column if not exists thread_id uuid references conversation_threads(id);
alter table message_logs add column if not exists sender text;
alter table message_logs add column if not exists provider_status text;
alter table message_logs add column if not exists provider_timestamp timestamptz;

alter table products add column if not exists payment_link text;

update products set payment_link = null where slug in ('fx-killer-pv4-pro', 'poverty-scalper-ea');

alter table orders add column if not exists payment_provider text default 'ikhokha';
alter table orders alter column payment_provider set default 'ikhokha';
alter table orders drop constraint if exists orders_payment_method_check;
alter table orders add column if not exists payment_method text default 'card';
alter table orders alter column payment_method set default 'card';
alter table orders add constraint orders_payment_method_check check (payment_method in ('card','eft','apple_pay','google_pay'));

-- â”€â”€ SEED PRODUCTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
insert into products (name, version, slug, description, features, price, payment_link, is_visible)
values
(
  'FX Killer PV4.0 Pro', '4.0 Pro', 'fx-killer-pv4-pro',
  'Analyzes real-time market data using price action, spread, volatility, RSI, Bollinger Bands, and Moving Averages to identify low-risk, high-probability trade entries and exits automatically.',
  '["Real-time technical analysis","Smart entry & exit detection","Works on 20+ markets","RSI, Bollinger Bands & Moving Averages"]',
  30.00, null, true
),
(
  'Poverty Scalper EA', '2.0+', 'poverty-scalper-ea',
  'An automated Expert Advisor designed to identify high-probability market opportunities using trend analysis, price action, and smart risk management.',
  '["Trend analysis engine","Price action recognition","Built-in risk management","High-probability setups only"]',
  21.00, null, true
)
on conflict (slug) do nothing;

-- â”€â”€ INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create index if not exists idx_orders_payment_status on orders(payment_status);
create index if not exists idx_orders_key_status on orders(key_status);
create index if not exists idx_orders_customer_email on orders(customer_email);
create index if not exists idx_audit_logs_action on audit_logs(action);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at desc);
create index if not exists idx_conversation_threads_order on conversation_threads(order_id);
create index if not exists idx_conversation_threads_last on conversation_threads(last_message_at desc);
create index if not exists idx_message_logs_thread on message_logs(thread_id);

-- â”€â”€ ROW LEVEL SECURITY (disable for service role) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
alter table admins enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table license_notes enable row level security;
alter table audit_logs enable row level security;
alter table conversation_threads enable row level security;
alter table message_logs enable row level security;

-- Service role bypasses RLS so our backend has full access
-- Public read for products only (frontend fetches products without auth)
create policy "Public can view visible products" on products
  for select using (is_visible = true);
