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
    setOrders([]); // مسح النتائج القديمة قبل البحث الجديد

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
    <main className="min-h-screen bg-[#F4F3F8] p-6 max-w-md mx-auto pb-24 font-sans">
      <h1 className="text-2xl font-extrabold text-[#1D1E3C] mb-2 text-center">Track Your Order</h1>
      <p className="text-xs text-[#9A9AB0] mb-6 text-center">Enter your Order ID or Email address below</p>

      <form onSubmit={handleTrack} className="flex gap-2 mb-8">
        <input 
          type="text" 
          placeholder="Order ID or Email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 p-3.5 bg-white rounded-2xl shadow-sm text-sm outline-none text-[#1D1E3C] focus:ring-1 focus:ring-[#8B78C6]"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-[#8B78C6] text-white px-6 rounded-2xl font-bold text-sm shadow-md hover:bg-[#7a67b5] transition-all disabled:opacity-70"
        >
          {loading ? '...' : 'Track'}
        </button>
      </form>

      {error && <p className="text-red-500 text-xs text-center font-bold mb-4 bg-red-50 p-3 rounded-xl">{error}</p>}

      <div className="space-y-4">
        {orders.map((order) => {
          const safeTotal = Number(order.total_amount) || 0;
          const formattedDate = order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A';
          
          return (
            <div key={order.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-gray-400">Order #{order.id}</span>
                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  order.status === 'paid' || order.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {order.status ? order.status.toUpperCase() : 'PROCESSING'}
                </span>
              </div>
              <p className="text-lg font-extrabold text-[#1D1E3C] mb-2">Total: ${safeTotal.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Shipping To: <span className="font-semibold text-[#1D1E3C]">{order.shipping_address || 'N/A'}</span></p>
              <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100">Date: {formattedDate}</p>
            </div>
          );
        })}
      </div>
    </main>
  );
}