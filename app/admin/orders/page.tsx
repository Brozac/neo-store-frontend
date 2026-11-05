'use client';

/**
 * ═══════════════════════════════════════════════════════════════════
 * 📦 LACLARC ORDERS HUB — مركز الطلبات الموحد (OpCenter v2)
 * ═══════════════════════════════════════════════════════════════════
 * كل شيء عن الطلبات في صفحة واحدة:
 *   1. أطابور الأعمال المعلقة (BaridiMob / Failed / Disputes) بعدادات حية
 *   2. رادار الشحن — تتبع أي parcel عند الناقل (GET /admin/track/:id)
 *   3. مفتش بنود الطلب — عرض محتوى أي طلب (GET /orders/:id/items?email=)
 * ملاحظة: /orders/:id/items كيطلب الإيميل (حماية IDOR من الباك — M#49)
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';
import AdminShell from '../_shell/AdminShell';

interface TrackingInfo {
  trackingNumber: string;
  logisticName: string;
  trackingStatus: string;
  deliveryTime?: string;
  lastMileCarrier?: string;
}

interface OrderItem {
  id?: number | string;
  product_title?: string;
  title?: string;
  quantity?: number;
  price?: number | string;
  image_url?: string;
  image?: string;
  [key: string]: any;
}

export default function OrdersHubPage() {
  const router = useRouter();

  // ─── Queue telemetry ───
  const [queues, setQueues] = useState<{ baridi: number | null; failed: number | null; disputes: number | null }>({
    baridi: null, failed: null, disputes: null,
  });
  const [queuesLoading, setQueuesLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState('--');

  const loadQueues = useCallback(async () => {
    setQueuesLoading(true);
    const [baridiRes, failedRes, disputesRes] = await Promise.all([
      adminApi.get('/admin/manual-orders').then(r => r.data).catch(() => null),
      adminApi.get('/admin/failed-orders').then(r => r.data).catch(() => null),
      adminApi.get('/admin/disputes').then(r => r.data).catch(() => null),
    ]);
    const dList = disputesRes?.data?.list ?? (Array.isArray(disputesRes?.data) ? disputesRes.data : null);
    setQueues({
      baridi: Array.isArray(baridiRes) ? baridiRes.filter((o: any) => o.status === 'pending').length : null,
      failed: Array.isArray(failedRes) ? failedRes.length : null,
      disputes: Array.isArray(dList)
        ? dList.filter((d: any) => {
            const s = String(d.status || '').toLowerCase();
            return s === 'processing' || s === 'pending' || s === 'open';
          }).length
        : null,
    });
    setLastChecked(new Date().toLocaleTimeString());
    setQueuesLoading(false);
  }, []);

  useEffect(() => { loadQueues(); }, [loadQueues]);

  // ─── Logistics Radar ───
  const [trackNumber, setTrackNumber] = useState('');
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNumber.trim()) return;
    setTrackLoading(true);
    setTrackError('');
    setTrackingInfo(null);
    try {
      const res = await adminApi.get(`/admin/track/${encodeURIComponent(trackNumber.trim())}`);
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        setTrackingInfo(data[0]);
      } else if (data && typeof data === 'object' && data.trackingNumber) {
        setTrackingInfo(data);
      } else {
        setTrackError(data?.error || 'No active tracking milestones returned for this carrier identifier.');
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) { router.push('/admin/login'); return; }
      setTrackError(err.response?.data?.error || 'Failed to query CJ logistics network.');
    } finally {
      setTrackLoading(false);
    }
  };

  // ─── Order Items Inspector ───
  const [inspectId, setInspectId] = useState('');
  const [inspectEmail, setInspectEmail] = useState('');
  const [inspectItems, setInspectItems] = useState<OrderItem[] | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState('');

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = inspectId.trim();
    const email = inspectEmail.trim();
    if (!id || !email) {
      setInspectError('Order ID and customer email are both required (IDOR protection).');
      return;
    }
    setInspectLoading(true);
    setInspectError('');
    setInspectItems(null);
    try {
      const res = await adminApi.get(`/orders/${encodeURIComponent(id)}/items?email=${encodeURIComponent(email)}`);
      const data = res.data;
      if (Array.isArray(data)) {
        setInspectItems(data);
      } else if (Array.isArray(data?.items)) {
        setInspectItems(data.items);
      } else if (data && typeof data === 'object') {
        // كائن واحد — نلفه
        setInspectItems([data]);
      } else {
        setInspectError('Unexpected response shape — order may not exist.');
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) { router.push('/admin/login'); return; }
      setInspectError(err.response?.data?.error || `Lookup failed (${err.response?.status || 'network'}) — verify Order ID + email pair.`);
    } finally {
      setInspectLoading(false);
    }
  };

  const queueCards = [
    {
      id: 'baridi', href: '/admin/baridimob', icon: '🇩🇿', title: 'BaridiMob Verification',
      ar: 'التحقق من إيصالات باريديموب', count: queues.baridi,
      actionLabel: 'Verify receipts',
      hot: (queues.baridi ?? 0) > 0,
      tone: '#C86F4E',
    },
    {
      id: 'failed', href: '/admin/failed-orders', icon: '🚨', title: 'Failed in CJ',
      ar: 'طلبات فشل التجهيز الآلي', count: queues.failed,
      actionLabel: 'Rescue orders',
      hot: (queues.failed ?? 0) > 0,
      tone: '#DC2626',
    },
    {
      id: 'disputes', href: '/admin/disputes', icon: '⚖️', title: 'CJ Disputes',
      ar: 'نزاعات وتحكيم CJ', count: queues.disputes,
      actionLabel: 'Arbitrate claims',
      hot: (queues.disputes ?? 0) > 0,
      tone: '#D97706',
    },
  ];

  return (
    <AdminShell
      title="Orders Hub — مركز الطلبات"
      subtitle="Unified queues · logistics radar · item inspector"
    >
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ═══ 1. Queue Overview ═══ */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-black text-temu-black">Pending Operations</h2>
            <p className="text-xs text-gray-500">Live state of the three action queues</p>
          </div>
          <button
            onClick={loadQueues}
            disabled={queuesLoading}
            className="text-xs bg-white hover:bg-gray-100 text-temu-black px-3 py-1.5 rounded-lg border border-temu-gray-border-light transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {queuesLoading ? <div className="w-3.5 h-3.5 border-2 border-[#5F8271] border-t-transparent rounded-full animate-spin"></div> : '🔄'}{' '}
            <span suppressHydrationWarning>Refresh ({lastChecked})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {queueCards.map(q => (
            <button
              key={q.id}
              onClick={() => router.push(q.href)}
              className={`text-left p-5 rounded-2xl border transition cursor-pointer active:scale-[0.98] shadow-xs hover:shadow-md ${
                q.hot ? 'bg-white' : 'bg-white'
              }`}
              style={{ borderColor: q.hot ? q.tone : undefined }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-temu-offwhite flex items-center justify-center text-lg">{q.icon}</div>
                {q.count !== null && q.count > 0 && (
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full animate-pulse" style={{ backgroundColor: `${q.tone}18`, color: q.tone }}>
                    Action needed
                  </span>
                )}
              </div>
              <p className="text-3xl font-black text-temu-black leading-none">
                {q.count === null ? <span className="text-gray-300">—</span> : q.count}
              </p>
              <h3 className="font-bold text-temu-black text-sm mt-2">{q.title}</h3>
              <p className="text-[11px] text-gray-500">{q.ar}</p>
              <p className="text-[11px] font-bold mt-2" style={{ color: q.tone }}>{q.actionLabel} &rarr;</p>
            </button>
          ))}
        </div>

        {/* ═══ 2. Logistics Radar ═══ */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-lg">📡</span>
            <h2 className="text-base font-black text-temu-black">Global Logistics Radar</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Direct tracking query against CJ Packet, YunExpress, 4PX, and USPS networks</p>

          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={trackNumber}
              onChange={(e) => setTrackNumber(e.target.value)}
              placeholder="Enter CJ or Carrier Tracking Number (e.g. CJPKL24090123...)"
              className="flex-1 bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-[#5F8271] transition"
            />
            <button
              type="submit"
              disabled={trackLoading}
              className="bg-linear-to-r from-[#5F8271] to-[#4E6F60] hover:brightness-110 text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 cursor-pointer active:scale-95 shadow-md flex justify-center items-center gap-2 text-xs uppercase tracking-wider"
            >
              {trackLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Track Parcel'}
            </button>
          </form>

          {trackError && (
            <div className="bg-red-50 border border-red-200 text-red-500 p-3.5 rounded-xl text-xs font-medium">
              {trackError}
            </div>
          )}

          {trackingInfo && (
            <div className="bg-temu-offwhite p-5 rounded-xl border border-emerald-200 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Status</span>
                  <span className="font-black text-emerald-600 text-sm bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                    {trackingInfo.trackingStatus || 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Primary Carrier</span>
                  <span className="font-bold text-temu-black text-sm">{trackingInfo.logisticName || 'CJ Packet'}</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Waybill Number</span>
                  <span className="font-mono text-gray-700 font-bold">{trackingInfo.trackingNumber}</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Last-Mile Agent</span>
                  <span className="font-bold text-temu-black text-sm">{trackingInfo.lastMileCarrier || 'Local Postal Partner'}</span>
                </div>
              </div>
              {trackingInfo.deliveryTime && (
                <div className="mt-3 pt-3 border-t border-temu-gray-border-light text-xs text-gray-500">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Estimated Delivery: </span>
                  <span className="text-temu-black font-mono">{trackingInfo.deliveryTime}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ 3. Order Items Inspector ═══ */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-lg">🔍</span>
            <h2 className="text-base font-black text-temu-black">Order Items Inspector</h2>
          </div>
          <p className="text-xs text-gray-500 mb-1">Open any order and inspect its exact contents — customer email required by design (IDOR guard, M#49)</p>
          <p className="text-[11px] text-gray-400 mb-4">💡 Tip: copy the customer email from any queue card above, then paste it here with the order ID.</p>

          <form onSubmit={handleInspect} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-4">
            <input
              type="text"
              value={inspectId}
              onChange={(e) => setInspectId(e.target.value)}
              placeholder="Order ID or order number (e.g. 89 / LC-2026-00091)"
              className="bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-[#5F8271] transition"
            />
            <input
              type="email"
              value={inspectEmail}
              onChange={(e) => setInspectEmail(e.target.value)}
              placeholder="Customer email (required)"
              className="bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-[#5F8271] transition"
            />
            <button
              type="submit"
              disabled={inspectLoading}
              className="bg-temu-black hover:bg-temu-dark text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 cursor-pointer active:scale-95 text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              {inspectLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Inspect'}
            </button>
          </form>

          {inspectError && (
            <div className="bg-red-50 border border-red-200 text-red-500 p-3.5 rounded-xl text-xs font-medium">
              {inspectError}
            </div>
          )}

          {inspectItems && inspectItems.length === 0 && (
            <div className="bg-temu-offwhite p-5 rounded-xl border border-dashed border-temu-gray-border-light text-xs text-gray-500 text-center">
              Order found — but it contains no line items (edge case worth investigating).
            </div>
          )}

          {inspectItems && inspectItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                {inspectItems.length} item{inspectItems.length > 1 ? 's' : ''} in this order
              </p>
              {inspectItems.map((item, idx) => (
                <div key={item.id ?? idx} className="p-3.5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-white border border-temu-gray-border-light overflow-hidden shrink-0 flex items-center justify-center">
                    {(item.image_url || item.image) ? (
                      <img src={item.image_url || item.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : (
                      <span className="text-gray-300 text-lg">📦</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-temu-black truncate">{item.product_title || item.title || `Item #${item.id ?? idx + 1}`}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {item.quantity ? `Qty ${item.quantity}` : 'Qty 1'}
                      {item.price !== undefined && item.price !== null && ` · $${Number(item.price).toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AdminShell>
  );
}
