#!/usr/bin/env node
// scripts/push-local-to-d1.mjs — 100% D1 — الدفعة الأولى (PostgreSQL المحلي → D1)
// ═══════════════════════════════════════════════════════════════════
// 54,367 منتج (تقريباً) كيمشيو بـ keyset pagination (1000/دفعة قراءة) →
// ملفات SQL تاع 500 صف (~2-3MB) → npx wrangler d1 execute laclarc-catalog
// --remote --file=... (متسلسلة). كل statement = INSERT ... ON CONFLICT(id)
// DO UPDATE → إعادة الجري آمنة 100% (idempotent — كيفضي منين بغيت).
//
// المتغيرات: LOCAL_DATABASE_URL (إجباري) · D1_NAME (default laclarc-catalog)
//
// المدة المتوقعة: ~15-30 دقيقة للدفعة الأولى (one-time) — الشاشة كتوضل
// التقدم مع النسبة. إلا طاح شي chunk: الملف كيبقى ف.d1-push/ — عاود جري
// نفس الأمر (كيعاود من البداية لكن upsert ما كيكسرش والو).
// ═══════════════════════════════════════════════════════════════════
import postgres from 'postgres';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const D1_NAME = (process.env.D1_NAME || 'laclarc-catalog').trim();
const PG_URL = (process.env.LOCAL_DATABASE_URL || '').trim();
const CHUNK_ROWS = 500;      // صفحة/ملف
const READ_BATCH = 1000;     // keyset read batch

if (!PG_URL) {
  console.error('[push] FATAL: LOCAL_DATABASE_URL خاوي — عمّرو من الـ ps1 ولا يدوياً');
  process.exit(1);
}

// ─── shaping — نفس عقد watcher (lib/variants-slim.ts + d1_schema.sql) ───
const VARIANT_KEEP_KEYS = ['vid', 'variantKey', 'variantImage', 'variantNameEn', 'variantSellPrice'];
const JSON_COLS = ['images', 'variants', 'colors', 'sizes', 'patterns', 'colour_names', 'size_names'];
const TEXT_COLS = ['title', 'description', 'image_url', 'pattern', 'origin', 'composition', 'category', 'video_url', 'material', 'seo_title', 'seo_meta_description', 'cj_product_id'];
const NUM_COLS = ['price', 'original_price'];
const INT_COLS = ['sort_order', 'sales_count'];
const BOOL_COLS = ['stock_status', 'is_sourced'];
const ALL_COLS = ['id', ...TEXT_COLS, ...NUM_COLS, ...INT_COLS, ...BOOL_COLS, ...JSON_COLS.filter((c) => c !== 'variants'), 'variants', 'created_at', 'updated_at'];

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

function pgArrayToJson(v) {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v) || typeof v === 'object') return v;
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
  return v;
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

/** SQL literal آمن — escape ' → '' + strip NUL (D1/SQLite ماتقبلش NUL فالنص) */
function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  const s = String(v).replace(/\x00/g, '').replace(/'/g, "''");
  return `'${s}'`;
}

function rowToSql(row) {
  const vals = ALL_COLS.map((c) => sqlLit(row[c])).join(', ');
  const update = ALL_COLS.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(', ');
  return `INSERT INTO products (${ALL_COLS.join(', ')}) VALUES (${vals}) ON CONFLICT(id) DO UPDATE SET ${update};`;
}

function wrangler(args, opts = {}) {
  // Windows: npx كيتطلب shell — المسارات بلا فراغات (repo root ثابت)
  return execSync(`npx wrangler ${args}`, {
    encoding: 'utf8',
    stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    timeout: 10 * 60_000,
  });
}

