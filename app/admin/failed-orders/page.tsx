'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
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
  halt_details?: {                  // 🩹 إضافة — سبب توقف CJ الرسمي
    reason: string;
    number?: string;
    probeStatus?: string;
    probeOrderNum?: string;
    probeMatched?: boolean;
  };
}

interface OrderItem {
  title: string;
  image_url: string;
  quantity: number;
  price_at_purchase: string | number;
  vid?: string;
}

// ✨ دالة آمنة لتحويل عنوان الـ JSON إلى نص مقروء
const formatAddress = (rawAddress?: string) => {
  if (!rawAddress) return 'N/A';
  try {
    const addr = typeof rawAddress === 'string' ? JSON.parse(rawAddress) : rawAddress;
    if (typeof addr === 'object' && addr !== null) {
      const formatted = [
        addr.line1, 
        addr.line2, 
        addr.city, 
        addr.state, 
        addr.postal_code, 
        addr.country
      ].filter(Boolean).join(', ');
      return formatted || rawAddress;
    }
    return rawAddress;
  } catch (e) {
    return rawAddress;
  }
};

export default function FailedOrdersAdmin() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // حالات نافذة استعراض منتجات الطلب العالق
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

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

  // جلب عناصر الطلب عند الضغط على View Items
  const handleViewItems = async (order: Order) => {
    setSelectedOrder(order);
    setIsItemsModalOpen(true);
    setLoadingItems(true);
    setOrderItems([]);

    try {
      const res = await adminApi.get(`/orders/${order.id}/items?email=${encodeURIComponent(order.customer_email || '')}`);
      if (Array.isArray(res.data)) {
        setOrderItems(res.data);
      }
    } catch (err) {
      console.error('Error fetching order items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleApprove = async (id: number) => {
    if (!confirm(`Trigger background retry for Order #${id} to CJ Dropshipping?`)) return;
    setActionLoading(id);
    try {
      const res = await adminApi.put(`/admin/retry-fulfillment/${id}`);
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
      alert(`✅ Order #${id} has been marked as cancelled.`);
      fetchOrders(); 
    } catch (error: any) {
      alert(`❌ Cancellation failed: ${error.response?.data?.error || 'Server error'}`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-gray-500">Scanning stalled order queue...</p>
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
            className="text-xs font-bold text-[#8B78C6] hover:text-[#7A67B5] transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            &larr; Back to Mission Control
          </button>
          
          <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm text-gray-600">
            Queue: {orders.length} Stalled Orders
          </span>
        </div>
        
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-black text-temu-black tracking-wide flex items-center gap-2.5">
              <span>🚨</span> Failed & Manual Orders Queue
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Paid orders that encountered errors during automated CJ Fulfillment (Warehouse conflict, API rate limit, or address/phone format issues).
            </p>
          </div>

          <button 
            onClick={fetchOrders}
            className="text-xs bg-white hover:bg-gray-50 text-temu-black font-bold px-4 py-2.5 rounded-xl border border-gray-200 transition active:scale-95 shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            🔄 Refresh Queue
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-sm space-y-3">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
              ✓
            </div>
            <h3 className="text-base font-bold text-temu-black">Queue is 100% Clean!</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">All paid orders have been dispatched to CJ Dropshipping successfully without any warehouse or logistics bottlenecks.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div 
                key={order.id} 
                className="bg-white border border-red-200 rounded-2xl p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 hover:shadow-md transition"
              >
                {/* Order Diagnostics */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-black text-temu-black text-base">Order #{order.id}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-500 border border-red-200">
                      Stalled in Fulfillment
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700 pt-1">
                    <p><span className="text-gray-400 font-bold uppercase text-[10px]">Customer:</span> {order.customer_name || 'Guest'}</p>
                    <p><span className="text-gray-400 font-bold uppercase text-[10px]">Email:</span> {order.customer_email || 'N/A'}</p>
                    
                    {/* ✨ إظهار رقم الهاتف مع تنبيه إذا كان مفقوداً لأن CJ تطلبه للشحن */}
                    <p>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Phone: </span>
                      {order.customer_phone ? (
                        <span className="font-mono font-bold text-gray-800">{order.customer_phone}</span>
                      ) : (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">⚠️ Missing Phone</span>
                      )}
                    </p>

                    <p><span className="text-gray-400 font-bold uppercase text-[10px]">Gateway:</span> <span className="font-mono font-bold text-[#8B78C6]">{order.payment_method}</span></p>
                    <p><span className="text-gray-400 font-bold uppercase text-[10px]">Total Paid:</span> <span className="text-temu-error font-black text-sm">${Number(order.total_amount).toFixed(2)}</span></p>
                  </div>
                                    {/* 🩹 M#31 — halt_details: سبب توقف CJ الرسمي (يظهر فقط للطلبات الموقوفة) */}
                  {order.halt_details && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2 space-y-1">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">🛑 CJ Halt Reason:</p>
                      <p className="text-[11px] text-amber-800 font-bold">
                        {order.halt_details.reason} — {order.halt_details.number || ''}
                      </p>
                      {order.halt_details.probeStatus && (
                        <p className="text-[10px] text-amber-600 font-mono">
                          CJ probe status: {order.halt_details.probeStatus}
                        </p>
                      )}
                      {order.halt_details.probeOrderNum && (
                        <p className="text-[10px] text-amber-600 font-mono">
                          CJ order: {order.halt_details.probeOrderNum}
                        </p>
                      )}
                    </div>
                  )}

                  {order.shipping_address && (
                    <div className="bg-temu-offwhite p-3 rounded-xl border border-gray-100 text-xs text-gray-500 mt-2">
                      <span className="text-gray-400 font-bold uppercase text-[10px] block mb-0.5">Shipping Destination:</span>
                      <p className="break-words text-[11px] text-gray-800 font-medium">{formatAddress(order.shipping_address)}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 flex-wrap lg:flex-nowrap shrink-0 w-full lg:w-auto">
                  
                  {/* ✨ زر استعراض المنتجات العالقة في الطلب */}
                  <button
                    type="button"
                    onClick={() => handleViewItems(order)}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-3 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                    title="Inspect Items in this Order"
                  >
                    📦 View Items
                  </button>

                  <button 
                    type="button"
                    onClick={() => handleApprove(order.id)}
                    disabled={actionLoading === order.id}
                    className="flex-1 lg:flex-none bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white px-5 py-3 rounded-xl text-xs font-extrabold transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-[#8B78C6]/20"
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
                    type="button"
                    onClick={() => handleReject(order.id)}
                    disabled={actionLoading === order.id}
                    className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-3.5 py-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✨ نافذة استعراض عناصر الطلب العالق لمعرفة المنتجات بدقة */}
      {isItemsModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsItemsModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-black text-base text-gray-900">Order #{selectedOrder.id} Items</h3>
                <p className="text-xs text-gray-400">Total Billed: ${Number(selectedOrder.total_amount).toFixed(2)}</p>
              </div>
              <button onClick={() => setIsItemsModalOpen(false)} className="text-gray-400 hover:text-black font-bold p-1">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {loadingItems ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : orderItems.length > 0 ? (
                orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="relative w-12 h-12 bg-white rounded-lg overflow-hidden border border-gray-200 shrink-0">
                      <Image 
                        src={item.image_url || '/placeholder.jpg'} 
                        alt={item.title || 'Product'} 
                        fill 
                        sizes="48px" 
                        className="object-contain p-1" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.title}</p>
                      <div className="flex justify-between items-center mt-1 text-[11px] text-gray-500">
                        <span>Qty: {item.quantity}</span>
                        <span className="font-bold text-[#FF6B9D]">${Number(item.price_at_purchase).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-gray-400 py-6">No item records found.</p>
              )}
            </div>

            <button 
              type="button" 
              onClick={() => setIsItemsModalOpen(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl text-xs transition active:scale-95"
            >
              Close Inspector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}