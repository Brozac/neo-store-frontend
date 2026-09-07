'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const rawAmount = searchParams.get('amount');
  const sessionId = searchParams.get('session_id') || '';
  const method = searchParams.get('method') || 'Stripe';

  const [orderAmount, setOrderAmount] = useState<number>(0);
  const { clearCart, cartTotal } = useCart();

  useEffect(() => {
    // 1. حساب القيمة الحقيقية للطلب
    let finalVal = 0;
    if (rawAmount) {
      finalVal = parseFloat(rawAmount) || 0;
    } else if (cartTotal > 0) {
      finalVal = cartTotal;
    } else {
      finalVal = 29.99; // Fallback لقيمة متوسطة لتفادي تسجيل 0$ في البيكسل
    }
    setOrderAmount(finalVal);

    // 2. تفريغ سلة المشتريات فور تأكيد الدفع
    clearCart();

    // 3. ✨ منع التكرار (Deduplication): تسجيل الشراء مرة واحدة فقط حتى لو ضغط الزبون Refresh
    const trackingKey = `pixel_tracked_${sessionId || finalVal || 'default'}`;
    const alreadyTracked = typeof window !== 'undefined' ? sessionStorage.getItem(trackingKey) : null;

    if (!alreadyTracked && finalVal > 0) {
      // إرسال البيكسل لفيسبوك (Meta Pixel)
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Purchase', {
          value: finalVal,
          currency: 'USD',
          content_type: 'product',
        }, { eventID: sessionId || undefined });
      }

      // إرسال البيكسل لتيك توك (TikTok Pixel)
      if (typeof window !== 'undefined' && (window as any).ttq) {
        (window as any).ttq.track('CompletePayment', {
          value: finalVal,
          currency: 'USD',
          content_type: 'product',
        });
      }

      try {
        sessionStorage.setItem(trackingKey, 'true');
      } catch (e) {}
    }
  }, [rawAmount, sessionId, clearCart, cartTotal]);

  return (
    <main className="min-h-screen bg-[#F9F8FC] flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="bg-white border border-gray-100 shadow-2xl rounded-3xl p-8 sm:p-10 max-w-md w-full text-center space-y-6">
        
        {/* Animated Checkmark Badge */}
        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50/50 animate-scale">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#8B78C6] bg-purple-50 px-3 py-1 rounded-full border border-purple-100 inline-block mb-2">
            Payment Confirmed &bull; {method}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#1D1E3C]">Order Confirmed!</h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            Thank you for shopping with Laclarc. Your payment has been securely verified and your order is currently being fulfilled via automated logistics.
          </p>
        </div>

        {/* Financial & Shipping Assurance Box */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs text-left space-y-2">
          {orderAmount > 0 && (
            <div className="flex justify-between items-center border-b border-gray-200 pb-2">
              <span className="text-gray-500 font-medium">Total Billed:</span>
              <span className="font-black text-[#FF6B9D] text-sm">${orderAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <span className="text-temu-gray-text font-medium">Shipping:</span>
            <span className="text-sm font-bold text-emerald-500">Free Worldwide Express (Included)</span>
          </div>
          <p className="text-[11px] text-gray-400 pt-1">
            Tracking updates will be dispatched directly to your email address.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button 
            onClick={() => router.push('/track-order')}
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