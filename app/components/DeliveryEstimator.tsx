'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// ════════════════════════════════════════════════════════════════
// DeliveryEstimator v3 [cj-eta-v3] — Kit 29e v2 (LaClarc × CJ live ETA)
//
// 🧩 STANDALONE — المكوّن كيخدم بوحدو بلا أي props ولا رقعات فـ
//   ProductDetailsClient: كيكتاشف الـ product id من الـ URL (usePathname)
//   كيجيب cj_product_id من /api/products/:id (SELECT * كيرجعو أصلاً)
//   ومن بعد كيسقسي البريدج /api/cj-live/product/:cjPid.
//   إلا مرّر لي حدا cjPid كـ prop → كيستعملو مباشرة (بلا fetch إضافي)
//   وأي props آخرين كيتقبلو بصمت ([key: string]: unknown) — المكوّن
//   ما يكسرش الـ build مهما كان شكل المستدعي.
//
// 🌍 البريدج كيكشف بلد الزائر أوتوماتيك (cf-ipcountry عبر Cloudflare→Render)
//   وكينادي freightCalculateTip. إلا رجعت قناة حقيقية (source=cj-live):
//   التواريخ كولحي من نافذة الوصول الحقيقية ديال CJ
//   (arrivalTime "20-60" → اليوم+20 → اليوم+60) + شارة "live CJ quote"
//   + اسم قناة الشحن كـ tooltip. بلا تغيير الثمن ولا السلة.
//
// 🛟 fallback واقعي: بلا رابط CJ / بلا قناة / fetch فاشل → نافذة عامة
//   صادقة 2-4 أسابيع (+14/+28) — عمرنا ما نرجعو للتواريخ الخيالية
//   القصيرة (مخاطر شكاوى واسترجاعات للمندوبية من الصين).
//
// 💰 النقاط: MISS ≈ 20pt (product/query 10 + freightCalculateTip 10)
//   كاش البريدج 10د لكل (منتج×بلد) → HIT = 0pt · /geo = 0pt دائماً.
// ════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

interface LiveEta {
  start: string;
  end: string;
  country: string;
  channel: string;
  range: string;
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

export default function DeliveryEstimator({ cjPid }: EstimatorProps = {}) {
  const pathname = usePathname();
  const [deliveryDates, setDeliveryDates] = useState({
    start: '', end: '', hoursLeft: 4, minsLeft: 32,
  });
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const [liveEta, setLiveEta] = useState<LiveEta | null>(null);
  const [fallbackCountry, setFallbackCountry] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  const effectivePid = cjPid ? String(cjPid) : selfPid;

  useEffect(() => {
    setIsMounted(true);

    const calculateDates = () => {
      const today = new Date();

      // 🛟 fallback واقعي للمندوبية من الصين: 2-4 أسابيع (+14 → +28)
      //   عمرنا ما نعرض تواريخ خيالية قصيرة — شكاوى واسترجاعات
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

  // 🧩 [cj-eta-v3] self-discovery: /products/51151 → 51151 → cj_product_id
  //   (كي تعمل إلا ما مرّرش لينا cjPid كـ prop)
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

  // 🆕 [cj-eta-v3] نافذة الوصول الحقيقية من CJ (freightCalculateTip عبر البريدج)
  useEffect(() => {
    if (!effectivePid) return; // منتج بلا رابط CJ → fallback الواقعي
    let dead = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/cj-live/product/${effectivePid}`);
        if (!res.ok) return; // 502/404 → fallback (بلا صمت في الـ console.error — البريدج كيفهم)
        const data = await res.json();
        if (dead) return;

        const ship = data?.shipping;
        if (!ship || ship.source !== 'cj-live' || !ship.arrivalTime) return;

        // arrivalTime من CJ: "20-60" · "12-50" · رقم واحد "30"
        const raw = String(ship.arrivalTime);
        const m = raw.match(/(\d+)\s*[-–]\s*(\d+)/);
        const minDays = m ? parseInt(m[1], 10) : parseInt(raw, 10);
        const maxDays = m ? parseInt(m[2], 10) : minDays;
        if (!Number.isFinite(minDays) || !Number.isFinite(maxDays) || minDays <= 0 || maxDays < minDays) return;

        const fmt = (days: number) => {
          const dt = new Date();
          dt.setDate(dt.getDate() + days);
          return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        };

        // اسم البلد الكامل من الكود (HK → Hong Kong) — client-side، بلا نداء
        let country = String(data?.geo?.country || '').toUpperCase();
        try {
          const dn = new Intl.DisplayNames(['en'], { type: 'region' });
          const nice = dn.of(country);
          if (nice && nice.toUpperCase() !== country) country = nice;
        } catch { /* Intl غير مدعوم → نبقى على الكود */ }

        setLiveEta({
          start: fmt(minDays),
          end: fmt(maxDays),
          country,
          channel: String(ship.channelName || ''),
          range: raw,
        });
      } catch {
        // شبكة/سيرفر نائم → fallback الواقعي — عمداً بلا alert
      }
    })();

    return () => { dead = true; };
  }, [effectivePid]);

  // 🌍 [cj-eta-v3] بلد الزائر للـ fallback (0pt — GeoIP من الهيدر، بلا CJ)
  //   كي تعمل غير ملي ما كاينش ETA حي — إلا جا حي، البلد ديالو كافي
  useEffect(() => {
    if (liveEta?.country) return;
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
  }, [liveEta]);

  if (!isMounted) return null;

  return (
    <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-2xl p-4 my-4 space-y-3 font-sans">

      {/* سطر موعد الوصول — حقيقي من CJ [cj-eta-v3] أو نافذة واقعية عامة */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white text-[#8B78C6] flex items-center justify-center text-base shrink-0 border border-[#8B78C6]/20 shadow-xs">
          ✈️
        </div>
        <div className="text-xs leading-relaxed">
          {liveEta ? (
            <>
              <p className="font-bold text-gray-900">
                Estimated Delivery to {liveEta.country || 'You'}:{' '}
                <span
                  className="text-[#8B78C6] font-black underline decoration-[#8B78C6]/40 underline-offset-2"
                  title={liveEta.channel ? `CJ channel: ${liveEta.channel}` : undefined}
                >
                  {liveEta.start} – {liveEta.end}
                </span>
                {' '}
                <span className="inline-block align-middle ml-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700 uppercase tracking-wide">
                  ⚡ live CJ quote · {liveEta.range} days
                </span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                Real carrier window from CJ Dropshipping for your country.
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
