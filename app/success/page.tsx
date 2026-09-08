'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';

function SuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id') || '';
  const method = searchParams.get('method') || 'Stripe';
  const orderIdParam = searchParams.get('order_id') || '';

  const [loading, setLoading] = useState(true);
  const [verifiedOrder, setVerifiedOrder] = useState<any>(null);
  const [error, setError] = useState('');
  
  // ✨ حالات الـ 1-Click Upsell
  const [upsellTimeLeft, setUpsellTimeLeft] = useState(300); // عداد 5 دقائق
  const [upsellDismissed, setUpsellDismissed] = useState(false);
  const [isUpsellProcessing, setIsUpsellProcessing] = useState(false);

  const { clearCart } = useCart();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // منتج الـ Upsell المقترح (عرض تكميلي لا يقاوم)
  const UPSELL_PRODUCT = {
    id: 9999,
    title: 'Executive Travel Protection Case & Cleaning Kit',
    dealPrice: 9.99,
    originalPrice: 24.99,
    discountPct: 60,
    image_url: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=80'
  };

  useEffect(() => {
    clearCart();

    // تشغيل عداد الـ 5 دقائق لعرض الـ Upsell
    const timer = setInterval(() => {
      setUpsellTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setUpsellDismissed(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // التحقق اللحظي المزدوج (JIT Verification)
    const verify = async () => {
      try {
        const endpoint = method === 'crypto' 
          ? `${API_BASE_URL}/api/payment/crypto/verify` 
          : `${API_BASE_URL}/api/payment/verify-session`;

        const payload = method === 'crypto' 
          ? { order_id: orderIdParam } 
          : { session_id: sessionId };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setVerifiedOrder(data);

          // تتبع البيكسل بالمبلغ الحقيقي
          const paidAmount = Number(data.amount) || 0;
          const trackingKey = `upsell_page_tracked_${data.orderId || sessionId}`;
          if (!sessionStorage.getItem(trackingKey) && paidAmount > 0) {
            if (typeof window !== 'undefined' && (window as any).fbq) {
              (window as any).fbq('track', 'Purchase', { value: paidAmount, currency: 'USD' });
            }
            if (typeof window !== 'undefined' && (window as any).ttq) {
              (window as any).ttq.track('CompletePayment', { value: paidAmount, currency: 'USD' });
            }
            sessionStorage.setItem(trackingKey, 'true');
          }
        }
      } catch (err) {
        // الاستمرار حتى في حال الخطأ الشبكي لأن الطلب مؤكد في السيرفر
      } finally {
        setLoading(false);
      }
    };

    if (sessionId || orderIdParam) {
      verify();
    } else {
      setLoading(false);
    }

    return () => clearInterval(timer);
  }, [sessionId, orderIdParam, method, clearCart, API_BASE_URL]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // معالجة شراء عرض الـ Upsell بنقرة واحدة
  const handleClaimUpsell = async () => {
    setIsUpsellProcessing(true);
    try {
      // فتح جلسة دفع Stripe سريعة مخصصة لمنتج الـ Upsell بالسعر المخفض (9.99$)
      const res = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: UPSELL_PRODUCT.id,
            title: `[ADD-ON UPSELL] ${UPSELL_PRODUCT.title}`,
            price: UPSELL_PRODUCT.dealPrice,
            image_url: UPSELL_PRODUCT.image_url,
            quantity: 1
          }],
          origin: window.location.origin
        })
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      alert('Could not initiate add-on checkout. Your main order is still safe.');
    } finally {
      setIsUpsellProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F9F8FC] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-black text-[#1D1E3C]">Confirming Order Settlement...</h2>
        <p className="text-xs text-gray-500 mt-1">Securing dispatch protocol with international air logistics...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F9F8FC] flex flex-col items-center justify-center p-4 sm:p-6 font-sans py-12">
      <div className="max-w-md w-full space-y-6">
        
        {/* بطاقة تأكيد الطلب الأساسية */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-3xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50/50">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#8B78C6] bg-purple-50 px-3 py-1 rounded-full border border-purple-100 inline-block mb-1.5">
              Verified Settlement &bull; {method}
            </span>
            <h1 className="text-2xl font-black text-[#1D1E3C]">Payment Confirmed!</h1>
            <p className="text-xs text-gray-500 mt-1">
              Your parcel is now in automated dispatch. Order #{verifiedOrder?.orderId || orderIdParam || 'Confirmed'}.
            </p>
          </div>
        </div>

        {/* =========================================================================
            🔥 عرض الـ 1-Click Upsell الذكي (ينبثق بحواف نيون وعد تنازلي)
           ========================================================================= */}
        {!upsellDismissed && (
          <div className="bg-gradient-to-br from-[#1D1E3C] to-[#2D2E5C] text-white p-6 rounded-3xl shadow-2xl border-2 border-[#8B78C6] relative overflow-hidden space-y-4 animate-scale">
            
            {/* مؤقت الـ 5 دقائق المتناقص */}
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#FF6B9D] flex items-center gap-1">
                <span>⚡</span> Exclusive One-Time Offer
              </span>
              <span className="text-xs font-mono font-black bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-amber-300">
                Expires in {formatTimer(upsellTimeLeft)}
              </span>
            </div>

            <div className="text-left space-y-1">
              <h3 className="text-base font-black text-white leading-snug">
                Wait! Add this to your shipment before it leaves the warehouse?
              </h3>
              <p className="text-xs text-gray-300">
                Special {UPSELL_PRODUCT.discountPct}% instant discount exclusively for confirmed buyers.
              </p>
            </div>

            {/* تفاصيل المنتج المقترح */}
            <div className="flex items-center gap-3.5 bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-white shrink-0 border border-white/20">
                <img 
                  src={UPSELL_PRODUCT.image_url} 
                  alt={UPSELL_PRODUCT.title} 
                  className="w-full h-full object-cover" 
                />
              </div>

              <div className="min-w-0 flex-1 text-left">
                <h4 className="text-xs font-bold text-white line-clamp-2">{UPSELL_PRODUCT.title}</h4>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-base font-black text-[#FF6B9D]">${UPSELL_PRODUCT.dealPrice.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 line-through">${UPSELL_PRODUCT.originalPrice.toFixed(2)}</span>
                  <span className="text-[10px] font-black bg-[#FF6B9D]/20 text-[#FF6B9D] px-1.5 py-0.5 rounded">
                    Save {UPSELL_PRODUCT.discountPct}%
                  </span>
                </div>
              </div>
            </div>

            {/* زر إضافة العرض بنقرة واحدة */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleClaimUpsell}
                disabled={isUpsellProcessing}
                className="w-full bg-gradient-to-r from-[#FF6B9D] to-rose-600 hover:brightness-110 text-white font-black py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUpsellProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>⚡</span> Yes! Add to My Parcel for $9.99
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setUpsellDismissed(true)}
                className="w-full text-center text-[11px] text-gray-400 hover:text-white transition py-1 cursor-pointer"
              >
                No thanks, I will pass on this exclusive deal
              </button>
            </div>

          </div>
        )}

        {/* أزرار التوجيه العادية */}
        <div className="space-y-2.5">
          <button 
            onClick={() => router.push('/track-order')}
            className="w-full bg-[#1D1E3C] hover:bg-[#2D2E5C] text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition shadow-md active:scale-95 cursor-pointer"
          >
            Track Parcel Shipment &rarr;
          </button>

          <Link 
            href="/"
            className="block w-full bg-white hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-bold text-xs uppercase tracking-wider border border-gray-200 transition active:scale-95 text-center shadow-sm"
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