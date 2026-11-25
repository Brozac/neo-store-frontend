// lib/cf-cj.ts — CJ-live bridge core (server-only)
// ══════════════════════════════════════════════════════════════════════
// Port من الباك القديم (nsb) — نفس العقود حرفياً:
//   · auth/request core  ← services/cjService.js (getCJToken + cjRequest)
//   · geo normalize      ← lib/geoCountry.js (سجل CJ الـ 250 دولة)
//   · normalizers        ← utils/cjNormalize.js (parseMaxNumber/Weight/JsonArray/ImageList)
//   · pricing v3.1       ← services/productImportService.js (calculateSellingPrice + sanitizeDescription)
//   · caches/limiter     ← routes/cjLiveBridge.js (search 5min · freight 10min · warehouses 24h · reviews 6h · limiter)
//
// ملاحظات الأمان:
//   · لا أسرار في الكود — كل شيء من process.env (CJ_API_KEY / CJ_OPEN_ID).
//   · الكاشات في الذاكرة per-isolate — مقبولة على Workers (نفس نمط pb-limiter).
//   · axios → global fetch مع إعادة بناء سلوك axios (response.data · error.response.data).
//
// 🆕 2026-11 audit مقابل الوثائق الرسمية (developers.cjdropshipping.com):
//   · نظام النقط — فعال على حساباتنا من 01 يوليو 2026 (points.html):
//       listV2=50pt · query/variant/freightCalculate(Tip)=10pt · auth/trackInfo/
//       productComments/globalWarehouseList/makeup/mergeOrder/cogs/disputes=0pt
//       الميزانية = 50k نقطة/يوم أساس + $1 معاملات CJ = 100 نقطة (MAX 3 أشهر آخرين)
//       التعويض كل دقيقة = Total/1440 · النفاد = HTTP 429 + pointsInfo → CjPointsError (فشل سريع)
//   · التوكن 180 يوم (ماشي 12h) — KV TTL 179 يوم (شوف cj-token-kv.ts).
//   · تعليق API: 30 يوم متتالية بلا معاملات CJ = code 1600014 → إعادة تفعيل يدوية
//       من https://www.cjdropshipping.com/my.html#/authorize/APIStores — noteCjSuspension كينبه فاللوجات.
//   · freightCalculateTip: تحقق صارم srcAreaCode/destAreaCode/productProp/weight
//       (ناقص واحد = 1600300 كيسمّي السطر) — الـ payload ديالنا فـ cj-live كامل ومتوافق.
//   · deprecated: /product/list و /logistic/getTrackInfo — كنستعملو listV2/trackInfo ✓
// ══════════════════════════════════════════════════════════════════════
import 'server-only';
import { readCjTokenKv, isCjTokenUsable, writeCjTokenKv, CJ_TOKEN_MARGIN_MS } from './cj-token-kv';

const CJ_API = 'https://developers.cjdropshipping.com/api2.0/v1';

// ── مساعدات صغيرة مشتركة ──────────────────────────────────────────────

export type Rec = Record<string, unknown>;

