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

  const handleApprove = async (id: number) => {
    if (!confirm(`Verify receipt & approve Order #${id}? This will dispatch the order to CJ Dropshipping.`)) return;
    setActionLoading(id);
    try {
      const res = await adminApi.put(`/admin/manual-orders/approve/${id}`);
      alert(`✅ ${res.data.message || 'Order approved! Dispatching to CJ in background.'}`);
      fetchOrders(); 
    } catch (error: any) {
      alert(`❌ Approval failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm(`Are you sure you want to reject Order #${id}?`)) return;
    setActionLoading(id);
    try {
      await adminApi.put(`/admin/manual-orders/reject/${id}`);
      alert(`✅ Order #${id} marked as cancelled.`);
      fetchOrders(); 
    } catch (error: any) {
      alert(`❌ Rejection failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1020] flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#FF6B9D] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-gray-400">Loading BaridiMob verification queue...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E1020] text-gray-200 p-6 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation */}
        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <button 
            onClick={() => router.push('/admin')} 
            className="text-xs font-bold text-[#8B78C6] hover:text-[#9B88D6] transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            &larr; Back to Mission Control
          </button>
          
          <span className="text-xs font-mono text-gray-400">
            Algeria Gateway &bull; BaridiMob / CCP
          </span>
        </div>
        
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
              <span>🇩🇿</span> BaridiMob Manual Verification
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Inspect uploaded bank transfer receipts, verify customer amounts, and dispatch orders to CJ.
            </p>
          </div>

          <button 
            onClick={fetchOrders}
            className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3.5 py-2 rounded-xl border border-white/10 transition active:scale-95"
          >
            🔄 Refresh Receipts
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-[#181B34] border border-white/10 rounded-2xl p-12 text-center shadow-xl">
            <p className="text-gray-400 text-sm">No BaridiMob orders awaiting review at this time.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const declaredDZD = Number(order.total_amount) || 0;

              return (
                <div 
                  key={order.id} 
                  className={`bg-[#181B34] border rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 transition ${
                    order.status === 'pending' ? 'border-[#FF6B9D]/40' : 'border-white/10'
                  }`}
                >
                  {/* Order & Customer Info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-black text-white text-base">Order #{order.id}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        order.status === 'pending' 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                          : order.status === 'paid' || order.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {order.status === 'pending' ? 'Pending Review' : order.status}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
                      <p><span className="text-gray-500 font-bold uppercase">Customer:</span> {order.customer_name || 'N/A'}</p>
                      
                      {/* Phone with Direct Contact Link */}
                      <p className="flex items-center gap-2">
                        <span className="text-gray-500 font-bold uppercase">Phone:</span>
                        {order.customer_phone ? (
                          <>
                            <a href={`tel:${order.customer_phone}`} className="text-[#8B78C6] hover:underline font-mono font-bold">
                              {order.customer_phone}
                            </a>
                            <a 
                              href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded hover:bg-emerald-600/50"
                            >
                              WhatsApp ↗
                            </a>
                          </>
                        ) : 'N/A'}
                      </p>

                      <p><span className="text-gray-500 font-bold uppercase">Declared Total:</span> <span className="text-[#FF6B9D] font-black text-sm">{declaredDZD.toLocaleString()} DZD</span></p>
                      <p><span className="text-gray-500 font-bold uppercase">Email:</span> {order.customer_email || 'N/A'}</p>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap shrink-0 w-full lg:w-auto">
                    {order.receipt_url && (
                      <button 
                        onClick={() => setSelectedReceipt(order.receipt_url)}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 flex items-center gap-1.5"
                      >
                        📄 View Receipt
                      </button>
                    )}

                    {order.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleApprove(order.id)}
                          disabled={actionLoading === order.id}
                          className="flex-1 lg:flex-none bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white px-5 py-3 rounded-xl text-xs font-extrabold transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                        >
                          {actionLoading === order.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Processing...
                            </>
                          ) : (
                            'Approve & Send to CJ'
                          )}
                        </button>

                        <button 
                          onClick={() => handleReject(order.id)}
                          disabled={actionLoading === order.id}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
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
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4" 
          onClick={() => setSelectedReceipt(null)}
        >
          <div 
            className="bg-[#181B34] border border-white/20 p-5 rounded-2xl max-w-2xl w-full shadow-2xl relative" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">Customer Bank Transfer Voucher</span>
              <div className="flex items-center gap-3">
                <a 
                  href={selectedReceipt} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-[#8B78C6] hover:underline font-bold"
                >
                  Open Full Resolution ↗
                </a>
                <button 
                  onClick={() => setSelectedReceipt(null)} 
                  className="text-gray-400 hover:text-white p-1 text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="max-h-[75vh] overflow-y-auto rounded-xl bg-black/50 border border-white/10 flex items-center justify-center p-2">
              <img 
                src={selectedReceipt} 
                alt="Payment Receipt" 
                className="w-auto max-h-[70vh] object-contain rounded-lg shadow" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}