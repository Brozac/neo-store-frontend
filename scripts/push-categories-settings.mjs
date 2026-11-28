#!/usr/bin/env node
// scripts/push-categories-settings.mjs — phase-2 D1 (2026-11-28)
// ═══════════════════════════════════════════════════════════════════════
// كيقرا من PostgreSQL المحلي: categories · store_settings · category_images_mv
// (ولا fallback حسابي للصور) → كيدفعهم لـ D1 laclarc-catalog.
// الجداول كاينين فالـ D1 (منجريين 2026-11-28) — هنا غير الداتا.
//
// التشغيل من جذر الريبو على الـ PC (نفس بيئة push-local-to-d1.mjs):
//   $env:LOCAL_DATABASE_URL="postgresql://postgres:<PASSWORD>@localhost:5432/laclarc_db"
//   node scripts\push-categories-settings.mjs
//
// إعادة التشغيل آمنة (idempotent): INSERT OR REPLACE — ما كيحيدش والو.
// ═══════════════════════════════════════════════════════════════════════
import postgres from 'postgres';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const D1_NAME = (process.env.D1_NAME || 'laclarc-catalog').trim();
const PG_URL = (process.env.LOCAL_DATABASE_URL || '').trim();

if (!PG_URL) {
  console.error('[push2] FATAL: LOCAL_DATABASE_URL خاوي — عمّرو قبل الجري');
  process.exit(1);
}

// ─── candidates ديال أعمدة seo — نفس candidates ديال dbCategorySeo ───
const SEO_PICKS = {
  seo_title: ['seo_title', 'seo_page_title', 'meta_title'],
  seo_h1: ['seo_h1', 'h1'],
  seo_meta_description: ['seo_meta_description', 'seo_description', 'meta_description', 'seo_desc'],
  seo_content: ['seo_content', 'seo_body', 'seo_text'],
  seo_faqs: ['seo_faqs', 'seo_faq', 'faqs'],
  seo_content_version: ['seo_content_version', 'content_version'],
};

function wrangler(args, opts = {}) {
  console.log(`[push2] npx wrangler ${args.split('\n')[0].slice(0, 100)}...`);
  return execSync(`npx wrangler ${args}`, {
    stdio: opts.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** SQL literal آمن — نفس عقد push-local-to-d1.mjs */
function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  const s = String(v).replace(/\x00/g, '').replace(/'/g, "''");
  return `'${s}'`;
}

const sql = postgres(PG_URL, { max: 1, prepare: false, connect_timeout: 15, onnotice: () => {} });
const t0 = Date.now();

try {
  // ═══ 1) أعمدة categories المتوفرة محلياً (كشف متكيف — نفس فلسفة dbCategorySeo) ═══
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories'`;
  const colSet = new Set(cols.map((r) => String(r.column_name)));
  console.log(`[push2] categories: ${colSet.size} عمود محلي`);

  const pick = (...cands) => cands.find((x) => colSet.has(x)) || null;
  const catCols = {
    id: 'id', level: 'level', name: 'name', slug: 'slug',
    parent_id: 'parent_id', cj_category_id: 'cj_category_id',
    seo_title: pick(...SEO_PICKS.seo_title),
    seo_h1: pick(...SEO_PICKS.seo_h1),
    seo_meta_description: pick(...SEO_PICKS.seo_meta_description),
    seo_content: pick(...SEO_PICKS.seo_content),
    seo_faqs: pick(...SEO_PICKS.seo_faqs),
    seo_content_version: pick(...SEO_PICKS.seo_content_version),
  };
  const cats = await sql`
    SELECT * FROM categories ORDER BY id ASC`;
  console.log(`[push2] categories: ${cats.length} صف من المحلي`);

  // ═══ 2) store_settings ═══
  const settings = await sql`
    SELECT key, value FROM store_settings ORDER BY key ASC`.catch(() => []);
  console.log(`[push2] store_settings: ${settings.length} مفتاح`);

  // ═══ 3) صور الفئات — matview (يفضّل) ولا fallback حسابي ═══
  let catImages = [];
  try {
    catImages = await sql`SELECT slug, image_url FROM category_images_mv`;
    console.log(`[push2] category_images_mv: ${catImages.length} صف`);
  } catch {
    console.log('[push2] category_images_mv ما كاينش — fallback: أول منتج stock لكل slug');
    catImages = await sql`
      WITH s AS (
        SELECT DISTINCT ON (c.slug) c.slug, p.image_url
        FROM categories c
        JOIN products p ON p.category = c.slug OR p.category LIKE c.slug || '/%'
        WHERE p.stock_status = true AND p.image_url IS NOT NULL AND p.image_url <> ''
        ORDER BY c.slug, p.sort_order ASC, p.id DESC
      ) SELECT slug, image_url FROM s`;
    console.log(`[push2] fallback الصور: ${catImages.length} صف`);
  }

  // ═══ 4) توليد SQL + دفع ═══
  const stmts = [];
  for (const c of cats) {
    const g = (k) => (catCols[k] ? c[catCols[k]] : null);
    stmts.push(
      `INSERT OR REPLACE INTO categories (id, level, name, slug, parent_id, cj_category_id, seo_title, seo_h1, seo_meta_description, seo_content, seo_faqs, seo_content_version) VALUES (` +
      `${sqlLit(c.id ? Number(c.id) : null)}, ${sqlLit(g('level') == null ? null : Number(g('level')))}, ` +
      `${sqlLit(g('name'))}, ${sqlLit(g('slug'))}, ${sqlLit(g('parent_id') == null ? null : Number(g('parent_id')))}, ` +
      `${sqlLit(g('cj_category_id'))}, ${sqlLit(g('seo_title'))}, ${sqlLit(g('seo_h1'))}, ` +
      `${sqlLit(g('seo_meta_description'))}, ${sqlLit(g('seo_content'))}, ${sqlLit(g('seo_faqs'))}, ` +
      `${sqlLit(g('seo_content_version'))});`,
    );
  }
  for (const s of settings) {
    stmts.push(`INSERT OR REPLACE INTO store_settings (key, value) VALUES (${sqlLit(s.key)}, ${sqlLit(s.value)});`);
  }
  for (const im of catImages) {
    if (!im.slug) continue;
    stmts.push(`INSERT OR REPLACE INTO category_images (slug, image_url) VALUES (${sqlLit(im.slug)}, ${sqlLit(im.image_url)});`);
  }

  const tmpDir = path.join(process.cwd(), '.d1-push');
  fs.mkdirSync(tmpDir, { recursive: true });
  const file = path.join(tmpDir, 'categories_settings.sql');
  fs.writeFileSync(file, stmts.join('\n'), 'utf-8');
  console.log(`[push2] ${stmts.length} statement → ${file}`);

  wrangler(`d1 execute ${D1_NAME} --remote -y --file="${file}"`);

  // ═══ 5) تحقق ═══
  const check = wrangler(
    `d1 execute ${D1_NAME} --remote --json -y --command "SELECT (SELECT COUNT(*) FROM categories) AS categories, (SELECT COUNT(*) FROM store_settings) AS settings, (SELECT COUNT(*) FROM category_images) AS images"`,
    { capture: true },
  );
  const j = JSON.parse(check);
  console.log('[push2] تحقق D1:', JSON.stringify(j[0]?.results ?? j?.results ?? j, null, 0).slice(0, 200));
  console.log(`[push2] DONE فـ ${((Date.now() - t0) / 1000).toFixed(0)}s — من بعد: purge /api/categories إلا كانت متكاشية`);
} finally {
  await sql.end({ timeout: 5 });
}
