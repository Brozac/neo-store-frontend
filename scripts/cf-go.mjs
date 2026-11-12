#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════
// Laclarc — scripts/cf-go.mjs (F#67 — cfkit v2: Workers Cache + KV ISR)
// ═══════════════════════════════════════════════════════════════════
// أمر واحد كيدير كلشي بأمان — بلا غلطة يدوية ممكنة:
//   node scripts/cf-go.mjs               → الپايپلاين كامل (تحويل + بيلد + ديبيلوي + تحقق)
//   node scripts/cf-go.mjs --no-deploy   → كلشي بلا ديبيلوي (تجربة)
//   node scripts/cf-go.mjs --no-build    → ديبيلوي على آخر بيلد (ماشي موصى به)
//   node scripts/cf-go.mjs verify        → غير التحقق الحي بعد الديبلوي
//
// كيدير:
//   1) npm install                          5) تحويل open-next.config.ts (r2→kv) + باك أب
//   2) فحص wrangler login                   6) npm run cf:build
//   3) إنشاء/إيجاد KV NEXT_INC_CACHE_KV     7) ديبيلوي opennextjs-cloudflare deploy
//   4) تحويل wrangler.jsonc + باك أب        8) تحقق حي: MISS→HIT + كاش KV
//
// ما كيآسرش على: database_id (D1) · services · assets · vars · الأسرار
// ═══════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const WIN = process.platform === 'win32';
const SH = WIN ? { shell: true } : {};
const SITE = 'https://laclarc.com';
const NEW_COMPAT_DATE = '2026-11-12';
const KV_BINDING = 'NEXT_INC_CACHE_KV';

const args = process.argv.slice(2);
const NO_DEPLOY = args.includes('--no-deploy');
const NO_BUILD = args.includes('--no-build');
const VERIFY_ONLY = args.includes('verify');

let step = 0;
const ok = (m) => console.log(`  [OK] ${m}`);
const warn = (m) => console.log(`  [!!] ${m}`);
const die = (m, hint) => {
  console.error(`\n  [X] ${m}`);
  if (hint) console.error(`      -> ${hint}`);
  process.exit(1);
};
const banner = (m) => console.log(`\n=== [${++step}] ${m} ===`);

function run(cmd, cmdArgs, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: 'pipe', encoding: 'utf8', ...SH, ...opts });
  return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') };
}

// ─── JSONC scanner محصّن: كيحترم strings (حتى // داخل URLs) وcomments ───
export function stripJsoncComments(text) {
  let out = '', inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
    out += c;
  }
  return out;
}
export function parseJsonc(text) {
  return JSON.parse(stripJsoncComments(text).replace(/,(\s*[}\]])/g, '$1'));
}

