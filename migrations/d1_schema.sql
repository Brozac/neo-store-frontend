-- ═════════════════════════════════════════════════════════════════
-- migrations/d1_schema.sql — 100% D1 — laclarc-catalog (SQLite dialect)
-- ═══════════════════════════════════════════════════════════════════
-- التطبيق (من جذر الريبو على جهاز الـ PC):
--   npx wrangler d1 execute laclarc-catalog --remote -y --file migrations/d1_schema.sql
-- السكريبت scripts/laclarc-d1-windows.ps1 كيجري هادا الملف أوتوماتيكياً.
--
-- الأعمدة = نفس أعمدة products تاع PostgreSQL (مرآة lib/db-reads.ts) —
-- الفرق الوحيد: JSON arrays/objects كيتخزنو TEXT (JSON string) فD1،
-- والبوليانات INTEGER (1/0). الداتا كيتعمرها:
--   · scripts/push-local-to-d1.mjs  → الدفعة الأولى (54,367 منتج)
--   · scripts/realtime-d1-watcher.mjs → LISTEN d1_sync_channel → الحية
--
-- ⚠️ variants كتخزن بالمفاتيح النحيفة فقط (vid · variantKey · variantImage ·
--    variantNameEn · variantSellPrice — نفس عقد lib/variants-slim.ts) —
--    inventories مكانش هنا أبداً (القراءة الحية من CJ API مباشرة).

CREATE TABLE IF NOT EXISTS products (
  id                    INTEGER PRIMARY KEY,
  title                 TEXT,
  description           TEXT,
  price                 REAL,
  original_price        REAL,
  image_url             TEXT,
  images                TEXT,   -- JSON array string
  variants              TEXT,   -- JSON array string — المفاتيح النحيفة فقط
  colors                TEXT,   -- JSON array string
  sizes                 TEXT,   -- JSON array string
  patterns              TEXT,   -- JSON array string (اختياري)
  colour_names          TEXT,   -- JSON array string (اختياري)
  size_names            TEXT,   -- JSON array string (اختياري)
  pattern               TEXT,
  origin                TEXT,
  composition           TEXT,
  category              TEXT,
  video_url             TEXT,
  material              TEXT,
  stock_status          INTEGER DEFAULT 1,
  sort_order            INTEGER DEFAULT 0,
  sales_count           INTEGER DEFAULT 0,
  cj_product_id         TEXT,
  is_sourced            INTEGER DEFAULT 0,
  seo_title             TEXT,
  seo_meta_description  TEXT,
  created_at            TEXT,
  updated_at            TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_stock     ON products(stock_status);
CREATE INDEX IF NOT EXISTS idx_products_sort      ON products(sort_order, id DESC);
CREATE INDEX IF NOT EXISTS idx_products_sales     ON products(sales_count DESC);
CREATE INDEX IF NOT EXISTS idx_products_sourced   ON products(is_sourced);
CREATE INDEX IF NOT EXISTS idx_products_updated   ON products(updated_at);

-- ─── orders — هيكل phase-3 (الشيكاوت على D1 جاية) ───
-- خاوية حالياً: الطلبات الحية (107) كيتنسخو احتياطياً من PostgreSQL المحلي
-- بـ pg_dump (الـ ps1) — والـ ps1 كيصدر أي طلبات D1 مستقبلاً JSON.
CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY,
  order_number      TEXT,
  status            TEXT,
  payment_method    TEXT,
  currency          TEXT,
  total             REAL,
  customer_email    TEXT,
  customer_name     TEXT,
  shipping_address  TEXT,
  items             TEXT,   -- JSON array string
  created_at        TEXT,
  updated_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at);

-- ─── system_events — نفس عقد الجدول تاع PostgreSQL (FEEDS_DONE/FEEDS_ERROR ...) ───
CREATE TABLE IF NOT EXISTS system_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type  TEXT NOT NULL,
  details     TEXT,     -- JSON string
  severity    TEXT DEFAULT 'info',
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type, created_at);

-- ─── d1_meta — نسخة السكيما وأعلام الحالة ───
CREATE TABLE IF NOT EXISTS d1_meta (
  k   TEXT PRIMARY KEY,
  v   TEXT
);
INSERT OR REPLACE INTO d1_meta (k, v) VALUES ('schema_version', '1');
