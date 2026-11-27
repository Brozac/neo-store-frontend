#!/usr/bin/env node
// scripts/realtime-d1-watcher.mjs — 100% D1 — watcher الحية على الـ PC (تحت PM2)
// ═══════════════════════════════════════════════════════════════════════
// PostgreSQL المحلي (laclarc_db) هو مصدر الحقيقة — كل كتابة (pgAdmin ·
// massSync.js) كتطلق trigger → pg_notify('d1_sync_channel', {op,id}) →
// هادا الـ watcher كيجيب الصف من المحلي وكيرسلو لـ:
//   POST https://laclarc.com/api/admin/d1-realtime-sync  (upsert/delete فD1 + purge)
//
// المتغيرات المطلوبة (الـ ps1 كيعمرهم قبل التشغيل):
//   LOCAL_DATABASE_URL  postgresql://postgres:***@localhost:5432/laclarc_db
//   ADMIN_PASSWORD      نفس سرّ ADMIN_PASSWORD فCloudflare (timing-safe server-side)
//   LACLARC_SYNC_URL    اختياري (default https://laclarc.com/api/admin/d1-realtime-sync)
//
// عقد الاتزان: أي فشل قاتل (auth · اتصال PG · 3 فشالات متتالية) = exit(1)
// → PM2 كيعاود يقلّع براسو. ما كاينش فين يهرب الدور: إما كيخدم أو كيتقلّع.
//
// ⚠️ نفس عقد lib/variants-slim.ts: variants كتخزن بالمفاتيح النحيفة فقط
//    (vid · variantKey · variantImage · variantNameEn · variantSellPrice)
//    — inventories عمرها ما كتسافر للـ edge.
// ═══════════════════════════════════════════════════════════════════════
import postgres from 'postgres';

const SYNC_URL = (process.env.LACLARC_SYNC_URL || 'https://laclarc.com/api/admin/d1-realtime-sync').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const PG_URL = (process.env.LOCAL_DATABASE_URL || '').trim();

if (!PG_URL) { console.error('[watcher] FATAL: LOCAL_DATABASE_URL خاوي'); process.exit(1); }
if (!ADMIN_PASSWORD) { console.error('[watcher] FATAL: ADMIN_PASSWORD خاوي'); process.exit(1); }

// ─── shaping — نفس عقد lib/variants-slim.ts + migrations/d1_schema.sql ───
const VARIANT_KEEP_KEYS = ['vid', 'variantKey', 'variantImage', 'variantNameEn', 'variantSellPrice'];
const JSON_COLS = ['images', 'variants', 'colors', 'sizes', 'patterns', 'colour_names', 'size_names'];
const TEXT_COLS = ['title', 'description', 'image_url', 'pattern', 'origin', 'composition', 'category', 'video_url', 'material', 'seo_title', 'seo_meta_description', 'cj_product_id'];
const NUM_COLS = ['price', 'original_price'];
const INT_COLS = ['sort_order', 'sales_count'];
const BOOL_COLS = ['stock_status', 'is_sourced'];

function slimVariants(raw, max = 100) {
  let arr = raw;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr || '[]'); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr.slice(0, max)) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const slim = {};
    let kept = 0;
    for (const key of VARIANT_KEEP_KEYS) {
      if (item[key] !== undefined) { slim[key] = item[key]; kept++; }
    }
    if (kept === 0) continue;
    if (slim.vid === undefined && slim.variantKey === undefined) continue;
    out.push(slim);
  }
  return out;
}

/** pg text[] literal '{a,b}' → array · object/array → كما هو · بلاصة خاوية → null */
function pgArrayToJson(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v) || typeof v === 'object') return v; // text[] (postgres.js) ولا jsonb
  if (typeof v === 'string' && v.startsWith('{') && v.endsWith('}')) {
    try {
      const inner = v.slice(1, -1);
      if (!inner) return [];
      const out = []; let cur = ''; let inQ = false;
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (inQ) {
          if (ch === '"' && inner[i - 1] !== '\\') inQ = false;
          else cur += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === ',') { out.push(cur === 'NULL' ? null : cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur === 'NULL' ? null : cur);
      return out;
    } catch { return null; }
  }
  return v; // string عادية — النداء يحولها
}

function toD1Row(r) {
  const out = { id: Number(r.id) };
  for (const c of TEXT_COLS) out[c] = r[c] == null ? null : String(r[c]);
  for (const c of NUM_COLS) {
    const n = Number(r[c]);
    out[c] = Number.isFinite(n) ? n : null;
  }
  for (const c of INT_COLS) {
    const n = Number(r[c]);
    out[c] = Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  for (const c of BOOL_COLS) {
    out[c] = (r[c] === true || r[c] === 1 || r[c] === '1' || r[c] === 'true') ? 1 : 0;
  }
  for (const c of JSON_COLS) {
    if (c === 'variants') { out[c] = JSON.stringify(slimVariants(r[c])); continue; }
    const v = pgArrayToJson(r[c]);
    out[c] = v === null || v === undefined ? '[]' : (typeof v === 'string' ? v : JSON.stringify(v));
  }
  for (const c of ['created_at', 'updated_at']) {
    const v = r[c];
    out[c] = v == null ? null : (v instanceof Date ? v.toISOString() : String(v));
  }
  return out;
}

// ─── الاتصال بالـ PG المحلي ───
const sql = postgres(PG_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15,
  idle_timeout: 0, // LISTEN كيبقى حي — ما نسدوش بالخمول
  onnotice: () => {},
});

