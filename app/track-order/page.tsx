'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface TrackedOrder {
  id: number;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  total_amount: string | number;
  status: string;
  created_at?: string;
  tracking_number?: string;
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const initialOrderId = searchParams.get('orderId') || '';
  const initialEmail = searchParams.get('email') || '';

  const [orderId, setOrderId] = useState(initialOrderId);
  const [email, setEmail] = useState(initialEmail);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const executeTrack = async (targetId: string, targetEmail: string) => {
    if (!targetId.trim() || !targetEmail.trim()) {
      setError('Please provide both your Order ID and Account Email to verify shipment ownership.');
      return;
    }

    setLoading(true);
    setError('');
    setOrders([]);

    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/track/${encodeURIComponent(targetId.trim())}?email=${encodeURIComponent(targetEmail.trim().toLowerCase())}`);
      const data = await res.json();
      
      if (res.ok) {
        if (Array.isArray(data) && data.length > 0) {
          setOrders(data);
        } else {
          setError('No orders found matching this Order ID and Email combination.');
        }
      } else {
        setError(data.error || 'Unable to locate order with provided credentials.');
      }
    } catch (err) {
      setError('Unable to reach global logistics server. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // فحص تلقائي إذا جاء الزبون برابط مباشر يحتوي على Order ID
  useEffect(() => {
    if (initialOrderId && initialEmail) {
      executeTrack(initialOrderId, initialEmail);
    }
  }, [initialOrderId, initialEmail]);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeTrack(orderId, email);
  };

  // ✨ فك العنوان البشري النظيف بدلاً من إظهار JSON مشوه
  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    try {
      const parsed = JSON.parse(address);
      return [parsed.line1, parsed.city, parsed.state, parsed.postal_code, parsed.country].filter(Boolean).join(', ');
    } catch (e) {
      return address;
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-4 sm:p-6 max-w-lg mx-auto pb-24 font-sans">
      
      {/* Header */}
      <div className="text-center mb-6 pt-4">
        <div className="w-14 h-14 bg-purple-100 text-[#8B78C6] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-sm">
          📦
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Track Your Shipment</h1>
        <p className="text-xs text-gray-500 mt-1">Enter your Order ID and the Email used during checkout</p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleTrackSubmit} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 mb-6">
        <div>
          <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">Order Identification Number *</label>
          <input 
            type="text" 
            placeholder="e.g. 1042"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            required
            className="w-full p-3 bg-gray-50 rounded-xl text-xs text-gray-900 outline-none border border-gray-200 focus:border-[#8B78C6] transition"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase text-gray-700 mb-1">Account / Order Email *</label>
          <input 
            type="email" 
            placeholder="e.g. buyer@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full p-3 bg-gray-50 rounded-xl text-xs text-gray-900 outline-none border border-gray-200 focus:border-[#8B78C6] transition"
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition shadow-md active:scale-95 disabled:opacity-70 flex justify-center items-center gap-2 cursor-pointer mt-1"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Scan Logistics Status'
          )}
        </button>
      </form>

      {error && (
        <div className="text-rose-700 text-xs font-bold mb-6 bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-center">
          ⚠️ {error}
        </div>
      )}

      {/* Results & Visual Stepper */}
      <div className="space-y-4">
        {orders.map((order) => {
          const safeTotal = Number(order.total_amount) || 0;
          const statusLower = (order.status || '').toLowerCase();
          const isFulfilled = statusLower === 'fulfilled' || statusLower === 'completed';

          return (
            <div key={order.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
              
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-xs font-black text-gray-900">Order #{order.id}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                  isFulfilled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {order.status ? order.status.toUpperCase() : 'PROCESSING'}
                </span>
              </div>

              {/* Visual Logistics Stepper */}
              <div className="py-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-2">
                  <span className="text-[#8B78C6]">Confirmed</span>
                  <span className={isFulfilled ? 'text-[#8B78C6]' : 'text-gray-400'}>CJ Processing</span>
                  <span className={isFulfilled ? 'text-emerald-600 font-black' : 'text-gray-400'}>Dispatched</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-[#8B78C6] to-emerald-500 h-full rounded-full transition-all duration-700" 
                    style={{ width: isFulfilled ? '100%' : '65%' }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <p><span className="text-gray-400 uppercase text-[10px] font-bold block">Destination:</span> <strong className="text-gray-800">{formatAddress(order.shipping_address)}</strong></p>
                <p className="pt-1"><span className="text-gray-400 uppercase text-[10px] font-bold block">Total Billed:</span> <strong className="text-[#FF6B9D] font-black">${safeTotal.toFixed(2)}</strong></p>
              </div>

              {order.created_at && (
                <p className="text-[10px] text-gray-400 text-center font-mono">
                  Timestamp: {new Date(order.created_at).toLocaleString()}
                </p>
              )}
            </div>
          );
        })}
      </div>

    </main>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <TrackOrderContent />
    </Suspense>
  );
}