'use client';
import { useState } from 'react';
import Link from 'next/link';

interface TrackingEvent {
  date?: string;
  status?: string;
  description?: string;
  location?: string;
}

interface TrackingInfo {
  trackingNumber?: string;
  logisticName?: string;
  trackingStatus?: string;
  deliveryTime?: string;
}

export default function TrackPage() {
  const [trackNum, setTrackNum] = useState('');
  const [info, setInfo] = useState<TrackingInfo | null>(null);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ✨ Tenet #4 — بلا hardcoded URLs أبداً
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = trackNum.trim();
    if (!num) return;

    setLoading(true); setError(''); setInfo(null); setEvents([]);
    try {
      const res = await fetch(`${API_BASE_URL}/api/track/${encodeURIComponent(num)}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Tracking number not found.');
        return;
      }

      // ✨ دفاعي: CJ كيرجع object، بعض الحالات array — كنعالجو بجوج الأشكال
      const payload = Array.isArray(data) ? data[0] : data;

      if (!payload || (!payload.trackingStatus && !payload.tracking_number && !payload.trackingNumber)) {
        setError('No live tracking data available for this number yet. Try again in a few hours.');
        return;
      }

      // ✨ CJ camelCase أو snake_case — كنطبعو بالحالتين
      setInfo({
        trackingNumber: payload.trackingNumber || payload.tracking_number || num,
        logisticName: payload.logisticName || payload.logistic_name || 'Global Carrier',
        trackingStatus: payload.trackingStatus || payload.tracking_status || 'In Transit',
        deliveryTime: payload.deliveryTime || payload.delivery_time || 'N/A',
      });

      // ✨ الأحداث الحية من CJ — الخط الزمني الكامل
      const detail = payload.tracking_detail || payload.trackingDetail || payload.events || [];
      if (Array.isArray(detail)) {
        setEvents(detail.slice(0, 15));
      }
    } catch {
      setError('Unable to reach the logistics network. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-4 sm:p-6 flex items-center justify-center font-sans pb-28">

      <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light max-w-lg w-full shadow-sm">
        <h1 className="text-2xl font-extrabold text-temu-black mb-6 text-center flex items-center justify-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-temu-orange">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Track Your Order
        </h1>

        {/* ✨ تتراص عمودياً على الهواتف الصغيرة جداً */}
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={trackNum}
            onChange={(e) => setTrackNum(e.target.value)}
            placeholder="Enter Tracking Number"
            aria-label="Tracking number"
            className="flex-1 min-w-0 bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange transition"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition disabled:opacity-50 active:scale-95 touch-manipulation cursor-pointer flex justify-center items-center gap-2 shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : 'Track'}
          </button>
        </form>

        {/* ✨ ربط متبادل مع التتبع بالـ Order ID */}
        <p className="text-[11px] text-temu-gray-light text-center mb-6 font-medium">
          Don&apos;t have your tracking number?{' '}
          <Link href="/track-order" className="text-temu-orange font-bold hover:underline">
            Track by Order ID →
          </Link>
        </p>

        {error && (
          <p className="text-temu-error text-sm text-center bg-red-50 p-3 rounded-temu-sm font-medium">{error}</p>
        )}

        {info && (
          <div className="bg-temu-green-light/10 p-6 rounded-temu-sm border border-temu-green/20">
            {/* الحالة العامة */}
            <p className="text-lg font-bold text-temu-green mb-4 text-center flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {info.trackingStatus}
            </p>

            <div className="grid grid-cols-2 gap-4 text-sm text-temu-black">
              <p>
                <span className="text-temu-gray-text text-xs block mb-1">Carrier</span>
                {info.logisticName}
              </p>
              <p>
                <span className="text-temu-gray-text text-xs block mb-1">Tracking No.</span>
                <span className="font-mono break-all">{info.trackingNumber}</span>
              </p>
              <p className="col-span-2">
                <span className="text-temu-gray-text text-xs block mb-1">Estimated Delivery</span>
                {info.deliveryTime || 'N/A'}
              </p>
            </div>

            {/* ✨ الخط الزمني الحي من CJ (Scanned → In Transit → Delivered) */}
            {events.length > 0 && (
              <div className="mt-5 border-t border-temu-green/15 pt-4">
                <p className="text-[10px] font-black uppercase text-temu-gray-text mb-3 tracking-wider">
                  📡 Live Carrier Events
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-hide">
                  {events.map((ev, i) => (
                    <div key={i} className="flex gap-2.5 text-xs bg-white/80 rounded-lg p-2.5 border border-temu-gray-border-light">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${i === 0 ? 'bg-emerald-500' : 'bg-temu-orange/50'}`}></span>
                      <div className="min-w-0">
                        <p className="font-bold text-temu-black">{ev.status || ev.description || 'Update'}</p>
                        {(ev.location || ev.description) && (
                          <p className="text-temu-gray-text truncate">{[ev.location, ev.description !== ev.status ? ev.description : null].filter(Boolean).join(' • ')}</p>
                        )}
                        {ev.date && (
                          <p className="text-temu-gray-light font-mono text-[10px]">
                            {new Date(ev.date).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}