// بلوك JSONC من "key" حتى القوس الموفل + الفاصلة المتبوعة (باش ما يتيمش شي فاصلة)
export function findBlock(raw, key) {
  const m = raw.match(new RegExp(`"${key}"\\s*:`));
  if (!m) return null;
  const keyIdx = m.index;
  const after = raw.slice(keyIdx);
  const bIdx = after.search(/[{[]/);
  if (bIdx < 0) return null;
  const start = keyIdx + bIdx;
  const open = raw[start], close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) return null;
  let e = end;
  while (e < raw.length && /\s/.test(raw[e])) e++;
  if (raw[e] === ',') e++;
  return { start: keyIdx, end: e, text: raw.slice(keyIdx, e) };
}

// ─── العمليات الجراحية: بلوك كامل = مفتاح + تعليق السطر اللي فوقاه + فاصلة ───
function removeBlock(raw, key) {
  const b = findBlock(raw, key);
  if (!b) return raw;
  let s = b.start;
  const prevNl = raw.lastIndexOf('\n', s - 1);
  const lineAbove = raw.slice(prevNl + 1, s);
  if (/^\s*\/\/.*$/.test(lineAbove)) s = prevNl; // التعليق المخصص للبلوك يمشي معاه
  return raw.slice(0, s) + raw.slice(b.end);
}
function insertAfterBlock(raw, key, text) {
  const b = findBlock(raw, key);
  if (!b) return null;
  return raw.slice(0, b.end) + '\n' + text + '\n' + raw.slice(b.end);
}

const KV_BLOCK_TEXT = (id) => [
  '// ─── ⭐ كاش ISR + Data cache (nor2/KV — مجاني بلا كارت) ───',
  '"kv_namespaces": [',
  '  {',
  `    "binding": "${KV_BINDING}",`,
  `    "id": "${id}",`,
  '  },',
  '],',
].join('\n');

const CACHE_BLOCK_TEXT = [
  '// ─── ⭐ Workers Cache: CF كيفحص الكاش قبل ما يجري الـ Worker ───',
  '// صفحات ISR (s-maxage=86400) كتخدم من الحافة — HIT = صفر تنفيذ Worker',
  '"cache": {',
  '  "enabled": true,',
  '},',
].join('\n');

// ═════════ التحويل: wrangler.jsonc ═════════
export function transformWrangler(raw, kvId) {
  let out = raw;

  // 1) compatibility_date → الجديد (غير القيمة — الفاصلة الأصلية كتبقى كما هي)
  const dm = out.match(/"compatibility_date"\s*:\s*"[^"]*"/);
  if (!dm) return { err: 'compatibility_date ما لقاهش' };
  out = out.replace(dm[0], `"compatibility_date": "${NEW_COMPAT_DATE}"`);

  // 2) r2_buckets كيتحيد كامل (بلاكس bucket ما كاين بلا كارت)
  out = removeBlock(out, 'r2_buckets');

  // 3) kv_namespaces: موجود → id فقط. ناقص → زيدو بعد assets ولا بعد compat date
  const kvB = findBlock(out, 'kv_namespaces');
  if (kvB && kvB.text.includes(`"${KV_BINDING}"`)) {
    const replaced = kvB.text.replace(
      new RegExp(`("binding"\\s*:\\s*"${KV_BINDING}"[\\s\\S]{0,300}?"id"\\s*:\\s*")[^"]*(")`),
      `$1${kvId}$2`
    );
    out = out.replace(kvB.text, replaced);
  } else if (kvB) {
    // كاين بلوك kv ولكن بلا الbinding ديالنا — نزيدو داخل الarray
    const entry = `  { "binding": "${KV_BINDING}", "id": "${kvId}" },`;
    const inner = kvB.text.indexOf('[');
    out = out.replace(kvB.text, kvB.text.slice(0, inner + 1) + '\n' + entry + kvB.text.slice(inner + 1));
  } else {
    const inserted = insertAfterBlock(out, 'assets', KV_BLOCK_TEXT(kvId));
    if (inserted === null) {
      const cm = out.match(/"compatibility_date"\s*:\s*"[^"]*",/);
      if (!cm) return { err: 'ما لقيتش بلاصة لإدخال kv_namespaces' };
      out = out.slice(0, cm.index + cm[0].length) + '\n' + KV_BLOCK_TEXT(kvId) + out.slice(cm.index + cm[0].length);
    } else out = inserted;
  }

  // 4) cache.enabled — موجود → true. ناقص → زيدو بعد compat date
  const cacheB = findBlock(out, 'cache');
  if (cacheB) {
    if (!/"enabled"\s*:\s*true/.test(cacheB.text)) {
      const fixed = cacheB.text.replace(/"enabled"\s*:\s*(false|[^,}]*)/, '"enabled": true');
      out = out.replace(cacheB.text, fixed);
    }
  } else {
    const cm = out.match(/"compatibility_date"\s*:\s*"[^"]*",/);
    if (!cm) return { err: 'ما لقيتش بلاصة لإدخال cache' };
    out = out.slice(0, cm.index + cm[0].length) + '\n' + CACHE_BLOCK_TEXT + out.slice(cm.index + cm[0].length);
  }

  return { out };
}

export function validateWrangler(beforeRaw, afterRaw, kvId) {
  const before = parseJsonc(beforeRaw);
  const after = parseJsonc(afterRaw);
  return [
    ['cache.enabled === true', after.cache?.enabled === true],
    ['kv NEXT_INC_CACHE_KV بالid الصحيح', after.kv_namespaces?.some((b) => b.binding === KV_BINDING && b.id === kvId)],
    ['r2_buckets تحيّد', !after.r2_buckets],
    ['compatibility_date محدث', after.compatibility_date === NEW_COMPAT_DATE],
    ['worker name ما تبدلش', after.name === before.name],
    ['main ما تبدلش', after.main === before.main],
    ['D1 database_id ما تبدلش', before.d1_databases?.[0]?.database_id === after.d1_databases?.[0]?.database_id],
    ['compatibility_flags كاملين', JSON.stringify(before.compatibility_flags || []) === JSON.stringify(after.compatibility_flags || [])],
    ['vars ما تبدلوش', JSON.stringify(before.vars || {}) === JSON.stringify(after.vars || {})],
    ['services ما تبدلوش', JSON.stringify(before.services || []) === JSON.stringify(after.services || [])],
    ['assets ما تبدلش', JSON.stringify(before.assets || {}) === JSON.stringify(after.assets || {})],
    ['DO bindings كاملين', JSON.stringify(before.durable_objects || {}) === JSON.stringify(after.durable_objects || {})],
  ];
}

