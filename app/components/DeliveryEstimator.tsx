'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// ════════════════════════════════════════════════════════════════
// DeliveryEstimator v4 [cj-eta-v4] — Kit 29f [cj-eta-pick]
// (LaClarc × CJ live ETA — المتسوق يختار سرعة التوصيل اللي يشوفها)
//
// 🧩 STANDALONE — كما v3: كيكتاشف المنتج من الـ URL (usePathname)
//   → /api/products/:id → cj_product_id → البريدج /api/cj-live/product/:cjPid
//   بلا أي props إجبارية، وأي props آخرين مقبولين ([key: string]: unknown).
//
// 🆕 v4 — اختيار القناة: البريدج أصلاً كيرجع top-3 قنوات CJ الحقيقية
//   (options[] فيها name/arrivalTime/amount) فنفس الجواب — صفر نقاط زيادة.
//   المكوّن كيبنيهم أزرار: ⚡ Fastest · 🚚 Standard · 🌍 Economy (مرتبين
//   بالسرعة)، والعميل كينقر ويشوف نافذة الوصول ديال كل قناة.
//   الافتراضي المختار = القناة الأرخص (اللي المتجر فعلاً كيشحن بيها).
//
// 🔒 مجاني للعميل: ثمن القنوات ما كيتعرضش أبداً (SHOW_CHANNEL_PRICES=false)
//   — الشحن مجاني ومحسوب كامل فالثمن (قانون التسعير v31). غير السرعة
//   والنافذة كيبانو، واسم ناقل CJ الحقيقي كيتحط فـ tooltip.
//
// 🛟 fallback واقعي كما v3: بلا رابط CJ / بلا قناة / fetch فاشل →
//   نافذة صادقة 2-4 أسابيع (+14/+28) — عمرنا ما نرجعو للتواريخ الخيالية.
//
// 💰 النقاط: MISS ≈ 20pt (كاش البريدج 10د/منتج×بلد → HIT = 0pt) · /geo = 0pt.
// ════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

// 🔒 ثمن القنوات داخلي — العميل كيشوف التوصيل مجاني (محسوب فالثمن أصلاً)
const SHOW_CHANNEL_PRICES = false;

interface Tier {
  raw: string;       // arrivalTime الأصلي من CJ ("5-8")
  name: string;      // اسم ناقل CJ (Yw Eub · 燕文…)
  amount: number;    // الثمن الداخلي (ما كيتعرضش)
  min: number;
  max: number;
  start: string;     // اليوم+min منسق
  end: string;       // اليوم+max منسق
}

interface LiveState {
  country: string;
  tiers: Tier[];
  defaultIdx: number; // القناة الأرخص — اللي المتجر كيشحن بيها فعلاً
}

// أي props مقبولين — المكوّن ما يكسرش الـ build مهما كان شكل المستدعي
type EstimatorProps = { cjPid?: string | number | null; [key: string]: unknown };

// استخراج cj_product_id دفاعياً: الجواب فلاط (res.json(product))
// أو ملفوف { product: … } / { data: … } — كاملين مدعومين
function extractCjPid(j: unknown): string | null {
  if (typeof j !== 'object' || j === null) return null;
  const root = j as Record<string, unknown>;
  let cand: unknown = root;
  if (typeof root.product === 'object' && root.product !== null) cand = root.product;
  else if (typeof root.data === 'object' && root.data !== null) cand = root.data;
  const obj = cand as Record<string, unknown>;
  const v = obj.cj_product_id;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

// تحليل arrivalTime ديال CJ: "20-60" · "12-50" · رقم واحد "30"
function parseWindow(raw: string): { min: number; max: number } | null {
  const m = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
  const min = m ? parseInt(m[1], 10) : parseInt(raw, 10);
  const max = m ? parseInt(m[2], 10) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) return null;
  return { min, max };
}

