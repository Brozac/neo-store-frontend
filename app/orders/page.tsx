'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Order {
  id: string | number;
  created_at: string;
  status: string;
  status_label?: string;   // 🩹 M#29 — من السيرفر
  total_amount: string | number;
  shipping_address: string;
  customer_email?: string;
}

interface OrderItem {
  title: string;
  image_url: string;
  quantity: number;
  price_at_purchase: string | number;
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/auth');
      return;
    }

    // 🩹 M#29 — الحصول على إيميل المستخدم لتمريره في زر Track
    fetch(`${API_BASE_URL}/api/user/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (profile?.email) setUserEmail(profile.email);
      })
      .catch(() => {});

    const fetchOrders = async () => {
      try {
        // 🩹 M#29 — استعمل الكاش من Profile إذا متوفر (أسرع، بلا fetch إضافي)
        const cached = sessionStorage.getItem('my_orders_cache');
        if (cached) {
          try {
            const cachedOrders = JSON.parse(cached);
            if (Array.isArray(cachedOrders) && cachedOrders.length > 0) {
              setOrders(cachedOrders);
              setLoading(false);
              // ✨ نكمل fetch حياً في الخلفية لتحديث الحالات — لا نعرض loading مرة ثانية
            }
          } catch { /* cache تالف — نتجاهله */ }
        }

        const ordersRes = await fetch(`${API_BASE_URL}/api/orders/my-orders`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!ordersRes.ok) {
          if (ordersRes.status === 401 || ordersRes.status === 403) {
            localStorage.removeItem('token');
            router.push('/auth');
            return;
          }
          setOrders([]);
          return;
        }

        const data = await ordersRes.json();
        if (Array.isArray(data)) {
          setOrders(data);
          // ✨ حدّث الكاش للزيارة القادمة
          sessionStorage.setItem('my_orders_cache', JSON.stringify(data));
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router, API_BASE_URL]);

  // 🩹 M#29 — عرض status_label إن وجد (من الباكند) وإلا الحالة الخام
  const getStatusLabel = (order: Order): string => {
    if (order.status_label) return order.status_label;   // من السيرفر
    // fallback محلي — نفس الخريطة (تناسق مع server.js getStatusLabel)
    const MAP: Record<string, string> = {
      'pending':           '⏳ Awaiting Payment',
      'paid':              '✅ Payment Confirmed',
      'awaiting_exchange': '📦 Alternative Offered — Check Email',
      'processing':        '⏳ Processing',
      'manual':            '⏳ Under Review',
      'fulfilled':         '🚚 Shipped',
      'completed':         '✅ Delivered',
      'refunded':          '💰 Refunded',
      'cancelled':         '❌ Cancelled',
      'expired':           '⏱ Expired',
      'archived':          '📦 Archived',
    };
    return MAP[String(order.status || '').toLowerCase()] || String(order.status || '');
  };

  // 🩹 M#29 — لون البادج يتبع نفس نظام getStatusStyle الحالي
  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'fulfilled':
      case 'paid':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'awaiting_exchange':   // 🩹 جديد — لون مميز للبديل المعروض
      case 'reconciling':
      case 'processing':
      case 'pending':
        return 'bg-purple-50 text-purple-700 border border-purple-200';
      case 'refunded':            // 🩹 جديد — لون مميز للمسترد
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'manual':
      case 'cancelled':
      case 'expired':
        return 'bg-rose-50 text-rose-700 border border-rose-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '🌍 International shipping';
    try {
      const parsed = JSON.parse(address);
      return [parsed.line1, parsed.city, parsed.state, parsed.postal_code, parsed.country].filter(Boolean).join(', ');
    } catch (e) {
      return address;
    }
  };

  const handleViewDetails = async (order: Order) => {
    setModalOrder(order);
    setIsModalOpen(true);
    setLoadingDetails(true);
    setOrderItems([]);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/orders/${order.id}/items`, { headers });

      if (!res.ok) {
        throw new Error('Failed to load details');
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setOrderItems(data);
      }
    } catch (err) {
      setOrderItems([{
        title: 'Could not load items. Details will sync automatically.',
        image_url: '',
        quantity: 0,
        price_at_purchase: 0
      }]);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-4 sm:p-6 pb-24 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">

        <button
          onClick={() => router.push('/profile')}
          className="flex items-center gap-2 text-gray-500 hover:text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer active:scale-95 w-fit"
        >
          &larr; Back to Profile
        </button>

        <div className="flex justify-between items-center flex-wrap gap-2 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Purchase History</h1>
            <p className="text-xs text-gray-500">Track and review all previous purchases with Laclarc</p>
          </div>
          <span className="text-xs font-mono font-bold bg-white px-3 py-1 rounded-full border border-gray-200">
            {orders.length} Orders Recorded
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-200 text-center shadow-sm space-y-4">
            <div className="w-16 h-16 bg-purple-50 text-[#8B78C6] rounded-full flex items-center justify-center text-2xl mx-auto">
              📦
            </div>
            <h3 className="text-base font-bold text-gray-800">No Orders Found Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">Once you complete a purchase, your shipment tracking and invoice details will appear here.</p>
            <button
              onClick={() => router.push('/')}
              className="bg-[#1D1E3C] hover:bg-[#2D2E5C] text-white font-extrabold py-3 px-8 rounded-xl text-xs uppercase tracking-wider transition shadow-md active:scale-95"
            >
              Start Shopping &rarr;
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start pb-4 border-b border-gray-100 flex-wrap gap-2">
                  <div>
                    <h3 className="font-black text-gray-900 text-base">Order {(order as any).order_number || `#${order.id}`}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                      {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  {/* 🩹 M#29 — status_label الودي من الباكند */}
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusStyle(order.status)}`}>
                    {getStatusLabel(order)}
                  </span>
                </div>

                <div className="py-3 text-xs text-gray-600 flex items-start gap-2.5">
                  <span className="text-base">📍</span>
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Delivery Destination</span>
                    <p className="font-medium text-gray-800 truncate">{formatAddress(order.shipping_address)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-gray-100 flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Billed</span>
                    <span className="text-lg font-black text-[#FF6B9D]">${Number(order.total_amount).toFixed(2)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 🩹 M#29 — مرر الإيميل لصفحة التتبع (نفس عقد track/:identifier) */}
                    <button
                      onClick={() => router.push(`/track-order?orderId=${order.id}&email=${encodeURIComponent(order.customer_email || userEmail)}`)}
                      className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
                    >
                      <span>🚚</span>
                      <span>Track Shipment</span>
                    </button>

                    <button
                      onClick={() => handleViewDetails(order)}
                      className="px-4 py-2 bg-[#8B78C6] hover:bg-[#7A67B5] text-white rounded-xl text-xs font-extrabold transition active:scale-95 shadow-sm"
                    >
                      View Items
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {isModalOpen && modalOrder && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>

            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-gray-900 text-base">Order {(modalOrder as any).order_number || `#${modalOrder.id}`} Details</h3>
                {/* 🩹 M#29 — status_label في الـ modal أيضاً */}
                <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${getStatusStyle(modalOrder.status)}`}>
                  {getStatusLabel(modalOrder)}
                </span>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-black p-1 text-sm font-bold">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {loadingDetails ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-3 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : orderItems.length > 0 && !orderItems[0].title.includes('Could not load') ? (
                orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-white border border-gray-200 shrink-0 relative">
                      <Image
                        src={item.image_url || '/placeholder.jpg'}
                        alt={item.title}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 line-clamp-2">{item.title}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[11px] text-gray-500 font-semibold">Qty: {item.quantity}</span>
                        <span className="text-xs font-black text-[#FF6B9D]">${Number(item.price_at_purchase).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-gray-400 py-6">{orderItems[0]?.title || 'No items available.'}</p>
              )}
            </div>

            <div className="p-5 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">Total Settled</span>
              <span className="text-lg font-black text-[#FF6B9D]">${Number(modalOrder.total_amount).toFixed(2)}</span>
            </div>

          </div>
        </div>
      )}
    </main>
  );
}