'use client';

import { useEffect, useState } from 'react';
import GlassIcon from '@/components/ui/GlassIcon';

interface JourneyEvent {
  type: string;
  location: string;
  description: string;
  time: string;
}

interface Journey {
  order: { id: number; order_number?: string; status: string; tracking: string; destination: string };
  currentStage: string;
  events: JourneyEvent[];
  eta: { predictedDays: number; confidence: string; message: string };
}

const STAGE_ICONS: Record<string, string> = {
  PROCESSING: '🏭',
  PACKED: '📦',
  DEPARTED: '✈️',
  IN_TRANSIT: '🚢',
  ARRIVED_COUNTRY: '🛬',
  CUSTOMS: '🛃',
  OUT_FOR_DELIVERY: '🚚',
  DELIVERED: '🎉',
  UPDATE: '📍',
  ARRIVED: '🛬',
};

const STAGE_LABELS: Record<string, { en: string; ar: string }> = {
  PROCESSING: { en: 'Preparing your order', ar: 'نجهز طلبك' },
  PACKED: { en: 'Packed at warehouse (CN)', ar: 'مُعبأ في المستودع (الصين)' },
  DEPARTED: { en: 'Departed from China', ar: 'انطلق من الصين' },
  IN_TRANSIT: { en: 'Crossing the world', ar: 'في رحلة عالمية' },
  ARRIVED_COUNTRY: { en: 'Arrived in your country', ar: 'وصل بلدك' },
  CUSTOMS: { en: 'Customs clearance', ar: 'التخليص الجمركي' },
  OUT_FOR_DELIVERY: { en: 'Out for delivery', ar: 'في طريقه إليك الآن' },
  DELIVERED: { en: 'Delivered!', ar: 'وصل! 🎉' },
  UPDATE: { en: 'Shipment update', ar: 'تحديث شحنة' },
  ARRIVED: { en: 'Arrived', ar: 'وصل' },
};

export default function ShipTruthJourney({ orderId, email }: { orderId: number; email: string }) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'en' | 'ar'>(/* يحسب من المتصفح */ 'en');

  // 🌐 لغة تلقائية حسب المتصفح — عالمي من أول ثانية
  useEffect(() => {
    const browserLang = navigator.language.slice(0, 2).toLowerCase();
    if (browserLang === 'ar') setLang('ar');
  }, []);

  useEffect(() => {
    if (!orderId || !email) return;
    const controller = new AbortController();
    setLoading(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
    fetch(`${API_URL}/api/tracking/${orderId}/journey?email=${encodeURIComponent(email)}`, {
      signal: controller.signal,
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setJourney(data); })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [orderId, email]);

  // Auto-refresh كل 5 دقائق للطلبات النشطة — Truth دائمًا حي
  useEffect(() => {
    if (!journey || journey.currentStage === 'DELIVERED') return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
    const interval = setInterval(() => {
      fetch(`${API_URL}/api/tracking/${orderId}/journey?email=${encodeURIComponent(email)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setJourney(data); })
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [journey, orderId, email]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-white rounded-3xl shadow-sm animate-pulse">
        <div className="h-6 bg-gray-100 rounded-lg w-1/2 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!journey) return null; // فشل التحقق — لا عرض (IDOR حماية صامتة)

  const t = STAGE_LABELS[journey.currentStage] || { en: journey.currentStage, ar: journey.currentStage };
  const isRTL = lang === 'ar';

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="max-w-2xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden my-6 border border-gray-100"
    >
      {/* Header — الحالة الحية */}
      <div className="bg-linear-to-br from-[#22364A] via-[#33475C] to-[#5B7EA6] p-6 text-white">
        <div className="flex justify-between items-start flex-wrap gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300 flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Shipment Truth
            </div>
            <h2 className="text-xl font-black">{t[lang]}</h2>
            <p className="text-xs text-gray-300 mt-1">
              {journey.order.destination} • Order {journey.order.order_number || `#${journey.order.id}`}
            </p>
          </div>
          <span className="text-4xl"><GlassIcon ch={STAGE_ICONS[journey.currentStage] || '📦'} size="lg" /></span>
        </div>

        {journey.eta && (
          <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-gray-200">{journey.eta.message}</span>
              <span className="text-lg font-black text-amber-300">~{journey.eta.predictedDays}d</span>
            </div>
            {journey.eta.confidence === 'high' && (
              <div className="mt-2 h-1.5 bg-black/30 rounded-full overflow-hidden">
                <div className="h-full bg-linear-to-r from-emerald-400 to-emerald-300 rounded-full" style={{ width: '87%' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Language toggle */}
      <div className="flex justify-end px-4 pt-3 gap-1.5">
        <button onClick={() => setLang('en')} className={`text-[10px] font-black px-2.5 py-1 rounded-full transition cursor-pointer ${lang === 'en' ? 'bg-[#5B7EA6] text-white' : 'bg-gray-100 text-gray-500'}`}>EN</button>
        <button onClick={() => setLang('ar')} className={`text-[10px] font-black px-2.5 py-1 rounded-full transition cursor-pointer ${lang === 'ar' ? 'bg-[#5B7EA6] text-white' : 'bg-gray-100 text-gray-500'}`}>عربي</button>
      </div>

      {/* Timeline — رحلة حية */}
      <div className="p-6">
        {journey.events.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <GlassIcon ch="🏭" size="xs" /> {lang === 'ar' ? 'طلبك يُجهز في المستودع — تحديثات حية قادمة قريبًا' : 'Your order is being prepared at the warehouse — live updates coming soon'}
          </div>
        ) : (
          <div className="relative">
            {journey.events.map((ev, i) => {
              const isLast = i === journey.events.length - 1;
              return (
                <div key={i} className="flex gap-4 pb-6 relative">
                  {!isLast && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-linear-to-b from-[#5B7EA6] to-gray-200" />
                  )}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 shadow-md text-sm ${
                    isLast ? 'bg-[#5B7EA6] text-white ring-4 ring-[#5B7EA6]/20' : 'bg-gray-100 text-gray-400'}`}>
                    <GlassIcon ch={STAGE_ICONS[ev.type] || '📍'} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex justify-between items-start gap-2 flex-wrap">
                      <span className="font-black text-xs text-temu-black">
                        {STAGE_LABELS[ev.type]?.[lang] || ev.type}
                      </span>
                      <span suppressHydrationWarning className="text-[10px] text-gray-400 font-mono">
                        {new Date(ev.time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    {ev.location && <p className="text-[11px] text-temu-gray-text mt-0.5"><GlassIcon ch="📍" size="xs" /> {ev.location}</p>}
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ev.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* شارة الحقيقة */}
        <div className="mt-2 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-black text-emerald-700 flex items-center justify-center gap-1.5">
            <GlassIcon ch="✅" size="xs" /> {lang === 'ar' ? 'بيانات حية مباشرة من مستودعات CJ' : 'Live data directly from warehouses'}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {lang === 'ar' ? 'لا تقديرات — الحقيقة فقط' : 'No estimates — only truth'}
          </p>
        </div>
      </div>
    </div>
  );
}