export function asRec(v: unknown): Rec {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {};
}
export function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
export function asStr(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function timeoutSignal(ms: number): { signal: AbortSignal; done: () => void } {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(t) };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ══════════════════════════════════════════════════════════════════════
// 1) AUTH — نفس getCJToken من cjService.js (thread-safe · mutex · refresh)
// ══════════════════════════════════════════════════════════════════════

export interface CjEnvelope {
  code?: number;
  message?: string;
  data?: unknown;
  result?: boolean;
  success?: boolean;
  [k: string]: unknown;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedRefreshToken: string | null = null;
let tokenRefreshPromise: Promise<string> | null = null; // mutex ضد تسابق التوكن

/**
 * POST auth endpoint → envelope (axios-like: HTTP >= 400 = throw).
 * timeout 15000 — نفس الباك.
 */
async function postAuth(path: string, body: Record<string, unknown>): Promise<CjEnvelope | null> {
  const { signal, done } = timeoutSignal(15000);
  try {
    const res = await fetch(CJ_API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (res.status >= 400) throw new Error(`CJ auth HTTP ${res.status}`);
    const text = await res.text();
    try { return JSON.parse(text) as CjEnvelope; } catch { return null; }
  } finally {
    done();
  }
}

/** استخراج التوكن + تخزينه (نفس منطق الباك — expiry − 15 دقيقة هامش [phase-abc كان 10]، وإلا 12h) */
function tokenFromEnvelope(env: CjEnvelope | null): string | null {
  const data = asRec(env?.data);
  const token = typeof data.accessToken === 'string' && data.accessToken ? data.accessToken : null;
  if (!env || env.code !== 200 || !token) return null;
  cachedToken = token;
  const refresh = data.refreshToken;
  cachedRefreshToken = typeof refresh === 'string' && refresh ? refresh : null;
  const expiryDateStr = typeof data.accessTokenExpiryDate === 'string' ? data.accessTokenExpiryDate : null;
  tokenExpiry = expiryDateStr
    ? new Date(expiryDateStr).getTime() - CJ_TOKEN_MARGIN_MS
    : Date.now() + 12 * 60 * 60 * 1000 - CJ_TOKEN_MARGIN_MS;
  return token;
}

/**
 * توكن CJ — نسخة مطابقة من getCJToken (nsb/services/cjService.js):
 *   · المفتاح يُرسل كما هو ({ apiKey }) — الكود القديم ما كيقسمش CJ_API_KEY
 *     (صيغة "email:apiKey" ما كتعالجش)، و CJ_OPEN_ID ما كيدخلش في تدفق التوكن.
 *   · refreshAccessToken أولاً إن توفر refreshToken، وإلا getAccessToken.
 */
export async function getCjAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;
  if (tokenRefreshPromise) return tokenRefreshPromise;

  const job = (async () => {
    const apiKey = process.env.CJ_API_KEY;
    if (!apiKey) throw new Error('CJ_API_KEY is missing in environment variables');

    // 🆕 phase-abc — KV أولاً (قبل أي نداء auth): التوكن مشترك بين isolates —
    //    الوافد الجديد كيخدم بالتوكن المخزن بلا auth إضافي (خطر daily limit مقفول)
    if (!forceRefresh) {
      const kvEntry = await readCjTokenKv();
      if (isCjTokenUsable(kvEntry)) {
        cachedToken = kvEntry!.token;
        cachedRefreshToken = kvEntry!.refreshToken ?? null;
        tokenExpiry = kvEntry!.expiryMs - CJ_TOKEN_MARGIN_MS;
        return kvEntry!.token;
      }
    }

    if (cachedRefreshToken && !forceRefresh) {
      try {
        const refreshed = tokenFromEnvelope(
          await postAuth('/authentication/refreshAccessToken', { refreshToken: cachedRefreshToken }),
        );
        if (refreshed) {
          // 🆕 كتابة KV — fire-safe (فشل KV = السلوك الذاكري كما هو)
          await writeCjTokenKv(refreshed, cachedRefreshToken, tokenExpiry + CJ_TOKEN_MARGIN_MS).catch(() => {});
          return refreshed;
        }
      } catch {
        cachedRefreshToken = null; // نفس الباك — refresh فاشل → getAccessToken
      }
    }

    const env = await postAuth('/authentication/getAccessToken', { apiKey });
    const token = tokenFromEnvelope(env);
    if (token) {
      // 🆕 كتابة KV — نفس الالتزام (12h حي → انتهاء مطلق = expiry + هامش)
      await writeCjTokenKv(token, cachedRefreshToken, tokenExpiry + CJ_TOKEN_MARGIN_MS).catch(() => {});
      return token;
    }
    throw new Error(`CJ Authentication failed: ${String(env?.message || '') || 'Unknown error'}`);
  })();

  tokenRefreshPromise = job;
  job.then(() => {}, () => {}).finally(() => {
    if (tokenRefreshPromise === job) tokenRefreshPromise = null;
  });
  return job;
}

// ══════════════════════════════════════════════════════════════════════
// 2) cjFetch — بديل cjRequest+axios: توكن · retries · envelope
// ══════════════════════════════════════════════════════════════════════

export class CjEnvelopeError extends Error {
  cjCode: number | null;
  constructor(code: number | null, message: string) {
    super(`CJ envelope ${code}: ${message}`);
    this.cjCode = code;
  }
}

/**
 * 🆕 2026-11 — نقاط CJ سالمت (نظام يوليو 2026 — points.html).
 * الفشل سريع بلا retries: التعويض كل دقيقة (Total/1440)، والـ backoff ديال 9 ثواني
 * ما كينفعش — الزائر كيرجع للتقدير المحلي دغيا (DeliveryEstimator) والكرون كيسجل cjFailures.
 * الوثيقة: 429 مع pointsInfo = نقاط سالمت — التعويض كل دقيقة، retries ديال ثواني بلا فايدة.
 */
export class CjPointsError extends CjEnvelopeError {}

const CJ_SUSPENSION_CODE = 1600014; // API معلق — 30 يوم متتالية بلا معاملات CJ
let lastPointsLog = 0;              // throttle تحذيرات النقط
let lastSuspensionLog = 0;          // throttle تحذيرات التعليق

/** نقاط CJ من pointsInfo (كيجي فكل جواب من يوليو 2026) — تحذير بقى <25% (مرة/10د) ولا نفاد (مرة/60ث) */
function noteCjPoints(env: CjEnvelope | null, exhausted: boolean): void {
  const pts = asRec(env?.pointsInfo);
  if (Object.keys(pts).length === 0) return;
  const now = Date.now();
  const remaining = Number(pts.remaining);
  const total = Number(pts.total);
  if (exhausted) {
    if (now - lastPointsLog > 60_000) {
      lastPointsLog = now;
      console.warn(
        '[cj-points] نقاط اليوم سالمت — HTTP 429 — التعويض كل دقيقة (Total/1440):',
        JSON.stringify({ usedToday: pts.usedToday, remaining: pts.remaining, total: pts.total }),
      );
    }
    return;
  }
  if (
    Number.isFinite(remaining) && Number.isFinite(total) && total > 0 &&
    remaining < total * 0.25 && now - lastPointsLog > 10 * 60_000
  ) {
    lastPointsLog = now;
    console.warn(
      '[cj-points] remaining < 25% من نقاط اليوم — راقب listV2/query/freight:',
      JSON.stringify({ usedToday: pts.usedToday, remaining: pts.remaining, total: pts.total }),
    );
  }
}

/** تعليق API (1600014) — كنصوتو بقوة فاللوجات باش المالك يشوفو دغيا ويعاود التفعيل من لوحة CJ */
function noteCjSuspension(env: CjEnvelope | null): void {
  if (env?.code !== CJ_SUSPENSION_CODE) return;
  const now = Date.now();
  if (now - lastSuspensionLog > 10 * 60_000) {
    lastSuspensionLog = now;
    console.error(
      '[cj-suspension] code 1600014 — API access suspended (30 يوم متتالية بلا معاملات CJ).',
      'إعادة التفعيل اليدوية: https://www.cjdropshipping.com/my.html#/authorize/APIStores — ثم عاود الطلب.',
    );
  }
}

/** axios-like: HTTP >= 400 = throw (error.response.status / error.response.data) */
class CjHttpError extends Error {
  status: number;
  envelope: CjEnvelope | null;
  constructor(status: number, envelope: CjEnvelope | null, snippet: string) {
    super(`CJ HTTP ${status}: ${snippet}`);
    this.status = status;
    this.envelope = envelope;
  }
}

export interface CjCallResult {
  status: number;
  text: string;
  data: CjEnvelope | null;
}

export interface CjFetchInit {
  method?: 'GET' | 'POST';
  query?: Record<string, string | number | undefined>;
  body?: unknown;          // JSON body (POST)
  timeoutMs?: number;      // default 45000 — نفس cjRequest config
  rawText?: boolean;       // caller ي parse البيانات بنفسه (productComments — حماية long-ID)
}

const CJ_DEFAULT_TIMEOUT = 45000;
const QPS_BODY_CODE = 1600200;   // QPS limit كـ HTTP 200 + body.code
const QPS_MAX_RETRIES = 3;       // نفس الباك
const AUTH_CODES = [401, 1600001];

/**
 * نداء CJ موحّد — نفس retry logic ديال cjRequest:
 *   · body.code=1600200 / HTTP 429 → retry حتى 3 مرات بـ backoff 1500/3000/4500ms
 *   · HTTP 401 / code 401 / 1600001 → force-refresh التوكن + retry مرة وحدة
 *   · بعد استنفاد المحاولات: body-QPS كيرجع الـ response الأصلي (نفس الباك)، الباقي throw
 */
export async function cjFetch(path: string, init: CjFetchInit = {}): Promise<CjCallResult> {
  let authRetried = false;
  let qpsCount = 0;

  for (;;) {
    const token = await getCjAccessToken();

    const url = new URL(CJ_API + path);
    if (init.query) {
      for (const [k, v] of Object.entries(init.query)) {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      }
    }

    const { signal, done } = timeoutSignal(init.timeoutMs ?? CJ_DEFAULT_TIMEOUT);
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? 'GET',
        headers:
          init.body !== undefined
            ? { 'CJ-Access-Token': token, 'Content-Type': 'application/json' }
            : { 'CJ-Access-Token': token },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal,
      });
    } finally {
      done();
    }

    const text = await res.text();
    let data: CjEnvelope | null = null;
    if (!init.rawText) {
      try { data = JSON.parse(text) as CjEnvelope; } catch { data = null; }
    }

    // 🆕 نقاط CJ (يوليو 2026) — pointsInfo كيجي فكل جواب؛ 429 معاه = نقاط اليوم سالمت
    const pointsInfo = data ? asRec(data.pointsInfo) : {};
    const pointsExhausted =
      Object.keys(pointsInfo).length > 0 && (res.status === 429 || data?.code === 429);

    if (res.status >= 400) {
      const err = new CjHttpError(res.status, data, text.slice(0, 500));
      const cjCode = typeof err.envelope?.code === 'number' ? err.envelope.code : null;
      // 🆕 نقاط سالمت — فشل سريع بلا retries (التعويض كل دقيقة، ماشي كل ثواني)
      if (pointsExhausted) {
        noteCjPoints(data, true);
        throw new CjPointsError(429, String(data?.message || 'Insufficient API points'));
      }
      if ((err.status === 429 || cjCode === QPS_BODY_CODE) && qpsCount < QPS_MAX_RETRIES) {
        qpsCount += 1;
        await sleep(qpsCount * 1500);
        continue;
      }
      const isAuth = err.status === 401 || (cjCode !== null && AUTH_CODES.includes(cjCode));
      if (isAuth && !authRetried) {
        authRetried = true;
        await getCjAccessToken(true); // نفس الباك: "CJ token expired during request. Refreshing now..."
        continue;
      }
      noteCjSuspension(data); // 🆕 1600014 — تعليق API (30 يوم بلا معاملات)
      throw err;
    }

    const result: CjCallResult = { status: res.status, text, data };

    // 🆕 مراقبة النقط فالنجاح (تحذير بقى <25%) + تعليق API داخل 200 (احتياط للوثيقة)
    noteCjPoints(data, false);
    noteCjSuspension(data);
    if (pointsExhausted) {
      noteCjPoints(data, true);
      throw new CjPointsError(429, String(data?.message || 'Insufficient API points'));
    }

    // QPS داخل الجسم (HTTP 200) — نفس الباك: retry، وبعد الاستنفاد نرجّع الـ response الأصلي
    if (data?.code === QPS_BODY_CODE) {
      if (qpsCount < QPS_MAX_RETRIES) {
        qpsCount += 1;
        await sleep(qpsCount * 1500);
        continue;
      }
      return result;
    }
    return result;
  }
}

