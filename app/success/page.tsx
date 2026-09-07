'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';

  const [loading, setLoading] = useState(true);
  const [verifiedOrder, setVerifiedOrder] = useState<any>(null);
  const [error, setError] = useState('');
  
  const { clearCart } = useCart();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  useEffect(() => {
    clearCart();

    const method = searchParams.get('method') || '';
    const orderId = searchParams.get('order_id') || '';

    // ==========================================
    // 1. مسار التحقق اللحظي للكريبتو (Crypto JIT)
    // ==========================================
    if (method === 'crypto' && orderId) {
      const verifyCrypto = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/payment/crypto/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: orderId })
          });
          const data = await res.json();

          if (res.ok && data.success) {
            setVerifiedOrder(data);

            if (data.verified) {
              // تسجيل الشراء في بيكسل فيسبوك وتيك توك
              const trackingKey = `crypto_tracked_${orderId}`;
              if (!sessionStorage.getItem(trackingKey)) {
                if (typeof window !== 'undefined' && (window as any).fbq) {
                  (window as any).fbq('track', 'Purchase', { value: Number(data.amount), currency: 'USD' });
                }
                if (typeof window !== 'undefined' && (window as any).ttq) {
                  (window as any).ttq.track('CompletePayment', { value: Number(data.amount), currency: 'USD' });
                }
                sessionStorage.setItem(trackingKey, 'true');
              }
            } else {
              setError('Crypto transaction is confirming on the blockchain. Your order will be dispatched automatically in minutes!');
            }
          }
        } catch (e) {
          setError('Order recorded! Awaiting final blockchain confirmations.');
        } finally {
          setLoading(false);
        }
      };

      verifyCrypto();
      return;
    }

    // ==========================================
    // 2. مسار التحقق اللحظي لـ Stripe (Stripe JIT)
    // ==========================================
    if (sessionId) {
      const verifyStripe = async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/payment/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
          });
          const data = await res.json();

          if (res.ok && data.success) {
            setVerifiedOrder(data);

            const finalPaid = Number(data.amount) || 0;
            const trackingKey = `jit_tracked_${data.orderId || sessionId}`;

            if (!sessionStorage.getItem(trackingKey) && finalPaid > 0) {
              if (typeof window !== 'undefined' && (window as any).fbq) {
                (window as any).fbq('track', 'Purchase', { value: finalPaid, currency: data.currency || 'USD' }, { eventID: sessionId });
              }
              if (typeof window !== 'undefined' && (window as any).ttq) {
                (window as any).ttq.track('CompletePayment', { value: finalPaid, currency: data.currency || 'USD' });
              }
              sessionStorage.setItem(trackingKey, 'true');
            }
          } else {
            setError(data.message || 'Payment confirmation pending.');
          }
        } catch (err) {
          setError('Verifying payment. Your order is secured.');
        } finally {
          setLoading(false);
        }
      };

      verifyStripe();
      return;
    }

    // Fallback عام
    setLoading(false);
  }, [sessionId, searchParams, clearCart, API_BASE_URL]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F9F8FC] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-black text-[#1D1E3C]">Verifying Payment with Stripe...</h2>
        <p className="text-xs text-gray-500 mt-1">Securing order and dispatching to automated fulfillment...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F9F8FC] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="bg-white border border-gray-100 shadow-2xl rounded-3xl p-8 sm:p-10 max-w-md w-full text-center space-y-6">
        
        {error ? (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-black text-[#1D1E3C]">Payment Pending Verification</h1>
            <p className="text-xs text-gray-500 leading-relaxed">{error}</p>
            <button 
              onClick={() => router.push('/track-order')}
              className="w-full bg-[#1D1E3C] text-white py-3.5 rounded-xl font-bold text-xs uppercase"
            >
              Check Order Status &rarr;
            </button>
          </div>
        ) : (
          <>
            {/* أيقونة النجاح المؤكد */}
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50/50 animate-scale">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#8B78C6] bg-purple-50 px-3 py-1 rounded-full border border-purple-100 inline-block mb-2">
                Stripe Verified &bull; Just-In-Time
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-[#1D1E3C]">Payment Successful!</h1>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Thank you for your purchase. We have verified your transaction directly with Stripe and your order is now in automated dispatch.
              </p>
            </div>

            {/* تفاصيل الطلب المأخوذة مباشرة من السيرفر لحظياً */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs text-left space-y-2.5">
              {verifiedOrder && (
                <>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium">Order Reference:</span>
                    <span className="font-mono font-black text-gray-900">#{verifiedOrder.orderId}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                    <span className="text-gray-500 font-medium">Verified Paid:</span>
                    <span className="font-black text-[#FF6B9D] text-sm">
                      ${Number(verifiedOrder.amount).toFixed(2)} {verifiedOrder.currency}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between items-center text-emerald-700 font-bold">
                <span>Shipping Status:</span>
                <span>Dispatched to CJ Logistics</span>
              </div>
            </div>

            {/* أزرار التوجيه */}
            <div className="space-y-3 pt-2">
              <button 
                onClick={() => router.push(`/track-order?orderId=${verifiedOrder?.orderId || ''}&email=${encodeURIComponent(verifiedOrder?.customerEmail || '')}`)}
                className="w-full bg-[#1D1E3C] hover:bg-[#2D2E5C] text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition shadow-md active:scale-95 cursor-pointer"
              >
                Track My Order &rarr;
              </button>

              <Link 
                href="/"
                className="block w-full bg-white hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border border-gray-200 transition active:scale-95"
              >
                Return to Storefront
              </Link>
            </div>
          </>
        )}

      </div>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F9F8FC]">
        <div className="w-8 h-8 border-3 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}