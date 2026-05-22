-- ============================================================
-- BAKONE TRADES — SUPABASE DATABASE MIGRATION
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── ADMINS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  features JSONB DEFAULT '[]',
  price NUMERIC(10, 2) NOT NULL,
  image_url TEXT,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ORDERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_whatsapp TEXT,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  payfast_payment_id TEXT,
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'whatsapp', 'both')),
  license_key TEXT,
  license_delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AUDIT LOGS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  performed_by TEXT DEFAULT 'system',
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGE LOGS
CREATE TABLE IF NOT EXISTS conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES orders(order_id),
  customer_email TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES conversation_threads(id),
  order_id TEXT REFERENCES orders(order_id),
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound','outbound')),
  recipient TEXT NOT NULL,
  sender TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','prepared','sent','delivered','read','received','failed')),
  provider_message_id TEXT,
  provider_response JSONB,
  error_message TEXT,
  provider_status TEXT,
  provider_timestamp TIMESTAMPTZ,
  sent_by UUID REFERENCES admins(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES conversation_threads(id);
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS sender TEXT;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS provider_status TEXT;
ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS provider_timestamp TIMESTAMPTZ;

-- ─── AUTO UPDATE updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── SEED PRODUCTS ──────────────────────────────────────────
INSERT INTO products (name, version, slug, description, features, price, is_visible)
VALUES
(
  'FX Killer PV4.0 Pro',
  '4.0 Pro',
  'fx-killer-pv4-pro',
  'Analyzes real-time market data using price action, spread, volatility, RSI, Bollinger Bands, and Moving Averages to identify low-risk, high-probability trade entries and exits automatically.',
  '["Real-time technical analysis", "Smart entry & exit detection", "Works on 20+ markets", "RSI, Bollinger Bands & Moving Averages"]',
  30.00,
  TRUE
),
(
  'Poverty Scalper EA',
  '2.0+',
  'poverty-scalper-ea',
  'An automated Expert Advisor designed to identify high-probability market opportunities using trend analysis, price action, and smart risk management. Also known as Poverty Killer EA.',
  '["Trend analysis engine", "Price action recognition", "Built-in risk management", "High-probability setups only"]',
  21.00,
  TRUE
)
ON CONFLICT (slug) DO NOTHING;

-- ─── INDEXES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_order ON message_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created ON message_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_order ON conversation_threads(order_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_last ON conversation_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_thread ON message_logs(thread_id);

-- ─── ROW LEVEL SECURITY (disable for service role) ──────────
ALTER TABLE admins DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs DISABLE ROW LEVEL SECURITY;
