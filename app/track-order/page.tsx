'use client';

import { useState } from 'react';

interface TrackedOrder {
  id: number;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total_amount: string | number;
  status: string;
  created_at?: string;
}

export default function TrackOrderPage() {
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setOrders([]);

    try {
      const res = await fetch(`https://neo-store-backend.onrender.com/api/orders/track/${query}`);
      const data = await res.json();
      
      if (res.ok) {
        setOrders(Array.isArray(data) ? data : []);
        if (data.length === 0) {
          setError('No orders found for this search.');
        }
      } else {
        setError(data.error || 'Order not found');
      }
    } catch (err) {
      setError('Failed to fetch order status. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 max-w-md mx-auto pb-24 font-sans">
      <h1 className="text-2xl font-extrabold text-temu-black mb-2 text-center flex items-center justify-center gap-2">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-temu-orange">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        Track Your Order
      </h1>
      <p className="text-xs text-temu-gray-light mb-6 text-center">Enter your Order ID or Email address below</p>

      {/* ✨ تعديل الاستجابة: تتراص عمودياً على الهواتف الصغيرة جداً */}
      <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2 mb-8">
        <input 
          type="text" 
          placeholder="Order ID or Email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 p-3.5 bg-white rounded-temu-sm shadow-sm text-sm outline-none text-temu-black focus:ring-1 focus:ring-temu-orange border border-temu-gray-border-light transition touch-manipulation"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-temu-orange text-white px-6 py-3.5 rounded-temu-sm font-bold text-sm shadow-md hover:bg-temu-orange-bright transition-all disabled:opacity-70 active:scale-95 touch-manipulation cursor-pointer flex justify-center items-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : 'Track'}
        </button>
      </form>

      {error && <p className="text-temu-error text-xs text-center font-bold mb-4 bg-red-50 p-3 rounded-temu-sm">{error}</p>}

      <div className="space-y-4">
        {orders.map((order) => {
          const safeTotal = Number(order.total_amount) || 0;
          const formattedDate = order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A';
          
          return (
            <div key={order.id} className="bg-white p-5 rounded-temu-sm shadow-sm border border-temu-gray-border-light">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-temu-gray-light">Order #{order.id}</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  order.status === 'paid' || order.status === 'fulfilled' ? 'bg-temu-green-light/20 text-temu-green' : 'bg-temu-yellow-soft text-temu-gold'
                }`}>
                  {order.status ? order.status.toUpperCase() : 'PROCESSING'}
                </span>
              </div>
              <p className="text-lg font-extrabold text-temu-black mb-2">Total: ${safeTotal.toFixed(2)}</p>
              <p className="text-xs text-temu-gray-text">Shipping To: <span className="font-semibold text-temu-black">{order.shipping_address || 'N/A'}</span></p>
              <p className="text-[10px] text-temu-gray-light mt-2 pt-2 border-t border-temu-gray-border-light">Date: {formattedDate}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}