// ─── الطابور — معالجة متسلسلة باش يتبنى الترتيب ───
const queue = [];
let draining = false;
let consecutiveFailures = 0;

async function post(body) {
  const res = await fetch(SYNC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-password': ADMIN_PASSWORD,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401 || res.status === 403) throw new Error('AUTH_REJECTED_' + res.status);
  if (res.status === 503) throw new Error('D1_NOT_BOUND_503');
  if (!res.ok) throw new Error('HTTP_' + res.status);
  return res.json().catch(() => ({}));
}

async function handleOne(item) {
  if (item.op === 'DELETE') {
    await post({ op: 'DELETE', id: item.id });
    console.log(`[watcher] DELETE ${item.id} ok`);
    return;
  }
  const rows = await sql`SELECT * FROM products WHERE id = ${item.id}`;
  if (!rows.length) {
    // الصف تفقى من المحلي قبل ما نقراوه → حيدو من D1 باش يبقى متطابق
    await post({ op: 'DELETE', id: item.id });
    console.log(`[watcher] ${item.op} ${item.id} → الصف غبر محلياً → DELETE صافي`);
    return;
  }
  const row = toD1Row(rows[0]);
  await post({ op: 'UPSERT', id: item.id, row });
  console.log(`[watcher] UPSERT ${item.id} ok bytes≈${JSON.stringify(row).length}`);
}

async function drain() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const item = queue.shift();
      try {
        await handleOne(item);
        consecutiveFailures = 0;
      } catch (e) {
        consecutiveFailures++;
        const msg = e && e.message ? e.message : String(e);
        console.error(`[watcher] فشل ${item.op} ${item.id} (${msg}) consecutive=${consecutiveFailures}`);
        if (msg.startsWith('AUTH_REJECTED')) {
          console.error('[watcher] FATAL: السرّ مرفوض — قارن ADMIN_PASSWORD فالـ ps1 مع wrangler secret');
          process.exit(1);
        }
        if (consecutiveFailures >= 3) {
          console.error('[watcher] FATAL: 3 فشالات متتالية — exit(1) باش PM2 يعاود يقلّع نظيف');
          process.exit(1);
        }
        await new Promise((r) => setTimeout(r, 1500)); // backoff قصير قبل إعادة المحاولة
        queue.unshift(item);
      }
    }
  } finally {
    draining = false;
  }
}

function onNotify(payload) {
  try {
    const p = JSON.parse(payload);
    const op = String(p.op || '').toUpperCase();
    const id = Number(p.id);
    if (!['INSERT', 'UPDATE', 'DELETE'].includes(op) || !Number.isInteger(id) || id <= 0) {
      console.warn('[watcher] payload غالط:', String(payload).slice(0, 120));
      return;
    }
    queue.push({ op: op === 'DELETE' ? 'DELETE' : 'UPSERT', id });
    if (queue.length > 50) {
      console.warn(`[watcher] backlog=${queue.length} — bulk sync? إلا كتبغي تختصر: جري push-local-to-d1.mjs (كيفضي الطابور ونفس النتيجة)`);
    }
    void drain();
  } catch (e) {
    console.error('[watcher] notify parse failed:', e && e.message ? e.message : e);
  }
}

async function main() {
  // فحص مبكر — أي فشل اتصال هنا = exit(1) (PM2 يعاود)
  await sql`SELECT 1`;
  console.log('[watcher] PG محلي ok — laclarc_db');
  console.log(`[watcher] sync → ${SYNC_URL}`);
  console.log(`[watcher] ADMIN_PASSWORD معمار: ${ADMIN_PASSWORD ? 'yes' : 'NO'}`);
  // LISTEN — postgres.js كيفتح connection مخصص للسماعة
  await sql.listen('d1_sync_channel', onNotify, () => {
    console.log('[watcher] LISTEN d1_sync_channel حي');
  });
  console.log('[watcher] started — كيسمع دابا d1_sync_channel …');

  // 🔒 watchdog — كل 60s نبضة على الـ PG: إلا طاح الاتصال = exit(1) → PM2 restart
  setInterval(async () => {
    try {
      await sql`SELECT 1`;
      if (!queue.length) console.log('[watcher] alive — queue=0');
    } catch (e) {
      console.error('[watcher] FATAL: PG heartbeat فشل —', e && e.message ? e.message : e);
      process.exit(1);
    }
  }, 60_000).unref();
}

process.on('unhandledRejection', (e) => {
  console.error('[watcher] FATAL unhandledRejection:', e && e.message ? e.message : e);
  process.exit(1);
});

main().catch((e) => {
  console.error('[watcher] FATAL startup:', e && e.message ? e.message : e);
  process.exit(1);
});