// ══════════════════════════════════════════════════════════════════════
// 3) كاشات الذاكرة — حماية نقاط CJ (search 5m · freight 10m · warehouses 24h · reviews 6h)
// ══════════════════════════════════════════════════════════════════════

export const SEARCH_TTL = 5 * 60 * 1000;
export const FREIGHT_TTL = 10 * 60 * 1000;
const WAREHOUSE_TTL = 24 * 60 * 60 * 1000;
const REVIEWS_TTL = 6 * 60 * 60 * 1000;

export interface CacheEntry {
  data: unknown;
  ts: number;
}

export const searchCache = new Map<string, CacheEntry>();  // "q|page|country"
export const freightCache = new Map<string, CacheEntry>(); // "pid|vid|src|dest"
const reviewsCache = new Map<string, CacheEntry>();        // "pid|page|size|score"

export function cacheGet<T>(map: Map<string, CacheEntry>, key: string, ttl: number): T | null {
  const hit = map.get(key);
  if (hit && Date.now() - hit.ts < ttl) return hit.data as T;
  if (hit) map.delete(key);
  return null;
}

export function cacheSet(map: Map<string, CacheEntry>, key: string, data: unknown): void {
  map.set(key, { data, ts: Date.now() });
  if (map.size > 2000) {
    // GC خفيف — قصّ القديم (نفس الباك: cut = max(SEARCH_TTL, FREIGHT_TTL))
    const cut = Date.now() - Math.max(SEARCH_TTL, FREIGHT_TTL);
    for (const [k, v] of map) if (v.ts < cut) map.delete(k);
  }
}

