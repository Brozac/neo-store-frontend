'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ShipTruthJourney from '@/components/ShipTruthJourney';
import GlassIcon from '@/components/ui/GlassIcon';

interface TrackedOrder {
  id: number;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total_amount: string | number;
  status: string;
  created_at?: string;
  tracking_number?: string;
  order_number?: string;
}

interface TrackingEvent {
  date?: string;
  status?: string;
  details?: string;
  location?: string;
}

// ✨ Section 10 — نفس فلسفة translateStatus ديال bot.js:
// الحالات الداخلية التقنية → لغة ودية + تلوين + مرحلة الـ Stepper
type Tone = 'good' | 'warn' | 'bad' | 'info';
const STATUS_MAP: Record<string, { label: string; tone: Tone; step: number }> = {
  pending:            { label: 'Awaiting Payment',     tone: 'warn', step: 0 },
  reconciling:        { label: 'Finalizing Payment',   tone: 'warn', step: 1 },
  paid:               { label: 'Payment Confirmed',    tone: 'good', step: 2 },   // 🩹 v1.1 — 75% صادق (الدفع مكتمل — الباقي CJ)
  manual:             { label: 'Under Review',         tone: 'warn', step: 1 },
  processing:         { label: 'Processing',           tone: 'info', step: 1 },  // 🩹
  awaiting_exchange:  { label: 'Alternative Offered — Check Email', tone: 'info', step: 1 },  // 🩹
  refunded:           { label: 'Refunded',             tone: 'info', step: 0 },  // 🩹
  archived:           { label: 'Archived',             tone: 'info', step: 0 },  // 🩹
  completed:          { label: 'In Production',        tone: 'good', step: 2 },
  fulfilled:          { label: 'Shipped — In Transit', tone: 'good', step: 3 },
  expired:            { label: 'Expired',              tone: 'bad',  step: 0 },
  cancelled:          { label: 'Cancelled',            tone: 'bad',  step: 0 },
};

// ✨ وعدّل الدالة لتستقبل الـ label الجاهز:
const getStatusInfo = (status?: string, serverLabel?: string) => {
  const key = (status || 'pending').toLowerCase();
  // 🩹 M#29 — الباكند أرسل status_label جاهزاً → استعمله مباشرة (مصدر الحقيقة)
  if (serverLabel) {
    // استنتج اللون من محتوى الـ label (رموز تعرفها)
    const tone: Tone = serverLabel.includes('💰') ? 'info'
                     : serverLabel.includes('⏳') ? 'warn'
                     : serverLabel.includes('❌') || serverLabel.includes('⏱') ? 'bad'
                     : 'good';
    return { label: serverLabel, tone, step: key === 'awaiting_exchange' ? 1 : STATUS_MAP[key]?.step ?? 1 };
  }
  return STATUS_MAP[key] || { label: (status || 'Processing'), tone: 'info' as Tone, step: 1 };
};

const TONE_CLASSES: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  bad:  'bg-coral-50 text-coral-700 border-coral-200',
  info: 'bg-fog-50 text-[#6B3DB4] border-fog-200',
};

