'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';

interface Order {
  id: number;
  total_amount: number;
  status: string;
  payment_method: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: string;
  created_at: string;
}

export default function FailedOrdersAdmin() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await adminApi.get('/admin/failed-orders');
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
    if (!confirm(`Trigger background retry for Order #${id} to CJ Dropshipping?`)) return;
    setActionLoading(id);
    try {
      const res = await adminApi.put(`/admin/manual-orders/approve/${id}`);
      alert(`✅ ${res.data.message || 'Order fulfillment retry initiated in background!'}`);
      fetchOrders(); 
    } catch (error: any) {
      alert(`❌ Retry failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm(`Are you sure you want to cancel and mark Order #${id} as cancelled?`)) return;
    setActionLoading(id);
    try {
      await adminApi.put(`/admin/manual-orders/reject/${id}`);
      alert(`✅ Order #${id} has been cancelled.`);
      fetchOrders(); 
    } catch (error: any) {
      alert(`❌ Cancellation failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1020] flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-gray-400">Loading failed order queue...</p>
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
            Queue: {orders.length} Stalled Orders
          </span>
        </div>
        
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
              <span>🚨</span> Failed & Manual Orders Queue
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Paid orders that encountered errors during automated CJ Fulfillment (Warehouse conflict, API rate limit, or invalid address).
            </p>
          </div>

          <button 
            onClick={fetchOrders}
            className="text-xs bg-white/5 hover:bg-white/10 text-gray-300 px-3.5 py-2 rounded-xl border border-white/10 transition active:scale-95"
          >
            🔄 Refresh Queue
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-[#181B34] border border-white/10 rounded-2xl p-12 text-center shadow-xl">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto text-2xl mb-3">
              ✓
            </div>
            <h3 className="text-base font-bold text-white mb-1">Queue is 100% Clean!</h3>
            <p className="text-xs text-gray-400">All customer payments have been processed and dispatched to CJ Dropshipping successfully.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div 
                key={order.id} 
                className="bg-[#181B34] border border-red-500/30 rounded-2xl p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
              >
                {/* Order Diagnostics */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-black text-white text-base">Order #{order.id}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
                      Stalled in Fulfillment
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300 pt-1">
                    <p><span className="text-gray-500 font-bold uppercase">Customer:</span> {order.customer_name || 'Guest'}</p>
                    <p><span className="text-gray-500 font-bold uppercase">Email:</span> {order.customer_email || 'N/A'}</p>
                    <p><span className="text-gray-500 font-bold uppercase">Method:</span> <span className="font-mono text-[#8B78C6]">{order.payment_method}</span></p>
                    <p><span className="text-gray-500 font-bold uppercase">Total Paid:</span> <span className="text-[#FF6B9D] font-black">${Number(order.total_amount).toFixed(2)}</span></p>
                  </div>

                  {order.shipping_address && (
                    <div className="bg-[#0E1020] p-3 rounded-xl border border-white/5 text-xs text-gray-400 mt-2">
                      <span className="text-gray-500 font-bold uppercase text-[10px] block mb-0.5">Shipping Destination:</span>
                      <p className="truncate font-mono text-[11px] text-gray-300">{order.shipping_address}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap shrink-0 w-full lg:w-auto">
                  <button 
                    onClick={() => handleApprove(order.id)}
                    disabled={actionLoading === order.id}
                    className="flex-1 lg:flex-none bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white px-5 py-3 rounded-xl text-xs font-extrabold transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    {actionLoading === order.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Retrying with CJ...
                      </>
                    ) : (
                      '⚡ Retry Dispatch to CJ'
                    )}
                  </button>

                  <button 
                    onClick={() => handleReject(order.id)}
                    disabled={actionLoading === order.id}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}