// ── Rate limiter — كتطبق غير على MISS (الكاش حر) — نفس BRIDGE_LIMITS ──
// المفتاح: cf-connecting-ip (بتحقق من الصيغة) → x-forwarded-for → unknown
export const BRIDGE_LIMITS = {
  search: { max: 20, windowMs: 10 * 60 * 1000 },  // listV2 50pt
  product: { max: 60, windowMs: 10 * 60 * 1000 }, // query + freight (كاش 10د)
  reviews: { max: 40, windowMs: 10 * 60 * 1000 }, // productComments (كاش 6h)
} as const;

export type BridgeKind = keyof typeof BRIDGE_LIMITS;

const buckets = new Map<string, number[]>(); // "kind|ip" → [timestamps]

export function bridgeIp(request: Request): string {
  const cf = String(request.headers.get('cf-connecting-ip') || '');
  const validCf = /^\d{1,3}(\.\d{1,3}){3}$/.test(cf) || cf.includes(':');
  if (validCf) return cf;
  const xff = request.headers.get('x-forwarded-for');
  if (xff && xff.trim()) return xff.split(',')[0].trim();
  return 'unknown';
}

export function allowHit(kind: BridgeKind, ip: string): boolean {
  const { max, windowMs } = BRIDGE_LIMITS[kind];
  const key = `${kind}|${ip}`;
  const now = Date.now();
  const b = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (b.length >= max) {
    buckets.set(key, b);
    return false;
  }
  b.push(now);
  buckets.set(key, b);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t > windowMs)) buckets.delete(k);
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════
// 4) GEO — نسخة من lib/geoCountry.js (override → CDN headers → ipwho.is → default)
// ══════════════════════════════════════════════════════════════════════