export default function DeliveryEstimator({ cjPid }: EstimatorProps = {}) {
  const pathname = usePathname();
  const [deliveryDates, setDeliveryDates] = useState({
    start: '', end: '', hoursLeft: 4, minsLeft: 32,
  });
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [sel, setSel] = useState(0);
  const [fallbackCountry, setFallbackCountry] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  const effectivePid = cjPid ? String(cjPid) : selfPid;

  useEffect(() => {
    setIsMounted(true);

    const calculateDates = () => {
      const today = new Date();

      // 🛟 fallback واقعي للمندوبية من الصين: 2-4 أسابيع (+14 → +28)
      const startDate = new Date(today);
      startDate.setDate(today.getDate() + 14);

      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 28);

      const formatOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };

      // حساب الساعات المتبقية لإرسال شحنات اليوم (قبل نهاية الساعة 20:00)
      const now = new Date();
      const cutoff = new Date();
      cutoff.setHours(20, 0, 0, 0);

      let diffMs = cutoff.getTime() - now.getTime();
      if (diffMs <= 0) {
        cutoff.setDate(cutoff.getDate() + 1);
        diffMs = cutoff.getTime() - now.getTime();
      }

      const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
      const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      setDeliveryDates({
        start: startDate.toLocaleDateString('en-US', formatOptions),
        end: endDate.toLocaleDateString('en-US', formatOptions),
        hoursLeft,
        minsLeft,
      });
    };

    calculateDates();

    // 🩹 FIX — live minute-tick: العدّاد يعيش ويحدّث التواريخ لو غيّر اليوم
    const timer = setInterval(calculateDates, 60000);

    return () => clearInterval(timer);
  }, []);

  // 🧩 [cj-eta-v4] self-discovery: /products/51151 → 51151 → cj_product_id
  useEffect(() => {
    if (cjPid) return; // prop موجود → ما كانحتاجش الاكتشاف
    if (!pathname) return;
    const segs = pathname.split('?')[0].split('#')[0].split('/').filter(Boolean);
    if (segs.length < 2 || segs[segs.length - 2] !== 'products') return;
    const routeId = segs[segs.length - 1];
    if (!/^\d+$/.test(routeId)) return; // غير الـ ids الرقمية ديال الكاطالوغ

    let dead = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${routeId}`);
        if (!res.ok) return; // 404/5xx → fallback — صامت عمداً
        const j: unknown = await res.json();
        if (dead) return;
        const pid = extractCjPid(j);
        if (pid) setSelfPid(pid);
      } catch {
        // شبكة/سيرفر نائم → fallback — عمداً بلا صوت
      }
    })();

    return () => { dead = true; };
  }, [cjPid, pathname]);

  // 🆕 [cj-eta-v4] نافذة الوصول الحقيقية + قنوات CJ (freightCalculateTip عبر البريدج)
  useEffect(() => {
    if (!effectivePid) return; // منتج بلا رابط CJ → fallback الواقعي
    let dead = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cj-live/product/${effectivePid}`);
        if (!res.ok) return; // 502/404 → fallback (البريدج كيفهم — بلا صمت)
        const data = await res.json();
        if (dead) return;

        const ship = data?.shipping;
        if (!ship || ship.source !== 'cj-live' || !ship.arrivalTime) return;

        const fmt = (days: number) => {
          const dt = new Date();
          dt.setDate(dt.getDate() + days);
          return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        };

        // بناء القنوات من options[] (name/arrivalTime/amount) — وإلا القناة الرئيسية برك
        const rawOpts: unknown[] = Array.isArray(ship.options) && ship.options.length
          ? ship.options
          : [{ name: ship.channelName, arrivalTime: ship.arrivalTime, amount: ship.amount }];

        const seen = new Set<string>();
        const tiers: Tier[] = [];
        for (const o of rawOpts) {
          if (!o || typeof o !== 'object') continue;
          const rec = o as Record<string, unknown>;
          const raw = String(rec.arrivalTime ?? '').trim();
          if (!raw) continue;
          const w = parseWindow(raw);
          if (!w) continue;
          const name = typeof rec.name === 'string' ? rec.name : '';
          const key = raw + '|' + name;
          if (seen.has(key)) continue;
          seen.add(key);
          const amt = typeof rec.amount === 'number' ? rec.amount : parseFloat(String(rec.amount ?? ''));
          tiers.push({
            raw, name,
            amount: Number.isFinite(amt) ? amt : 0,
            min: w.min, max: w.max,
            start: fmt(w.min), end: fmt(w.max),
          });
        }
        if (!tiers.length) return;

        // ⚡ مرتبين بالسرعة (الأسرع أول) — تعادل → النافذة الأقصر → الثمن
        tiers.sort((a, b) => (a.min - b.min) || (a.max - b.max) || (a.amount - b.amount));

        // الافتراضي = الأرخص (القناة اللي المتجر فعلاً كيشحن بيها)
        let defaultIdx = 0;
        const primaryAmt = typeof ship.amount === 'number' ? ship.amount : parseFloat(String(ship.amount ?? ''));
        if (Number.isFinite(primaryAmt)) {
          const i = tiers.findIndex(t => t.amount === primaryAmt);
          if (i >= 0) defaultIdx = i;
        } else {
          defaultIdx = tiers.reduce((best, t, i) => (t.amount < tiers[best].amount ? i : best), 0);
        }

        // اسم البلد الكامل من الكود (HK → Hong Kong) — client-side، بلا نداء
        let country = String(data?.geo?.country || '').toUpperCase();
        try {
          const dn = new Intl.DisplayNames(['en'], { type: 'region' });
          const nice = dn.of(country);
          if (nice && nice.toUpperCase() !== country) country = nice;
        } catch { /* Intl غير مدعوم → نبقى على الكود */ }

        setLive({ country, tiers, defaultIdx });
        setSel(defaultIdx);
      } catch {
        // شبكة/سيرفر نائم → fallback الواقعي — عمداً بلا alert
      }
    })();

    return () => { dead = true; };
  }, [effectivePid]);

  // 🌍 [cj-eta-v4] بلد الزائر للـ fallback (0pt — GeoIP من الهيدر، بلا CJ)
  useEffect(() => {
    if (live?.country) return;
    let dead = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cj-live/geo`);
        if (!res.ok) return;
        const data = await res.json();
        if (dead) return;
        const code = String(data?.country || '').toUpperCase();
        if (!code) return;
        let nice = data?.name && typeof data.name === 'string' ? data.name : '';
        if (!nice) {
          try {
            const dn = new Intl.DisplayNames(['en'], { type: 'region' });
            const n = dn.of(code);
            if (n && n.toUpperCase() !== code) nice = n;
          } catch { /* نبقى على الكود */ }
        }
        setFallbackCountry(nice || code);
      } catch {
        // صامت — الـ fallback يخدم بلا بلد
      }
    })();
    return () => { dead = true; };
  }, [live]);

  if (!isMounted) return null;

  const t = live && live.tiers[sel] ? live.tiers[sel] : null;
  const nTiers = live?.tiers.length ?? 0;

  // 🏷️ لقب القناة حسب الترتيب ديال السرعة
  const tierLabel = (i: number, n: number) => {
    if (n <= 1) return '🚚 Standard';
    if (i === 0) return '⚡ Fastest';
    if (i === n - 1) return '🌍 Economy';
    return '🚚 Standard';
  };

  return (
    <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-2xl p-4 my-4 space-y-3 font-sans">

      {/* سطر موعد الوصول — القناة المختارة من CJ [cj-eta-v4] أو نافذة واقعية عامة */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white text-[#8B78C6] flex items-center justify-center text-base shrink-0 border border-[#8B78C6]/20 shadow-xs">
          ✈️
        </div>
        <div className="text-xs leading-relaxed flex-1">
          {live && t ? (
            <>
              <p className="font-bold text-gray-900">
                Estimated Delivery to {live.country || 'You'}:{' '}
                <span
                  className="text-[#8B78C6] font-black underline decoration-[#8B78C6]/40 underline-offset-2"
                  title={t.name ? `CJ channel: ${t.name}` : undefined}
                >
                  {t.start} – {t.end}
                </span>
                {' '}
                <span className="inline-block align-middle ml-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700 uppercase tracking-wide">
                  ⚡ live CJ quote · {t.raw} days
                </span>
              </p>

              {/* 🆕 [cj-eta-v4] أزرار سرعة التوصيل — خيارات CJ الحقيقية، العميل يختار */}
              {nTiers >= 2 && (
                <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="CJ delivery speed options">
                  {live.tiers.map((tier, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={i === sel}
                      onClick={() => setSel(i)}
                      title={tier.name ? `CJ channel: ${tier.name}` : undefined}
                      className={
                        'px-2 py-0.5 rounded-full border text-[10px] font-bold transition-colors cursor-pointer ' +
                        (i === sel
                          ? 'bg-[#8B78C6] text-white border-[#8B78C6]'
                          : 'bg-white text-gray-600 border-[#8B78C6]/30 hover:border-[#8B78C6]/60')
                      }
                    >
                      {tierLabel(i, nTiers)} · {tier.raw}d
                    </button>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-gray-500 mt-1 font-medium">
                Free shipping included — real CJ carrier window for your country.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-gray-900">
                Estimated Delivery{fallbackCountry ? ` to ${fallbackCountry}` : ''}:{' '}
                <span className="text-[#8B78C6] font-black underline decoration-[#8B78C6]/40 underline-offset-2">
                  {deliveryDates.start} – {deliveryDates.end}
                </span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                Order within <strong className="text-emerald-700 font-bold">{deliveryDates.hoursLeft}h {deliveryDates.minsLeft}m</strong> — ships within 24–48h via CJ.
              </p>
            </>
          )}
        </div>
      </div>

      {/* شريط مؤشرات الثقة الأربعة */}
      <div className="pt-3 border-t border-[#8B78C6]/15 grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-700">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>Free Worldwide Shipping</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>30-Day Money-Back Guarantee</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>Direct Factory Insured</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-600">✓</span>
          <span>256-Bit SSL Encrypted</span>
        </div>
      </div>

    </div>
  );
}
