'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Check, Plane, Truck, Zap } from 'lucide-react';

// ════════════════════════════════════════════════════════════════
// DeliveryEstimator v6 [cj-eta-v6] — Kit 29g [cj-freeship] + Kit 29h [glassdock-v1]
// (LaClarc × CJ live ETA — «التوصيل مجاني» هي نجمة الصندوق)
//
// 🧩 STANDALONE — كما v3/v4: كيكتاشف المنتج من الـ URL (usePathname)
//   → /api/products/:id → cj_product_id → البريدج /api/cj-live/product/:cjPid
//   بلا أي props إجبارية، وأي props آخرين مقبولين ([key: string]: unknown).
//
// 🆕 v5 — تراجع صريح من المستخدم: فكرة اختيار القنوات (أزرار v4) ملغاة.
//   المطلوب: ميزة «توصيل مجاني» تبان بارزة للعميل — والشحن محسوب كامل
//   فالثمن (قانون التسعير v3.1) وكيبقى سر داخلي 100%.
//   • عنوان أخضر بارز: 🚚 Free Delivery فوق كلشي
//   • نافذة الوصول الحقيقية من CJ — shipping.arrivalTime هو القناة اللي
//     المتجر كيشحن بيها فعلاً (الأرخص — البريدج كيرجعها أصلاً)
//   • بلا أزرار · بلا أسماء قنوات · بلا أثمنة — حتى فالـ tooltip
//   • شارة صغيرة "⚡ live CJ window" كدليل مصداقية على النافذة
//
// 🛟 fallback واقعي كما v3: بلا رابط CJ / بلا قناة / fetch فاشل →
//   نافذة صادقة 2-4 أسابيع (+14/+28) — عمرنا ما نرجعو للتواريخ الخيالية.
//
// 💰 النقاط: MISS ≈ 20pt (كاش البريدج 10د/منتج×بلد → HIT = 0pt) · /geo = 0pt.
// ════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

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

interface LiveEta {
  country: string;
  start: string;
  end: string;
  raw: string;
}

export default function DeliveryEstimator({ cjPid }: EstimatorProps = {}) {
  const pathname = usePathname();
  const [deliveryDates, setDeliveryDates] = useState({
    start: '', end: '', hoursLeft: 4, minsLeft: 32,
  });
  const [selfPid, setSelfPid] = useState<string | null>(null);
  const [live, setLive] = useState<LiveEta | null>(null);
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

    // 🩹 live minute-tick: العدّاد يعيش ويحدّث التواريخ لو غيّر اليوم
    const timer = setInterval(calculateDates, 60000);

    return () => clearInterval(timer);
  }, []);

  // 🧩 [cj-eta-v6] self-discovery: /products/51151 → 51151 → cj_product_id
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

  // 🆕 [cj-eta-v6] نافذة الوصول الحقيقية (freightCalculateTip عبر البريدج)
  // shipping.arrivalTime = القناة اللي المتجر كيشحن بيها فعلاً — هي كيتعرض
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

        const raw = String(ship.arrivalTime).trim();
        const w = parseWindow(raw);
        if (!w) return;

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

        setLive({ country, start: fmt(w.min), end: fmt(w.max), raw });
      } catch {
        // شبكة/سيرفر نائم → fallback الواقعي — عمداً بلا alert
      }
    })();

    return () => { dead = true; };
  }, [effectivePid]);

  // 🌍 [cj-eta-v6] بلد الزائر للـ fallback (0pt — GeoIP من الهيدر، بلا CJ)
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

  return (
    <div className="bg-fog-50/60 border border-[#5B7EA6]/25 rounded-2xl p-4 my-4 space-y-3 font-sans">

      {/* 🆕 [cj-eta-v6] عنوان التوصيل المجاني — النجمة ديال الصندوق */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* ✨ SERENE — الأخضر الهادئ #7C9E85 (القانون: أخضر «مجاني» وحيد فالنظام —
            maroccan-tea-500 الليموني كان خارج الهوية) */}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#7C9E85] text-white text-[13px] font-black uppercase tracking-wide shadow-sm">
          <Truck size={14} strokeWidth={2.5} /> Free Delivery
        </span>
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
          Worldwide · On Us
        </span>
      </div>

      {/* سطر موعد الوصول — نافذة CJ الحقيقية [cj-eta-v6] أو نافذة واقعية عامة */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white text-[#5B7EA6] flex items-center justify-center text-base shrink-0 border border-[#5B7EA6]/20 shadow-xs">
          <Plane size={16} strokeWidth={2.3} />
        </div>
        <div className="text-xs leading-relaxed flex-1">
          {live ? (
            <>
              <p className="font-bold text-gray-900">
                Estimated arrival to {live.country || 'You'}:{' '}
                <span className="text-[#5B7EA6] font-black underline decoration-[#5B7EA6]/40 underline-offset-2">
                  {live.start} – {live.end}
                </span>
                {' '}
                <span className="inline-block align-middle ml-1 px-1.5 py-0.5 rounded-full bg-[#7C9E85]/10 border border-[#7C9E85]/25 text-[10px] font-black text-[#587B62] uppercase tracking-wide">
                  <Zap size={11} strokeWidth={2.6} className="inline-block align-[-2px] mr-0.5" /> live CJ window · {live.raw} days
                </span>
              </p>
              <p className="text-[11px] text-gray-500 mt-1 font-medium">
                No shipping fees — delivery is on us, tracked &amp; insured all the way.
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-gray-900">
                Estimated arrival{fallbackCountry ? ` to ${fallbackCountry}` : ''}:{' '}
                <span className="text-[#5B7EA6] font-black underline decoration-[#5B7EA6]/40 underline-offset-2">
                  {deliveryDates.start} – {deliveryDates.end}
                </span>
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                Order within <strong className="text-[#587B62] font-bold">{deliveryDates.hoursLeft}h {deliveryDates.minsLeft}m</strong> — ships within 24–48h via CJ.
              </p>
            </>
          )}
        </div>
      </div>

      {/* شريط مؤشرات الثقة الأربعة */}
      <div className="pt-3 border-t border-[#5B7EA6]/15 grid grid-cols-2 gap-2 text-[11px] font-bold text-gray-700">
        <div className="flex items-center gap-1.5">
          <Check size={14} strokeWidth={3} className="text-[#7C9E85] shrink-0" />
          <span>Free Worldwide Shipping</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={14} strokeWidth={3} className="text-[#7C9E85] shrink-0" />
          <span>30-Day Money-Back Guarantee</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={14} strokeWidth={3} className="text-[#7C9E85] shrink-0" />
          <span>Direct Factory Insured</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Check size={14} strokeWidth={3} className="text-[#7C9E85] shrink-0" />
          <span>256-Bit SSL Encrypted</span>
        </div>
      </div>

    </div>
  );
}