// سجل الـ 250 دولة (CJ Appendix B — data/cjCountries.json كنص مضغوط "iso2:name")
const CJ_COUNTRIES_COMPACT = `AD:Andorra|AE:United Arab Emirates(the)|AF:Afghanistan|AG:Antigua and Barbuda|AI:Anguilla|AL:Albania|AM:Armenia|AO:Angola|AQ:Antarctica|AR:Argentina|AS:American Samoa|AT:Austria|AU:Australia|AW:Aruba|AX:Åland Islands|AZ:Azerbaijan|BA:Bosnia and Herzegovina|BB:Barbados|BD:Bangladesh|BE:Belgium|BF:Burkina Faso|BG:Bulgaria|BH:Bahrain|BI:Burundi|BJ:Benin|BL:Saint Barthélemy|BM:Bermuda|BN:Brunei Darussalam|BO:Bolivia (Plurinational State of)|BQ:Bonaire, Sint Eustatius and Saba|BR:Brazil|BS:Bahamas(the)|BT:Bhutan|BV:Bouvet Island|BW:Botswana|BY:Belarus|BZ:Belize|CA:Canada|CC:Cocos (Keeling) Islands(the)|CD:Congo (the Democratic Republic of the)|CF:Central African Republic (the)|CG:Congo (the)|CH:Switzerland|CI:Côte d'Ivoire|CK:Cook Islands (the)|CL:Chile|CM:Cameroon|CN:China|CO:Colombia|CR:Costa Rica|CU:Cuba|CV:Cabo Verde|CW:Curaçao|CX:Christmas Island|CY:Cyprus|CZ:Czechia|DE:Germany|DJ:Djibouti|DK:Denmark|DM:Dominica|DO:Dominican Republic (the)|DZ:Algeria|EC:Ecuador|EE:Estonia|EG:Egypt|EH:Western Sahara*|ER:Eritrea|ES:Spain|ET:Ethiopia|FI:Finland|FJ:Fiji|FK:Falkland Islands (the) [Malvinas]|FM:Micronesia (Federated States of)|FO:Faroe Islands (the)|FR:France|GA:Gabon|GB:United Kingdom of Great Britain and Northern Irela|GD:Grenada|GE:Georgia|GF:French Guiana|GG:Guernsey|GH:Ghana|GI:Gibraltar|GL:Greenland|GM:Gambia (the)|GN:Guinea|GP:Guadeloupe|GQ:Equatorial Guinea|GR:Greece|GS:South Georgia and the South Sandwich Islands|GT:Guatemala|GU:Guam|GW:Guinea-Bissau|GY:Guyana|HK:Hong Kong|HM:Heard Island and McDonald Islands|HN:Honduras|HR:Croatia|HT:Haiti|HU:Hungary|ID:Indonesia|IE:Ireland|IL:Israel|IM:Isle of Man|IN:India|IO:British Indian Ocean Territory (the)|IQ:Iraq|IR:Iran (Islamic Republic of)|IS:Iceland|IT:Italy|JE:Jersey|JM:Jamaica|JO:Jordan|JP:Japan|KE:Kenya|KG:Kyrgyzstan|KH:Cambodia|KI:Kiribati|KM:Comoros (the)|KN:Saint Kitts and Nevis|KP:Korea (the Democratic People's Republic of)|KR:Korea (the Republic of)|KW:Kuwait|KY:Cayman Islands (the)|KZ:Kazakhstan|LA:Lao People's Democratic Republic (the)|LB:Lebanon|LC:Saint Lucia|LI:Liechtenstein|LK:Sri Lanka|LR:Liberia|LS:Lesotho|LT:Lithuania|LU:Luxembourg|LV:Latvia|LY:Libya|MA:Morocco|MC:Monaco|MD:Moldova (the Republic of)|ME:Montenegro|MF:Saint Martin (French part)|MG:Madagascar|MH:Marshall Islands (the)|MK:Macedonia (the former Yugoslav Republic of)|ML:Mali|MM:Myanmar|MN:Mongolia|MO:Macao|MP:Northern Mariana Islands (the)|MQ:Martinique|MR:Mauritania|MS:Montserrat|MT:Malta|MU:Mauritius|MV:Maldives|MW:Malawi|MX:Mexico|MY:Malaysia|MZ:Mozambique|NA:Namibia|NC:New Caledonia|NE:Niger (the)|NF:Norfolk Island|NG:Nigeria|NI:Nicaragua|NL:Netherlands (the)|NO:Norway|NP:Nepal|NR:Nauru|NU:Niue|NZ:New Zealand|OM:Oman|PA:Panama|PE:Peru|PF:French Polynesia|PG:Papua New Guinea|PH:Philippines (the)|PK:Pakistan|PL:Poland|PM:Saint Pierre and Miquelon|PN:Pitcairn|PR:Puerto Rico|PS:Palestine, State of|PT:Portugal|PW:Palau|PY:Paraguay|QA:Qatar|RE:Réunion|RO:Romania|RS:Serbia|RU:Russian Federation (the)|RW:Rwanda|SA:Saudi Arabia|SB:Solomon Islands|SC:Seychelles|SD:Sudan (the)|SE:Sweden|SG:Singapore|SH:Saint Helena, Ascension and Tristan da Cunha|SI:Slovenia|SJ:Svalbard and Jan Mayen|SK:Slovakia|SL:Sierra Leone|SM:San Marino|SN:Senegal|SO:Somalia|SR:Suriname|SS:South Sudan|ST:Sao Tome and Principe|SV:El Salvador|SX:Sint Maarten (Dutch part)|SY:Syrian Arab Republic|SZ:Swaziland|TC:Turks and Caicos Islands (the)|TD:Chad|TF:French Southern Territories (the)|TG:Togo|TH:Thailand|TJ:Tajikistan|TK:Tokelau|TL:Timor-Leste|TM:Turkmenistan|TN:Tunisia|TO:Tonga|TR:Turkey|TT:Trinidad and Tobago|TV:Tuvalu|TW:Taiwan (Province of China)|TZ:Tanzania, United Republic of|UA:Ukraine|UG:Uganda|UM:United States Minor Outlying Islands (the)|US:United States of America (the)|UY:Uruguay|UZ:Uzbekistan|VA:Holy See (the)|VC:Saint Vincent and the Grenadines|VE:Venezuela (Bolivarian Republic of)|VG:Virgin Islands (British)|VI:Virgin Islands (U.S.)|VN:Viet Nam|VU:Vanuatu|WF:Wallis and Futuna|WS:Samoa|YE:Yemen|YK:The Republic of Kosovo|YT:Mayotte|ZA:South Africa|ZM:Zambia|ZW:Zimbabwe`;

const REGISTRY = new Set<string>();
const NAMES = new Map<string, string>();
for (const pair of CJ_COUNTRIES_COMPACT.split('|')) {
  if (pair.length < 4 || pair[2] !== ':') continue;
  const iso = pair.slice(0, 2);
  NAMES.set(iso, pair.slice(3).replace(/\s+/g, ' ').trim() || iso);
  REGISTRY.add(iso);
}
// ضمانة صلبة — نفس الباك
['US', 'CN', 'GB', 'FR', 'MA', 'DZ', 'TN', 'EG', 'SA', 'AE', 'DE', 'ES', 'IT', 'YK'].forEach((c) => REGISTRY.add(c));
console.log(`[geoCountry] CJ registry loaded: ${REGISTRY.size} countries`);

/** alias → ISO-2 (UK→GB · XK→YK) — ورفض أي حاجة ماشي حرفين */
export function geoNormalize(raw: unknown): string | null {
  if (!raw) return null;
  let c = String(raw).trim().toUpperCase();
  if (c.length !== 2) return null;
  if (c === 'UK') c = 'GB';
  if (c === 'XK') c = 'YK';
  if (!/^[A-Z]{2}$/.test(c)) return null;
  return c;
}

export function geoIsSupported(code: string): boolean {
  return REGISTRY.has(code);
}