// ✨ عرض التقدم حسب المرحلة الحقيقية — الطلبات الملغاة كيبانو 0%
const STEP_WIDTH = ['8%', '45%', '75%', '100%'];

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get('orderId') || '';
  const initialEmail = searchParams.get('email') || '';

  const [orderId, setOrderId] = useState(initialOrderId);
  const [email, setEmail] = useState(initialEmail);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // ✨ الأحداث الحية من CJ — جاية من /api/track/:trackNumber الموجودة أصلاً
  const [liveEvents, setLiveEvents] = useState<Record<number, TrackingEvent[]>>({});
  const [eventsLoading, setEventsLoading] = useState<number | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const executeTrack = useCallback(async (targetId: string, targetEmail: string) => {
    if (!targetId.trim() || !targetEmail.trim()) {
      setError('Please provide both your Order ID and Account Email to verify shipment ownership.');
      return;
    }

    setLoading(true);
    setError('');
    setOrders([]);
    setLiveEvents({});

    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/track/${encodeURIComponent(targetId.trim())}?email=${encodeURIComponent(targetEmail.trim().toLowerCase())}`);
      const data = await res.json();

      if (res.ok) {
        if (Array.isArray(data) && data.length > 0) {
          try { sessionStorage.setItem('laclarc_last_track_email', targetEmail.trim().toLowerCase()); } catch {}
          setOrders(data);
        } else {
          setError('No orders found matching this Order ID and Email combination.');
        }
      } else {
        setError(data.error || 'Unable to locate order with provided credentials.');
      }
    } catch {
      setError('Unable to reach global logistics server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL]);

  // فحص تلقائي إذا جاء الزبون برابط مباشر (من الإيميل أو واتساب)
  useEffect(() => {
    if (initialOrderId && initialEmail) {
      executeTrack(initialOrderId, initialEmail);
    }
  }, [initialOrderId, initialEmail, executeTrack]);

  // 🩹 v1.1 — auto-fill email من الحساب المسجل (أو last used)
  useEffect(() => {
    if (!email) {
      try {
        const saved = localStorage.getItem('laclarc_user_email') ||
                      sessionStorage.getItem('laclarc_last_track_email');
        if (saved) setEmail(saved);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✨ جلب الأحداث الحية تلقائياً لكل طلب عندو رقم تتبع
  useEffect(() => {
    const fulfilled = orders.filter(
      (o) => o.tracking_number && o.tracking_number.trim().length > 3
    );
    fulfilled.forEach((o) => fetchLiveTracking(o.id, o.tracking_number!.trim()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const fetchLiveTracking = async (orderId: number, trackNumber: string) => {
    setEventsLoading(orderId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/track/${encodeURIComponent(trackNumber)}`);
      if (!res.ok) return;
      const data = await res.json();
      // ✨ CJ كيرجع أشكال مختلفة — كنتجاوزو دفاعياً
      const events: TrackingEvent[] =
        data?.trackingInfo || data?.events || data?.list || [];
      if (Array.isArray(events) && events.length > 0) {
        setLiveEvents((prev) => ({ ...prev, [orderId]: events }));
      }
    } catch {
      // الأحداث الحية اختيارية — الصفحة كتخدم بلاهم
    } finally {
      setEventsLoading(null);
    }
  };

  const copyTracking = async (orderId: number, num: string) => {
    try {
      await navigator.clipboard.writeText(num);
      setCopiedId(orderId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTrack(orderId, email);
  };

  // ✨ فك العنوان البشري النظيف بدلاً من إظهار JSON مشوه
  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    try {
      const parsed = JSON.parse(address);
      return [parsed.line1, parsed.city, parsed.state, parsed.postal_code, parsed.country].filter(Boolean).join(', ');
    } catch {
      return address;
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-4 sm:p-6 max-w-lg mx-auto pb-24 font-sans">

      {/* Header */}
      <div className="text-center mb-6 pt-4">
        <div className="w-14 h-14 bg-fog-100 text-[#6B3DB4] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm">
          <GlassIcon ch="📦" size="xs" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Track Your Shipment</h1>
        <p className="text-xs text-gray-500 mt-1">Enter your Order ID and the Email used during checkout</p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleTrackSubmit} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 mb-6">
        <div>
          <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">Order Identification Number *</label>
          <input
            type="text"
            placeholder="e.g. 1042"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
            className="w-full p-3 bg-gray-50 rounded-xl text-xs text-gray-900 outline-none border border-gray-200 focus:border-[#6B3DB4] transition"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">Account / Order Email *</label>
          <input
            type="email"
            placeholder="e.g. buyer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 bg-gray-50 rounded-xl text-xs text-gray-900 outline-none border border-gray-200 focus:border-[#6B3DB4] transition"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-linear-to-r from-[#6B3DB4] to-[#5B2F9E] hover:brightness-110 text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition shadow-md active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2 cursor-pointer mt-1 touch-manipulation"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Scan Logistics Status'
          )}
        </button>
      </form>

      {error && (
        <div className="text-coral-700 text-xs font-bold mb-6 bg-coral-50 border border-coral-200 p-3.5 rounded-xl text-center">
          <GlassIcon ch="⚠️" size="xs" /> {error}
        </div>
      )}

      {/* Results & Visual Stepper */}
      <div className="space-y-4">
        {orders.map((order) => {
          const safeTotal = Number(order.total_amount) || 0;
          const statusInfo = getStatusInfo(
            order.status,
            (order as any).status_label   // 🩹 M#29 — يأتي من الباكند
          );          
          const hasTracking = !!order.tracking_number && order.tracking_number.trim().length > 3;
          const events = liveEvents[order.id];

          return (
            <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">

              <div className="flex justify-between items-center border-b border-gray-100 pb-3 gap-2">
                <span className="text-xs font-black text-gray-900">Order {(order as any).order_number || `#${order.id}`}</span>
                {/* ✨ لغة ودية بدل الحالات التقنية الخام */}
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${TONE_CLASSES[statusInfo.tone]}`}>
                  {statusInfo.label}
                </span>
              </div>

              {/* Visual Logistics Stepper — المرحلة محسوبة من الحالة */}
              <div className="py-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-2">
                  <span className={statusInfo.step >= 1 ? 'text-[#6B3DB4]' : ''}>Confirmed</span>
                  <span className={statusInfo.step >= 2 ? 'text-[#6B3DB4]' : ''}>CJ Processing</span>
                  <span className={statusInfo.step >= 3 ? 'text-emerald-600 font-black' : ''}>Dispatched</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      statusInfo.tone === 'bad'
                        ? 'bg-coral-300'
                        : 'bg-linear-to-r from-[#6B3DB4] to-emerald-500'
                    }`}
                    style={{ width: statusInfo.tone === 'bad' ? '8%' : STEP_WIDTH[statusInfo.step] }}
                  ></div>
                </div>
              </div>

              {/* ✨ رقم التتبع — بطاقة بارزة مع النسخ والأحداث الحية */}
              {hasTracking && (
                <div className="bg-linear-to-br from-[#FBFAFE] to-fog-50 border border-[#6B3DB4]/25 rounded-xl p-3.5">
                  <div className="flex justify-between items-center gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-[#6B3DB4] block">Tracking Number</span>
                      <p className="font-mono font-bold text-xs text-gray-900 truncate">{order.tracking_number}</p>
                    </div>
                    <button
                      onClick={() => copyTracking(order.id, order.tracking_number!.trim())}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition active:scale-90 touch-manipulation ${
                        copiedId === order.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#17171A] text-white hover:bg-[#26262B]'
                      }`}
                    >
                      {copiedId === order.id ? 'Copied ✓' : 'Copy'}
                    </button>
                  </div>

                  {/* الأحداث الحية من CJ */}
                  {eventsLoading === order.id && (
                    <p className="text-[10px] text-gray-400 mt-2.5 animate-pulse"><GlassIcon ch="📡" size="xs" /> Loading live carrier events...</p>
                  )}
                  {events && events.length > 0 && (
                    <div className="mt-3 space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                      {events.slice(0, 10).map((ev, i) => (
                        <div key={i} className="flex gap-2.5 text-[10px] bg-white/80 rounded-lg p-2 border border-gray-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1"></span>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800">{ev.status || ev.details || 'Update'}</p>
                            {(ev.details || ev.location) && (
                              <p className="text-gray-500 truncate">{[ev.details, ev.location].filter(Boolean).join(' • ')}</p>
                            )}
                            {ev.date && (
                              <p className="text-gray-400 font-mono">{new Date(ev.date).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <p><span className="text-gray-400 uppercase text-[10px] font-bold block">Destination:</span> <strong className="text-gray-800">{formatAddress(order.shipping_address)}</strong></p>
                <p className="pt-1"><span className="text-gray-400 uppercase text-[10px] font-bold block">Total Billed:</span> <strong className="text-coral-600 font-black">${safeTotal.toFixed(2)}</strong></p>
              </div>

              {order.created_at && (
                <p suppressHydrationWarning className="text-[10px] text-gray-400 text-center font-mono">
                  Placed: {new Date(order.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
              {/* ✨ Ship Truth Engine — الرحلة الحية من الصين للباب */}
              {/* 🩹 v1.1 — Ship Truth حتى قبل الشحن: PROCESSING + ETA صادقون (Trust أعلى) */}
              {(hasTracking || order.status === 'paid') && (
                <ShipTruthJourney
                  orderId={order.id}
                  email={email}
                />
              )}
            </div>
            
          );
        })}
      </div>

    </main>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-[#6B3DB4] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}