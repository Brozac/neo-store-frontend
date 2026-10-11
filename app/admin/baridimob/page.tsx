'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';

interface Order {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  shipping_address?: string;
  total_amount: number;
  status: string;
  receipt_url: string;
  created_at: string;
}

export default function BaridiMobOrdersAdmin() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await adminApi.get('/admin/manual-orders');
      setOrders(res.data);
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // ═══ 🆕 v2 — Verification إجباري: الأدمن كيدخل المبلغ الفعلي من الـ receipt ═══
  // الـ backend كيسجل BARIDIMOB_VERIFIED في system_events (declared vs actual) — audit trail كامل
  const handleApprove = async (id: number, declared: number) => {
    const input = window.prompt(
      `⚠️ VERIFICATION REQUIRED — Order #${id}\n\n` +
      `Declared total: ${declared.toLocaleString()} DZD\n\n` +
      `Open the receipt, verify the transfer, then enter the amount ACTUALLY received (DZD):`
    );
    if (input === null) return; // cancel
    const verified = parseFloat(input.replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(verified) || verified <= 0) {
      alert('❌ Invalid amount — approval aborted.');
      return;
    }

    const mismatch = Math.abs(verified - declared) > 1;
    if (mismatch) {
      const proceed = window.confirm(
        `⚠️ AMOUNT MISMATCH — Order #${id}\n\n` +
        `Declared:  ${declared.toLocaleString()} DZD\n` +
        `Received:  ${verified.toLocaleString()} DZD\n` +
        `Gap:       ${(declared - verified).toLocaleString()} DZD\n\n` +
        `Approve anyway? (partial/over payment will be recorded in the audit trail)`
      );
      if (!proceed) return;
    }

    setActionLoading(id);
    try {
      const res = await adminApi.put(`/admin/manual-orders/approve/${id}`, {
        verified_amount: verified,
        declared_amount: declared,
        mismatch: mismatch,
      });
      alert(`✅ ${res.data.message || `Order #${id} approved — dispatching to CJ in background.`}`);
      fetchOrders();
    } catch (error: any) {
      alert(`❌ Approval failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ═══ 🆕 v2 — Reject بسبب إجباري (audit trail) ═══
  const handleReject = async (id: number) => {
    const reason = window.prompt(
      `Reject Order #${id}?\n\nReason (required — recorded in audit trail):`
    );
    if (reason === null) return; // cancel
    if (!reason.trim()) {
      alert('❌ A rejection reason is required.');
      return;
    }
    if (!confirm(`Confirm: Order #${id} will be CANCELLED?\nReason: ${reason.trim()}`)) return;

    setActionLoading(id);
    try {
      await adminApi.put(`/admin/manual-orders/reject/${id}`, { reason: reason.trim() });
      alert(`✅ Order #${id} rejected — reason recorded.`);
      fetchOrders();
    } catch (error: any) {
      alert(`❌ Rejection failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-3 border-temu-error border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-gray-500">Loading BaridiMob verification queue...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-temu-offwhite text-temu-black p-6 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Navigation */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <button
            onClick={() => router.push('/admin')}
            className="text-xs font-bold text-temu-orange hover:brightness-110 transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            &larr; Back to Mission Control
          </button>

          <span className="text-xs font-mono text-gray-500">
            Algeria Gateway &bull; BaridiMob / CCP
          </span>
        </div>

        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-temu-black tracking-wide flex items-center gap-2.5">
              <span>🇩🇿</span> BaridiMob Manual Verification
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Inspect uploaded bank transfer receipts, verify customer amounts, and dispatch orders to CJ.
              <strong className="text-amber-600"> Every approval requires the verified amount.</strong>
            </p>
          </div>

          <button
            onClick={fetchOrders}
            className="text-xs bg-white hover:bg-gray-50 text-temu-black px-3.5 py-2 rounded-xl border border-gray-200 transition active:scale-95 shadow-sm"
          >
            🔄 Refresh Receipts
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-gray-500 text-sm">No BaridiMob orders awaiting review at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const declaredDZD = Number(order.total_amount) || 0;

              return (
                <div
                  key={order.id}
                  className={`bg-white border rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition ${
                    order.status === 'pending' ? 'border-temu-error/40' : 'border-gray-200'
                  }`}
                >
                  {/* Order & Customer Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-black text-temu-black text-base">Order #{order.id}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        order.status === 'pending'
                          ? 'bg-amber-50 text-amber-600 border border-amber-200'
                          : order.status === 'paid' || order.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-red-50 text-red-500 border border-red-200'
                      }`}>
                        {order.status === 'pending' ? 'Pending Review' : order.status}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 pt-1">
                      <p><span className="text-gray-400 font-bold uppercase">Customer:</span> {order.customer_name || 'N/A'}</p>

                      {/* Phone with Direct Contact Link */}
                      <p className="flex items-center gap-2">
                        <span className="text-gray-400 font-bold uppercase">Phone:</span>
                        {order.customer_phone ? (
                          <>
                            <a href={`tel:${order.customer_phone}`} className="text-temu-orange hover:underline font-mono font-bold">
                              {order.customer_phone}
                            </a>
                            <a
                              href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded hover:bg-emerald-100 border border-emerald-200"
                            >
                              WhatsApp ↗
                            </a>
                          </>
                        ) : 'N/A'}
                      </p>

                      <p><span className="text-gray-400 font-bold uppercase">Declared Total:</span> <span className="text-temu-error font-black text-sm">{declaredDZD.toLocaleString()} DZD</span></p>
                      <p><span className="text-gray-400 font-bold uppercase">Email:</span> {order.customer_email || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap shrink-0 w-full lg:w-auto">
                    {order.receipt_url && (
                      <button
                        onClick={() => setSelectedReceipt(order.receipt_url)}
                        className="bg-temu-offwhite hover:bg-gray-100 text-temu-black px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 flex items-center gap-1.5 border border-gray-200"
                      >
                        📄 View Receipt
                      </button>
                    )}

                    {order.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(order.id, declaredDZD)}
                          disabled={actionLoading === order.id}
                          className="flex-1 lg:flex-none bg-linear-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-white px-5 py-3 rounded-xl text-xs font-extrabold transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                        >
                          {actionLoading === order.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Processing...
                            </>
                          ) : (
                            '✓ Verify & Approve'
                          )}
                        </button>

                        <button
                          onClick={() => handleReject(order.id)}
                          disabled={actionLoading === order.id}
                          className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-Screen Receipt Inspection Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="bg-white border border-gray-200 p-5 rounded-2xl max-w-2xl w-full shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Customer Bank Transfer Voucher</span>
              <div className="flex items-center gap-3">
                <a
                  href={selectedReceipt}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-temu-orange hover:underline font-bold"
                >
                  Open Full Resolution ↗
                </a>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="text-gray-400 hover:text-temu-black p-1 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center p-2">
              <img
                src={selectedReceipt}
                alt="Payment Receipt"
                className="w-auto max-h-[70vh] object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}