export function transformOpenNext(raw) {
  let out = raw.replace(
    /import\s+\w+\s+from\s+["'][^"']*r2-incremental-cache["'];?/,
    'import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";'
  );
  out = out.replace(/incrementalCache\s*:\s*\w+/, 'incrementalCache: kvIncrementalCache');
  if (!/kv-incremental-cache/.test(out) || !/incrementalCache:\s*kvIncrementalCache/.test(out)) {
    return { err: 'open-next.config.ts ما تبدلش كما هو متوقع' };
  }
  return { out };
}

// ═════════ KV namespace: إيجاد ولا إنشاء ═════════
function parseKvList(out) {
  const j = out.indexOf('[');
  if (j >= 0) {
    try {
      const arr = JSON.parse(out.slice(j).match(/\[[\s\S]*\]/)[0]);
      const hit = arr.find((n) => (n.title || '').includes(KV_BINDING) || n.id === KV_BINDING);
      if (hit?.id) return hit.id;
    } catch { /* Tier 2 تحت */ }
  }
  // جدول: "<id32hex>  <title>"
  const row = out.match(new RegExp(`([0-9a-f]{32})\\s+[^\\n]*${KV_BINDING}`));
  if (row) return row[1];
  return null;
}

function ensureKvNamespace() {
  banner('KV namespace NEXT_INC_CACHE_KV');
  const list = run('npx', ['wrangler', 'kv', 'namespace', 'list'], { timeout: 180000 });
  let id = list.code === 0 || /NEXT_INC_CACHE_KV/.test(list.out) ? parseKvList(list.out) : null;
  if (id) { ok(`KV موجود من قبل — id: ${id}`); return id; }
  console.log('  • ما كاينش — كننشئو (مجاني، بلا كارت)...');
  const created = run('npx', ['wrangler', 'kv', 'namespace', 'create', KV_BINDING], { timeout: 180000 });
  if (created.code !== 0) {
    die('إنشاء KV فشل',
      'جرّب بيدك: npx wrangler kv namespace create ' + KV_BINDING + '   — إلا طلع login: npx wrangler login');
  }
  const list2 = run('npx', ['wrangler', 'kv', 'namespace', 'list'], { timeout: 180000 });
  id = parseKvList(list2.out) || parseKvList(created.out);
  if (!id) die('KV id ما استخرجناهش من خرج wrangler',
    'خد الid بيدك من: npx wrangler kv namespace list  وزيدو فـ wrangler.jsonc فـ kv_namespaces');
  ok(`KV تنشأ — id: ${id}`);
  return id;
}

// ═════════ التحقق الحي ═════════
async function verifyLive() {
  banner('التحقق الحي على laclarc.com');
  const h = (u) => fetch(u, { redirect: 'manual' }).catch(() => null);
  const pick = async (r) => {
    if (!r) return { status: 0, cfc: 'NETWORK-FAIL', next: '-', age: '-' };
    await r.text().catch(() => '');
    return {
      status: r.status,
      cfc: r.headers.get('cf-cache-status') || '-',
      next: r.headers.get('x-nextjs-cache') || '-',
      age: r.headers.get('age') || '-',
    };
  };

  let productUrl = `${SITE}/products/78299`;
  const sm = await h(`${SITE}/products-sitemap/0.xml`);
  if (sm?.ok) {
    const txt = await sm.text().catch(() => '');
    const loc = txt.match(/<loc>(https:\/\/laclarc\.com\/products\/\d+)<\/loc>/);
    if (loc) productUrl = loc[1];
  }
  console.log(`  • صفحة التجربة: ${productUrl}`);

  const r1 = await pick(await h(productUrl));
  console.log(`  [1] cf-cache-status=${r1.cfc}  x-nextjs-cache=${r1.next}  (${r1.status})`);
  const r2 = await pick(await h(productUrl));
  console.log(`  [2] cf-cache-status=${r2.cfc}  age=${r2.age}  (${r2.status})`);
  const r3 = await pick(await h(`${productUrl}?cfgocheck=${Date.now()}`));
  console.log(`  [3] query جديد → الكاش الداخلي KV: cf-cache-status=${r3.cfc}  x-nextjs-cache=${r3.next}  (${r3.status})`);
  console.log('');
  if (/HIT/.test(r2.cfc)) ok('كاش الحافة (Workers Cache) خدام — التكرارات بلا تنفيذ Worker');
  else warn('الحافة ما بانتش HIT — عاود: node scripts/cf-go.mjs verify بعد 5 دقايق');
  if (/HIT|STALE/.test(r3.next) || /HIT|STALE/.test(r1.next)) ok('كاش KV الداخلي (ISR) خدام — renders معاودة بلا DB');
  else warn('KV ما بانش HIT — شوف: Workers & Pages → laclarc → Logs (ولا KV reads فالمراقبة)');
  console.log('');
  console.log('  [i] المراقبة: Supabase → Egress بعد 48h  ·  Workers Metrics (requests كينقصو)');
  return { edge: /HIT/.test(r2.cfc), kv: /HIT|STALE/.test(r3.next) || /HIT|STALE/.test(r1.next) };
}