export function geoCountryName(code: string): string {
  return NAMES.get(code) || code;
}

export function geoRegistryCount(): number {
  return REGISTRY.size;
}

const GEO_HEADERS = [
  'cf-ipcountry',
  'x-vercel-ip-country',
  'cloudfront-viewer-country',
  'fastly-client-country',
  'x-geo-country',
  'x-geo-country-code',
  'x-country-code',
] as const;

export interface VisitorGeo {
  code: string;
  source: string;
  supported: boolean;
  ip?: string;
}

function geoClientIp(request: Request): string {
  // نفس الباك: XFF أولاً — على Workers نضيف cf-connecting-ip كـ fallback
  const xf = request.headers.get('x-forwarded-for');
  if (xf && xf.trim()) return xf.split(',')[0].trim();
  return request.headers.get('cf-connecting-ip') || '';
}

/** IP عمومي؟ (الخاص/اللوكال ما عندوش GeoIP) — نفس الباك */
function isPublicIp(ip: string): boolean {
  if (!ip) return false;
  if (ip.startsWith('::1') || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) return false;
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) return false;
  if (ip.startsWith('169.254.') || ip.startsWith('fc') || ip.startsWith('fd')) return false;
  if (ip === '::ffff:172.') return false;
  const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = m ? m[1] : ip;
  if (/^(10|127)\./.test(v4) || /^192\.168\./.test(v4) || /^172\.(1[6-9]|2\d|3[01])\./.test(v4)) return false;
  if (v4 === '0.0.0.0') return false;
  return /\d+\.\d+\.\d+\.\d+/.test(v4);
}

// 3: IP → بلد عبر ipwho.is — كاش 24h + in-flight dedup (نفس الباك)
const LOOKUP_TTL = 24 * 60 * 60 * 1000;
const lookupCache = new Map<string, { code: string | null; ts: number }>();
const lookupInflight = new Map<string, Promise<string | null>>();

function gcLookupCache(): void {
  if (lookupCache.size <= 3000) return;
  const now = Date.now();
  for (const [k, v] of lookupCache) if (now - v.ts > LOOKUP_TTL) lookupCache.delete(k);
}

async function lookupCountryByIp(ip: string): Promise<string | null> {
  const now = Date.now();
  const hit = lookupCache.get(ip);
  if (hit && now - hit.ts < LOOKUP_TTL) return hit.code;
  const inflight = lookupInflight.get(ip);
  if (inflight) return inflight;

  const job = (async () => {
    try {
      const { signal, done } = timeoutSignal(2500);
      let res: Response;
      try {
        res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
          signal,
          headers: { 'User-Agent': 'LaClarc-GeoGate/1.0' },
        });
      } finally {
        done();
      }
      const j: unknown = await res.json();
      const rec = asRec(j);
      const code = rec.success !== false ? geoNormalize(rec.country_code) : null;
      lookupCache.set(ip, { code, ts: Date.now() }); // كنكاشاو حتى النتيجة السالبة
      gcLookupCache();
      return code;
    } catch {
      lookupCache.set(ip, { code: null, ts: Date.now() });
      return null;
    } finally {
      lookupInflight.delete(ip);
    }
  })();
  lookupInflight.set(ip, job);
  return job;
}

/** 1+2: override ?country= ثم CDN geo headers بالترتيب */
function resolveVisitorCountryShallow(url: URL, request: Request): VisitorGeo | null {
  const q = geoNormalize(url.searchParams.get('country'));
  if (q && q !== 'XX') return { code: q, source: 'override', supported: geoIsSupported(q) };
  for (const h of GEO_HEADERS) {
    const v = geoNormalize(request.headers.get(h));
    if (v && v !== 'XX') return { code: v, source: `cdn:${h}`, supported: geoIsSupported(v) };
  }
  return null;
}

/** الحل الكامل — نفس resolveVisitorCountry من geoCountry.js */
export async function resolveVisitorCountry(request: Request): Promise<VisitorGeo> {
  const url = new URL(request.url);
  const shallow = resolveVisitorCountryShallow(url, request);
  if (shallow) return shallow;

  const ip = geoClientIp(request);
  if (isPublicIp(ip)) {
    const code = await lookupCountryByIp(ip);
    if (code) return { code, source: 'ip-lookup', supported: geoIsSupported(code), ip };
  }

  const def = geoNormalize(process.env.DEFAULT_COUNTRY) || 'US';
  return { code: def, source: 'default', supported: geoIsSupported(def), ip: ip || undefined };
}

// ══════════════════════════════════════════════════════════════════════
// 5) Normalizers — نسخة من utils/cjNormalize.js (المستعملة فالبريدج)
// ══════════════════════════════════════════════════════════════════════

/** أكبر رقم من قيمة CJ — "120.00-150.00" → 150 · "1,234.56" → 1234.56 · null → 0 */
export function parseMaxNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const matches = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!matches) return 0;
  const nums = matches.map(Number).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : 0;
}

/** وزن بالغرام (يدعم range) */
export function parseWeightGrams(value: unknown): number {
  return Math.round(parseMaxNumber(value));
}

/** array | JSON string | "a,b" → array */
export function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  const t = raw.trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      const parsed = JSON.parse(t) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return t.split(',').map((s) => s.trim()).filter(Boolean);
}

/** يقبل http/https فقط */
export function normalizeUrl(u: unknown): string | null {
  if (typeof u !== 'string') return null;
  let s = u.trim();
  if (!s) return null;
  if (s.startsWith('//')) s = `https:${s}`;
  return /^https?:\/\//i.test(s) ? s : null;
}