async function main() {
  const sql = postgres(PG_URL, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
  const t0 = Date.now();

  // ─── فحص الاتصال + العدّاد ───
  const counted = await sql`SELECT COUNT(*)::int AS n FROM products`;
  const localCount = Number(counted[0]?.n ?? 0);
  console.log(`[push] PostgreSQL المحلي: ${localCount} منتج`);
  if (localCount === 0) {
    console.error('[push] FATAL: الجدول products خاوي محلياً — شي حاجة غالطة فالـ DB');
    process.exit(1);
  }

  // ─── تأكد السكيما موجودة فD1 (تحذير فقط — الـ ps1 كيجري d1_schema.sql قبل) ───
  let tmpDir = path.join(process.cwd(), '.d1-push');
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  let lastId = 0;
  let done = 0;
  let chunkIdx = 0;
  let failFile = null;

  console.log('[push] بداية الرفع — كل chunk = 500 صف → wrangler d1 execute --remote');

  outer: while (true) {
    const rows = await sql`SELECT * FROM products WHERE id > ${lastId} ORDER BY id LIMIT ${READ_BATCH}`;
    if (!rows.length) break;
    for (let i = 0; i < rows.length; i += CHUNK_ROWS) {
      const slice = rows.slice(i, i + CHUNK_ROWS);
      const stmts = [];
      for (const r of slice) {
        const row = toD1Row(r);
        if (!Number.isInteger(row.id) || row.id <= 0) continue;
        stmts.push(rowToSql(row));
      }
      if (!stmts.length) continue;
      chunkIdx++;
      const file = path.join(tmpDir, `chunk_${String(chunkIdx).padStart(5, '0')}.sql`);
      writeFileSync(file, stmts.join('\n') + '\n', 'utf8');
      try {
        wrangler(`d1 execute ${D1_NAME} --remote -y --file="${file}"`);
        rmSync(file, { force: true });
      } catch (e) {
        failFile = file;
        console.error(`[push] FATAL: chunk ${chunkIdx} فشل — الملف محفوظ: ${file}`);
        console.error(`[push] ${e && e.message ? e.message.slice(0, 500) : e}`);
        break outer;
      }
      done += stmts.length;
      lastId = Number(rows[rows.length - 1].id);
      const pct = ((done / localCount) * 100).toFixed(1);
      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(`[push] ${done}/${localCount} (${pct}%) chunk=${chunkIdx} elapsed=${elapsed}s lastId=${lastId}`);
    }
  }

  if (failFile) {
    console.error('[push] توقف بفشل — صحح السبب وعاود جري (upsert آمن).');
    process.exit(1);
  }

  // ─── التحقق النهائي — العدّاد فD1 مقابل المحلي ───
  console.log('[push] التحقق: SELECT COUNT(*) FROM products (remote D1) …');
  let d1Count = -1;
  try {
    const out = wrangler(`d1 execute ${D1_NAME} --remote --json -y --command "SELECT COUNT(*) AS n FROM products"`, { capture: true });
    const j = JSON.parse(out);
    const arr = Array.isArray(j) ? j : [j];
    for (const part of arr) {
      const res = part?.results ?? [];
      if (res.length && res[0]?.n !== undefined) { d1Count = Number(res[0].n); break; }
    }
    if (d1Count < 0) {
      const m = out.match(/"n"\s*:\s*(\d+)/);
      if (m) d1Count = Number(m[1]);
    }
  } catch (e) {
    console.warn(`[push] تحذير: ما قدرناش نقراو العدّاد من D1 (${e && e.message ? e.message.slice(0, 200) : e}) — تحقق يدوياً.`);
  }

  console.log('──────────────────────────────────────────────');
  console.log(`[push] المحلي = ${localCount} · D1 = ${d1Count >= 0 ? d1Count : '?'}`);
  if (d1Count === localCount) {
    console.log(`[push] ✅ MATCH — الدفعة كملت ف${Math.round((Date.now() - t0) / 1000)}s`);
  } else if (d1Count >= 0) {
    console.log(`[push] ⚠️ MISMATCH (${localCount - d1Count} فرق) — عاود جري نفس الأمر (upsert آمن) ولا تحقق يدوياً.`);
  } else {
    console.log(`[push] تحقق يدوياً: npx wrangler d1 execute ${D1_NAME} --remote --command "SELECT COUNT(*) FROM products"`);
  }
  console.log('──────────────────────────────────────────────');

  try { await sql.end({ timeout: 5 }); } catch { /* noop */ }
}

main().catch((e) => {
  console.error('[push] FATAL:', e && e.message ? e.message : e);
  process.exit(1);
});