// ═════════ البيلد الداخلي (نفس منطق cf-build.mjs لكن محصّن — ما كيعتمد على شي ملف خارجي) ═════════
const CF_INSTRUMENTATION = `// ──── ⚙️ ملف مُولَّد مؤقتاً من scripts/cf-go.mjs — الأصل كيرجع بعد البيلد ────
// CF_SLIM build: Sentry محذوف من باندل Cloudflare (حد الـ Worker المجاني 3MB gzip)

export async function register() {
  // بلا SDK — أخطاء السيرفر كيتسجلو في wrangler tail / CF dashboard
}

type RevalidateRequest = { url?: string } | null | undefined;

export const onRequestError = async (
  err: unknown,
  request: RevalidateRequest,
  context: unknown
) => {
  console.error('[onRequestError]', err, request?.url ?? '', context);
};
// ──── [/CF_SLIM] ────
`;

function resolveOpenNextCli() {
  for (let dir = ROOT; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', '@opennextjs', 'cloudflare', 'package.json');
    if (existsSync(candidate)) {
      const data = JSON.parse(readFileSync(candidate, 'utf8'));
      const binPath = typeof data.bin === 'string' ? data.bin : data.bin?.['opennextjs-cloudflare'];
      if (binPath) return path.join(path.dirname(candidate), binPath);
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
  }
  die('opennextjs-cloudflare ما تلقاش فـ node_modules', 'جرّب: npm install');
}

function buildStep() {
  if (!existsSync('.dev.vars')) writeFileSync('.dev.vars', 'NEXTJS_ENV=development\n');
  const INSTR = path.join(ROOT, 'instrumentation.ts');
  const original = readFileSync(INSTR, 'utf8');
  writeFileSync(INSTR, CF_INSTRUMENTATION);
  let code = 1, out = '';
  try {
    process.env.CF_SLIM = '1';
    const cli = resolveOpenNextCli();
    const r = spawnSync(process.execPath, [cli, 'build'], { stdio: 'pipe', encoding: 'utf8', env: process.env, timeout: 1200000 });
    out = (r.stdout || '') + (r.stderr || '');
    code = r.status ?? 1;
  } catch (e) {
    out = String(e?.stack || e);
  } finally {
    writeFileSync(INSTR, original); // الرجوع الإجباري — حتى إلا البيلد طاح
  }
  return { code, out };
}

// ═════════ الپايپلاين ═════════
async function main() {
  console.log('\nLACLARC CF-GO — Workers Cache + KV ISR (F#67)\n');

  if (VERIFY_ONLY) return verifyLive();

  banner('npm install (تبعيات)');
  const inst = run('npm', ['install', '--no-audit', '--no-fund'], { timeout: 900000 });
  if (inst.code !== 0) { console.error(inst.out.split('\n').slice(-15).join('\n')); die('npm install فشل', 'قرا الخطأ فوق'); }
  ok('التبعيات جاهزة');

  banner('wrangler login');
  const who = run('npx', ['wrangler', 'whoami'], { timeout: 180000 });
  if (who.code !== 0 || !/@/.test(who.out)) {
    die('ما كاينش login فـ wrangler',
      'نفّذ: npx wrangler login   (كيحل المتصفح) — من بعد عاود: node scripts/cf-go.mjs');
  }
  const accLine = who.out.split('\n').find((l) => /@/.test(l));
  ok(`حساب: ${accLine ? accLine.trim().slice(0, 70) : 'متصل'}`);

  const kvId = ensureKvNamespace();

  banner('التحويل الجراحي (باك أب .bak-cfgo قبل أي لمسة)');
  const wFile = path.join(ROOT, 'wrangler.jsonc');
  if (!existsSync(wFile)) die('wrangler.jsonc ما لقاهش فجذر الريبو', 'شد الريبو ديال الفرونت (laclarc) وجرّب من هناك');
  const wRaw = readFileSync(wFile, 'utf8');
  const wRes = transformWrangler(wRaw, kvId);
  if (wRes.err) die('تحويل wrangler.jsonc فشل: ' + wRes.err, 'قولّي — نصلحو مع بعض');
  const checks = validateWrangler(wRaw, wRes.out, kvId);
  const failed = checks.filter(([, p]) => !p);
  if (failed.length) die('المصادقة فشلت: ' + failed.map(([m]) => m).join(' · '));
  copyFileSync(wFile, wFile + '.bak-cfgo');
  writeFileSync(wFile, wRes.out);
  const d1Id = parseJsonc(wRes.out).d1_databases?.[0]?.database_id;
  ok(`wrangler.jsonc تحوّل (D1 id محفوظ كما هو: ${d1Id ? String(d1Id).slice(0, 8) + '...' : '-'})`);

  const oFile = path.join(ROOT, 'open-next.config.ts');
  if (!existsSync(oFile)) die('open-next.config.ts ما لقاهش', 'تأكد أنك فجذر الريبو');
  const oRaw = readFileSync(oFile, 'utf8');
  const oRes = transformOpenNext(oRaw);
  if (oRes.err) die('تحويل open-next.config.ts فشل: ' + oRes.err, 'قولّي — نصلحو مع بعض');
  copyFileSync(oFile, oFile + '.bak-cfgo');
  writeFileSync(oFile, oRes.out);
  ok('open-next.config.ts: kv override جاهز');

  if (!NO_BUILD) {
    banner('البيلد (دقايق — الريم ديال الماشينة ديالك كافي · بلا خرج حتى يكمل)');
    const build = buildStep();
    if (build.code !== 0) {
      console.error(build.out.split('\n').slice(-25).join('\n'));
      die('البيلد فشل — الملفات المبدلة باقين والباك أب موجودة',
        'رجوع فوري: copy wrangler.jsonc.bak-cfgo wrangler.jsonc && copy open-next.config.ts.bak-cfgo open-next.config.ts');
    }
    if (!existsSync(path.join(ROOT, '.open-next', 'worker.js'))) {
      die('البيلد كمل ولكن .open-next/worker.js ما كاينش', 'عاود: node scripts/cf-go.mjs --no-deploy وشوف الخطأ');
    }
    ok('البيلد كمل — .open-next واجد');
  } else warn('--no-build: ديبيلوي على آخر بيلد');

  if (NO_DEPLOY) {
    warn('--no-deploy: كولشي واجد، الديبلوي ما دارش — جرّب عاد بلا العلم');
    return;
  }

  banner('الديبلوي');
  const dep = run('npx', ['opennextjs-cloudflare', 'deploy'], { timeout: 900000 });
  if (dep.code !== 0) {
    console.error(dep.out.split('\n').slice(-25).join('\n'));
    die('الديبلوي فشل — الموقع القديم باقي حي (ديبلوي فاشل ما كيبدل والو)',
      'قرا الخطأ · إلا على KV: npx wrangler kv namespace list وتأكد من id فـ wrangler.jsonc');
  }
  ok('الديبلوي طاح — laclarc.com على النسخة الجديدة');

  banner('انتظار 20s باش يتفشل');
  await new Promise((r) => setTimeout(r, 20000));
  const res = await verifyLive();

  console.log('\n=== الخلاصة ===');
  console.log(res.edge
    ? '  الزحفة الباردة وقفت: Googlebot + الزوار كيتقاسمو كاش الحافة 24h — HIT ما كيضربش Worker ولا DB'
    : '  عاود verify بعد شي دقايق (التفرش كياخد وقت)');
  console.log('  رجوع فوري للنسخة السابقة:  npx wrangler rollback');
  console.log('  رجوع الملفات:  copy wrangler.jsonc.bak-cfgo wrangler.jsonc  ·  copy open-next.config.ts.bak-cfgo open-next.config.ts');
  console.log('  حفظ فالجيت:  git add wrangler.jsonc open-next.config.ts && git commit -m "cfkit v2: workers cache + kv isr (cf-go)"');
  console.log('  ملاحظة: بعد كل deploy جديد الكاش الحافة كيبدا نقي (طبيعي) — وأول زحفة كتعاود تبنيه\n');
}

// كيتنفذ غير عند الاستدعاء المباشر (باش الاختبارات تستورد الوحدات بلا ما يجري main)
if (!process.env.CFGO_NO_MAIN) {
  main().catch((e) => die('خطأ غير متوقع: ' + (e?.stack || e)));
}