/** bigImage → productImageSet → productImage (→ variantImage اختياري) — بلا تكرار */
export function parseImageList(
  details: unknown,
  opts: { includeVariantImages?: boolean; max?: number } = {},
): string[] {
  const { includeVariantImages = true, max = 20 } = opts;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (u: unknown) => {
    const n = normalizeUrl(u);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  const d = asRec(details);
  push(d.bigImage);
  parseJsonArray(d.productImageSet).forEach(push);
  parseJsonArray(d.productImage).forEach(push);
  if (includeVariantImages) {
    for (const rawV of asArr(d.variants)) push(asRec(rawV).variantImage);
  }
  return out.slice(0, max);
}

// ══════════════════════════════════════════════════════════════════════
// 6) تسعير v3.1 — نسخة حرفية من productImportService.js
// ══════════════════════════════════════════════════════════════════════

const num = (v: unknown, d: number) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : d;
};
const SHIP_BASE = () => num(process.env.SYNC_SHIP_BASE_USD, 5.0);
const SHIP_PER_KG = () => num(process.env.SYNC_SHIP_PER_KG_USD, 4.0);
const TARGET_MARGIN = () => num(process.env.SYNC_TARGET_MARGIN, 0.35);
const PRICE_FLOOR = () => num(process.env.SYNC_PRICE_FLOOR, 9.99);

/** تقدير الشحن — معايرة shipping_matrix (DZ $6.19 / US $6.43 @~300g) */
export function estimateShipUsd(weightGrams: unknown): number {
  const kg = Math.max(Number(weightGrams) || 0, 50) / 1000;
  return SHIP_BASE() + kg * SHIP_PER_KG();
}

/**
 * معادلة التسعير الموحدة v3.1 — landed = cost + ship → fees → ÷ (1 - margin) → floor.
 * shipOverrideUsd (فريت حقيقي من freightCalculateTip) — null/0 → التقدير القديم.
 */
export function calculateSellingPrice(
  cjPrice: unknown,
  weightGrams = 0,
  shipOverrideUsd: number | null = null,
): { safePrice: number; safeOriginalPrice: null } {
  const cost = parseMaxNumber(cjPrice);
  if (cost <= 0) return { safePrice: PRICE_FLOOR(), safeOriginalPrice: null };

  const override = Number(shipOverrideUsd);
  const ship = override > 0 && Number.isFinite(override) ? override : estimateShipUsd(weightGrams);
  const landed = cost + ship;
  const fees = landed * 0.05 + 0.45; // دفع (~2.9% + $0.30) + طوارئ

  let price = (landed + fees) / (1 - TARGET_MARGIN());
  price = Math.max(PRICE_FLOOR(), Math.floor(price) - 0.01);

  return { safePrice: parseFloat(price.toFixed(2)), safeOriginalPrice: null };
}

