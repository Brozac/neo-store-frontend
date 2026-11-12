#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// warm-products.mjs — F#63 MC-FIX: تسخين كاش صفحات المنتجات
// ═══════════════════════════════════════════════════════════════════
// علاش: Googlebot فوق صفحة باردة (أول توليد ISR) كيحصل أحياناً على
// hang 30-45s ولا 503 → Merchant Center كيسجل «Product page unavailable»
// → 32.1K منتج مرفوض. الصفحة السخونة كتخدم 0.4-2s بلا مشاكل.
//
// واش كيدير: يجيب الروابط من /products-sitemap/{0,1,2}.xml ويطلبهم واحد
// بواحد (بمعدل محدود) — كل طلب كيولّد الصفحة ويكاشفها (KV/الحافة) —
// من بعد Googlebot ديما كيلقى الصفحة سخونة وجاهزة.
//
// الاستعمال:
//   node scripts/warm-products.mjs                       # كامل (~53.8K — سوايع)
//   node scripts/warm-products.mjs --limit 50            # تجربة سريعة
//   node scripts/warm-products.mjs --concurrency 6       # موازية أعلى
//   node scripts/warm-products.mjs --start 97513 --end 80000
//
// الميزانية (Workers Free):
//   · 100K request/يوم — التشغيل الكامل = ~54K طلب ← يخدم فالليل UTC
//   · كل طلب صفحة = 2-3 sub-requests داخليين (حد 50/طلب) ✅
//   · KV Free = 1K كتابة/يوم — التسخين ما كيعتمدش على KV: الصفحات
//     كتولّد حي وتكاشف فالحافة/CDN — KV غير ميزة زيادة ما كتضرش
//
// stdlib فقط — بلا أي dependencies (نفس فلسفة keepalive).
// ═══════════════════════════════════════════════════════════════════
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const BASE = (process.env.WARM_BASE_URL || 'https://laclarc.com').replace(/\/+$/, '');
const UA = 'LaclarcCacheWarmer/1.0 (+https://laclarc.com; ISR pre-warm, owner-initiated)';
const SITEMAPS = ['/products-sitemap/0.xml', '/products-sitemap/1.xml', '/products-sitemap/2.xml'];
const REQ_TIMEOUT_MS = 25000;
const RETRIES = 2; // محاولة أولى + 2 إعادة = 3 محاولات قصوى

// ─── CLI args ───
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const CONC = Math.max(1, Math.min(Number(arg('concurrency', 4)) || 4, 12));
const LIMIT = Number(arg('limit', 0)) || Infinity;
const START = Number(arg('start', 0)) || 0; // ≥ هاد الـ id
const END = Number(arg('end', 0)) || Infinity; // ≤ هاد الـ id
const URL_TIMEOUT_MS = Number(arg('sitemap-timeout', 60000));

function log(msg) {
  console.log(`[warm ${new Date().toISOString()}] ${msg}`);
}

// ─── 1) جمع الروابط من الـ sitemaps ───
async function collectUrls() {
  const urls = [];
  for (const sm of SITEMAPS) {
    const res = await fetch(`${BASE}${sm}`, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(URL_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`sitemap ${sm} HTTP ${res.status}`);
    const xml = await res.text();
    const found = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    log(`${sm} → ${found.length} رابط`);
    urls.push(...found);
  }
  return urls.filter((u) => {
    const id = Number(u.split('/').pop());
    return id >= START && id <= END;
  });
}

// ─── 2) تسخين بموازية محدودة ───
async function warmOne(url, attempt = 1) {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    if (res.status === 404) return { ok: false, status: 404 }; // منتج ميت — عادي ما يتسخنش
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    return { ok: false, status: res.status }; // 403/401... — ما تنجمش تتصلح بإعادة
  } catch (e) {
    if (attempt <= RETRIES) {
      await sleep(600 * attempt);
      return warmOne(url, attempt + 1);
    }
    return { ok: false, status: 0, err: String(e && e.message ? e.message : e) };
  }
}

async function main() {
  const t0 = Date.now();
  log(`BASE=${BASE} concurrency=${CONC} limit=${LIMIT === Infinity ? 'all' : LIMIT}`);
  const all = await collectUrls();
  const queue = all.slice(0, LIMIT === Infinity ? all.length : LIMIT);
  log(`المجموع للتسخين: ${queue.length} رابط (متوقع ~${Math.round(queue.length / 2 / 60)} دقيقة على ~2/s)`);

  const stats = { ok: 0, notFound: 0, err: 0, total: queue.length };
  const errors = [];
  let done = 0;

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) break;
      const r = await warmOne(url);
      done++;
      if (r.ok) stats.ok++;
      else if (r.status === 404) stats.notFound++;
      else {
        stats.err++;
        if (errors.length < 50) errors.push(`${url} → ${r.status || ''} ${r.err || ''}`);
      }
      if (done % 500 === 0) {
        const mins = ((Date.now() - t0) / 60000).toFixed(1);
        const rate = (done / ((Date.now() - t0) / 1000)).toFixed(2);
        log(`${done}/${stats.total} ok=${stats.ok} 404=${stats.notFound} err=${stats.err} | ${rate}/s | ${mins}min`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONC }, () => worker()));

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const summary = {
    finishedAt: new Date().toISOString(),
    durationMinutes: Number(mins),
    base: BASE,
    concurrency: CONC,
    ...stats,
    errorRatePct: stats.total ? Number(((stats.err / stats.total) * 100).toFixed(2)) : 0,
    sampleErrors: errors,
  };
  writeFileSync('scripts/warm-last-run.json', JSON.stringify(summary, null, 2));
  log(`اكتمل: ${JSON.stringify({ ok: stats.ok, notFound: stats.notFound, err: stats.err, total: stats.total, minutes: mins })}`);
  if (stats.err / Math.max(stats.total, 1) > 0.2) {
    log('⚠️ نسبة الأخطاء فوق 20% — شوف sampleErrors فـ scripts/warm-last-run.json');
  }
}

main().catch((e) => {
  console.error('[warm] FATAL:', e);
  process.exit(1);
});
