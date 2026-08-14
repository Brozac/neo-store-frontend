'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string | number;
  created_at: string;
  status: string;
  total_amount: string | number;
  shipping_address: string;
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

  // حالات النافذة المنبثقة (Modal)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth');
      return;
    }

    const fetchOrders = async () => {
      try {
        const ordersRes = await fetch('https://neo-store-backend.onrender.com/api/orders/my-orders', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!ordersRes.ok) {
          if (ordersRes.status === 401 || ordersRes.status === 403) {
            router.push('/auth');
            return;
          }
          setOrders([]);
          return;
        }

        const data = await ordersRes.json();
        if (Array.isArray(data)) {
          setOrders(data);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [router]);

  const getStatusStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'fulfilled':
      case 'paid':
        return 'bg-temu-green-light/20 text-temu-green'; 
      case 'pending':
        return 'bg-temu-yellow-soft text-temu-gold';
      case 'manual':
      case 'cancelled':
      case 'expired':
        return 'bg-red-50 text-temu-error';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const handleViewDetails = async (order: Order) => {
    setModalOrder(order);
    setIsModalOpen(true);
    setLoadingDetails(true);
    setOrderItems([]);

    try {
      const res = await fetch(`https://neo-store-backend.onrender.com/api/orders/${order.id}/items`);
      
      if (!res.ok) {
        throw new Error('Failed to load details');
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setOrderItems(data);
      }
    } catch (err) {
      setOrderItems([{ 
        title: 'Could not load items. Please make sure the backend is running and restarted.', 
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
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* ✨ زر الرجوع مع تأثير الضغط */}
        <button 
          onClick={() => router.push('/profile')} 
          className="flex items-center gap-2 text-temu-gray-light hover:text-temu-black font-medium text-sm transition cursor-pointer mb-6 active:scale-95 w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Profile
        </button>

        <h1 className="text-2xl font-extrabold text-temu-black mb-6">My Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white p-10 rounded-temu-sm border border-temu-gray-border-light text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-temu-gray-border" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <p className="text-temu-gray-text font-medium">You have no orders yet.</p>
            {/* ✨ زر Start Shopping مع تأثير الضغط */}
            <button onClick={() => router.push('/')} className="mt-6 bg-temu-orange text-white font-bold py-2 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 shadow-md">
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-5 rounded-temu-sm border border-temu-gray-border-light shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start pb-4 border-b border-temu-gray-border-light">
                  <div>
                    <h3 className="font-bold text-temu-black text-lg">Order #{order.id}</h3>
                    <p className="text-xs text-temu-gray-light mt-1">
                      {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusStyle(order.status)}`}>
                    {order.status}
                  </span>
                </div>

                <div className="flex items-start gap-3 py-4">
                  <div className="bg-temu-offwhite p-2 rounded-temu-sm mt-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-temu-orange">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-temu-gray-light font-bold mb-1">Shipping Address</p>
                    <p className="text-sm text-temu-dark font-medium">{order.shipping_address}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-temu-gray-border-light">
                  <div>
                    <p className="text-xs text-temu-gray-light font-bold">Total</p>
                    <p className="text-xl font-extrabold text-temu-error">${Number(order.total_amount).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    {/* ✨ زر Track مع تأثير الضغط */}
                    <button 
                      onClick={() => router.push('/track-order')} 
                      className="px-4 py-2 bg-temu-offwhite border border-temu-gray-border text-temu-black rounded-temu-sm text-xs font-bold hover:bg-temu-gray-border-light transition cursor-pointer flex items-center gap-1 active:scale-95"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Track
                    </button>
                    {/* ✨ زر View Details مع تأثير الضغط */}
                    <button 
                      onClick={() => handleViewDetails(order)} 
                      className="px-4 py-2 bg-temu-orange text-white rounded-temu-sm text-xs font-bold hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 shadow-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة تفاصيل الطلب (Modal) */}
      {isModalOpen && modalOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-temu-sm max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Order #{modalOrder.id}</h2>
              {/* ✨ زر الإغلاق مع تأثير الضغط */}
              <button onClick={() => setIsModalOpen(false)} className="text-temu-gray-light hover:text-temu-black cursor-pointer active:scale-90 transition">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {loadingDetails ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              // ✨ إضافة scrollbar-hide و touch-pan-y للسحب السلس باللمس داخل المودال
              <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide touch-pan-y">
                {orderItems.length > 0 ? (
                  orderItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-temu-offwhite rounded-temu-sm border border-temu-gray-border-light">
                      <div className="w-16 h-16 rounded-temu-sm overflow-hidden bg-white border border-temu-gray-border-light shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-temu-gray-light text-[10px]">No Image</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-temu-black line-clamp-2">{item.title || 'Unknown Product'}</p>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-temu-gray-text font-medium">Qty: {item.quantity}</span>
                          <span className="text-sm font-extrabold text-temu-error">${Number(item.price_at_purchase).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-temu-gray-light py-6">No items found for this order.</p>
                )}
              </div>
            )}

            {/* إجمالي الطلب في أسفل النافذة */}
            <div className="mt-6 pt-4 border-t border-temu-gray-border-light flex justify-between items-center">
              <span className="text-sm font-bold text-temu-black">Total Amount</span>
              <span className="text-lg font-extrabold text-temu-error">${Number(modalOrder.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}