/** تنظيف الوصف (XSS shield) — نسخة حرفية من sanitizeDescription (P2-6 + F#74 L3) — [phase-abc] السطر الرابع مكافئ دلالياً للأصل (\b[^>]*> يبتلع / الذاتية) — مثبت بـ Python regex diff 14 حالة */
export function sanitizeDescription(html: unknown): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(iframe|object|embed|form|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(iframe|object|embed|form|svg)\b[^>]*>/gi, '')
    .replace(/(^|[\s\/"'`])on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '$1')
    .replace(/javascript:/gi, '');
}

// ══════════════════════════════════════════════════════════════════════
// 7) مخازن CJ — /product/globalWarehouseList · كاش 24h + in-flight dedup
// ══════════════════════════════════════════════════════════════════════

const WAREHOUSE_SEED = new Set(['CN', 'US']); // الموثقين — globalWarehouseList كيوسعهم
let warehouseCache: { set: Set<string>; ts: number } | null = null;
let whInflight: Promise<Set<string>> | null = null;

export async function getWarehouseCountries(): Promise<Set<string>> {
  if (warehouseCache && Date.now() - warehouseCache.ts < WAREHOUSE_TTL) return warehouseCache.set;
  if (whInflight) return whInflight;

  whInflight = (async () => {
    let set = new Set(WAREHOUSE_SEED);
    try {
      const r = await cjFetch('/product/globalWarehouseList', { timeoutMs: 8000 });
      const arr = r.data?.data;
      if (Array.isArray(arr)) {
        for (const rawW of arr) {
          const w = asRec(rawW);
          const c = geoNormalize(w.countryCode);
          if (c && !w.disabled) set.add(c);
        }
      }
      console.log('[cj-live/search][warehouses]', [...set].join(','));
      warehouseCache = { set, ts: Date.now() };
    } catch (e) {
      console.warn('[cj-live/search][warehouses]', e instanceof Error ? e.message : e);
      set = new Set(WAREHOUSE_SEED); // fallback موثق — ما كيوقفش البحث (مكاشا بحال الباك)
      warehouseCache = { set, ts: Date.now() };
    } finally {
      whInflight = null;
    }
    return set;
  })();
  return whInflight;
}

// ══════════════════════════════════════════════════════════════════════
// 8) 1.3 unavailableShippingMethods — تشخيص freightCalculateTip (سيرفر-side برك)
// ══════════════════════════════════════════════════════════════════════

export interface FreightDiagReason {
  optionName: string;
  errorCode: number | string | null;
  errorEn: string;
}

export async function freightDiagnose(row: Rec): Promise<FreightDiagReason[]> {
  try {
    const dr = await cjFetch('/logistic/unavailableShippingMethods', {
      method: 'POST',
      body: { reqDTOS: [row] },
      timeoutMs: 15000,
    });
    const denv = dr.data;
    if (!denv || (denv.code !== 200 && denv.code !== 0)) {
      console.warn('[cj-live/product][freight][diag][cj-envelope]', denv?.code ?? null, denv?.message || '');
      return [{ optionName: 'diagnostic', errorCode: denv?.code ?? null, errorEn: String(denv?.message || '') }];
    }
    const dd = asRec(denv.data);
    const un = asArr(dd.unavailableList);
    const av = asArr(dd.availableList);
    const reasons = un.slice(0, 5).map((rawU) => {
      const u = asRec(rawU);
      return {
        optionName: asStr(u.optionName),
        errorCode: (u.errorCode ?? null) as number | string | null,
        errorEn: String(u.errorEn || u.error || ''),
      };
    });
    console.warn('[cj-live/product][freight][diag]', `available=${av.length} unavailable=${un.length}`, JSON.stringify(reasons).slice(0, 400));
    return reasons.length
      ? reasons
      : [{ optionName: 'diagnostic', errorCode: null, errorEn: `no reasons returned (available=${av.length})` }];
  } catch (de) {
    console.warn('[cj-live/product][freight][diag]', de instanceof Error ? de.message : de);
    return [{ optionName: 'diagnostic', errorCode: null, errorEn: String(de instanceof Error ? de.message : de || '') }];
  }
}

// ══════════════════════════════════════════════════════════════════════
// 9) ريفيوزات CJ — GET /product/productComments · كاش 6h (نسخة fetchCjReviews)
// ══════════════════════════════════════════════════════════════════════

export interface CjReview {
  id: string;
  name: string;
  score: number;
  date: string;
  text: string;
  images: string[];
  country: string;
  flag: string;
}

export interface CjReviewsResult {
  total: number;
  page: number;
  size: number;
  reviews: CjReview[];
}

/**
 * درس الوثيقة: commentId = long 19 خانة أكبر من MAX_SAFE_INTEGER — JSON.parse كيقصّو بصمت.
 * الحل: الجواب كيتقري كنص وكنقتبسو الأرقام الطوال قبل JSON.parse.
 */
function parseCjCommentsText(txt: unknown): CjEnvelope {
  const safe = String(txt).replace(/("[A-Za-z_]*[Ii]d"\s*:\s*)(\d{15,})/g, '$1"$2"');
  return JSON.parse(safe) as CjEnvelope;
}

export async function fetchCjReviews(
  pid: string,
  opts: { page?: unknown; size?: unknown; score?: unknown } = {},
): Promise<CjReviewsResult> {
  const page = Math.min(Math.max(parseInt(String(opts.page ?? ''), 10) || 1, 1), 200);
  const size = Math.min(Math.max(parseInt(String(opts.size ?? ''), 10) || 20, 1), 50);
  const scoreN = parseInt(String(opts.score ?? ''), 10) || 0;
  const score = scoreN >= 1 && scoreN <= 5 ? scoreN : null;
  const key = `${pid}|${page}|${size}|${score || ''}`;
  const hit = cacheGet<CjReviewsResult>(reviewsCache, key, REVIEWS_TTL);
  if (hit) return hit;

  const query: Record<string, string | number | undefined> = { pid, pageNum: page, pageSize: size };
  if (score) query.score = score;
  const r = await cjFetch('/product/productComments', { query, timeoutMs: 15000, rawText: true });

  // envelope ديال CJ — النجاح success:true والخطأ result:false — الثابت الموثوق: code===0 (ونقبل 200)
  let env: CjEnvelope | null = null;
  try { env = parseCjCommentsText(r.text); } catch (pe) {
    console.warn('[cj-live/reviews][parse]', pe instanceof Error ? pe.message : pe);
  }
  const envCode = typeof env?.code === 'number' ? env.code : null;
  if (!env || (envCode !== 0 && envCode !== 200) || env.result === false) {
    console.warn('[cj-live/reviews][cj-envelope]', envCode, env?.message || '');
    throw new CjEnvelopeError(envCode, String(env?.message || '') || 'unknown');
  }

  const d = asRec(env.data);
  const list = asArr(d.list);
  const reviews = list
    .map((rawC) => {
      const c = asRec(rawC);
      return {
        id: String(c.commentId ?? ''),
        name: String(c.commentUser || 'CJ Buyer').slice(0, 60),
        score: Math.min(Math.max(parseInt(String(c.score ?? ''), 10) || 0, 1), 5),
        date: String(c.commentDate || ''),
        text: String(c.comment || '').slice(0, 1000),
        images: (Array.isArray(c.commentUrls) ? c.commentUrls : [])
          .filter((u): u is string => typeof u === 'string' && u.startsWith('http'))
          .slice(0, 6),
        country: c.countryCode ? geoCountryName(String(c.countryCode)) || String(c.countryCode) : '',
        flag: typeof c.flagIconUrl === 'string' ? c.flagIconUrl : '',
      };
    })
    .filter((x) => x.id && x.date && x.score >= 1);

  const out: CjReviewsResult = {
    total: parseInt(String(d.total ?? ''), 10) || reviews.length,
    page,
    size,
    reviews,
  };
  cacheSet(reviewsCache, key, out);
  return out;
}
