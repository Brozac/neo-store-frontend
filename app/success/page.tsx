'use client';

import { useEffect, useState, Suspense } from 'react';
import { createCheckoutSession } from '../../lib/checkout';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../context/CartContext';
import GlassIcon from '@/components/ui/GlassIcon';

// 🆕 FILE 5: Browser Purchase بمطابقة eventID حرفية مع conversionService.js
// نفس event_id (purch_{orderId}) → Meta تعده مرة واحدة (Deduplication داخل 48h)
function fireDedupedPurchase(
  orderId: string | number,
  value: number,
  contentIds: string[],
  currency = 'USD'
) {
  if (typeof window === 'undefined') return;

  // 🐛 HARDEN: amount قد يصل string من pg (DECIMAL) — توحيد النوع إجباري
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  const safeValue = parseFloat((Number.isFinite(numeric) ? numeric : 0).toFixed(2));
  const ids = contentIds.length > 0 ? contentIds : ['LACLARC_ORDER'];
  const eventId = `purch_${orderId}`; // 🔑 MUST match server EXACTLY

  const w = window as any;

  // Meta Pixel: eventID فالوسيط الرابع — مفتاح الـ Dedup
  if (typeof w.fbq === 'function') {
    w.fbq('track', 'Purchase',
      {
        value: safeValue,
        currency,
        content_type: 'product',
        content_ids: ids,
        contents: ids.map((id: string) => ({ id, quantity: 1 })),
        order_id: eventId,
      },
      { eventID: eventId } // 🔑 ضد العد المزدوج مع حدث السيرفر
    );
  }

  // TikTok Pixel: event_id داخل properties — جاهز ليوم التفعيل (gate على ttq)
  if (w.ttq && typeof w.ttq.track === 'function') {
    w.ttq.track('CompletePayment', {
      value: safeValue,
      currency,
      content_type: 'product',
      event_id: eventId, // 🔑 نفس المفتاح
      contents: ids.map((id: string) => ({ content_id: id, content_type: 'product', quantity: 1 })),
    });
  }
}
/**
 * 🆕 Mission #4: بصمات Meta المتصفحية — تُمرر للسيرفر ليرفقها بحدث CAPI
 * _fbp: كوكي Meta Pixel (ديما موجودة عند زوار الإعلانات)
 * _fbc: click identifier (موجودة فقط عند نقر إعلان fbclid) — إن لم توجد نصنعها من fbclid
 * قراءة محلية فقط — لا حساسية، لا تخزين (العمر: دقة المطابقة برك)
 */
function collectMetaFingerprints(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') return {};
  try {
    const cookies = Object.fromEntries(
      document.cookie.split(';').map(c => {
        const i = c.indexOf('=');
        return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
      })
    );

    let fbp = cookies._fbp;
    let fbc = cookies._fbc;

    // 🧠 نفس منطق Meta الرسمي: لا _fbc + يوجد fbclid في الرابط → نصنعها
    // الصيغة المعتمدة: fb.1.{timestamp}.{fbclid}
    if (!fbc) {
      const fbclid = new URLSearchParams(window.location.search).get('fbclid');
      if (fbclid) fbc = `fb.1.${Date.now()}.${fbclid}`;
    }

    // حدود أمان — Meta نفسها تقيد الأطوال
    return {
      ...(fbp ? { fbp: String(fbp).slice(0, 200) } : {}),
      ...(fbc ? { fbc: String(fbc).slice(0, 500) } : {}),
    };
  } catch {
    return {}; // أي فشل = صفر مطابقة إضافية — لا يؤثر على مسار الدفع أبداً
  }
}

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
          body: JSON.stringify({
            ...(method === 'crypto' ? { order_id: orderIdParam } : { session_id: sessionId }),
            ...collectMetaFingerprints(),  // 🆕 Mission #4 — بصمات المطابقة
          }),
        });;

        const data = await res.json();
        if (res.ok && data.success) {
          setVerifiedOrder(data);

          // 🆕 FILE 5: تتبع البكسل بـ eventID مطابق للسيرفر + items من الرد الموثّق
          const paidAmount = Number(data.amount) || 0;

          // ⚠️ Fail-Safe: بلا orderId من السيرفر → ما يتفيرش بكسل متصفحي
          //   (السيرفر يرسل الحدث بوحدو — نقص متصفحي أحسن من عد مزدوج أبداً)
          if (data.orderId && paidAmount > 0) {
            const dedupKey = `jit_tracked_${data.orderId}`; // 🔑 العقد الموحد (§4.4)
            if (!sessionStorage.getItem(dedupKey)) {
              const ids = (Array.isArray(data.items) ? data.items : [])
                .map((i: any) => String(i.productId))
                .filter(Boolean);
              fireDedupedPurchase(data.orderId, paidAmount, ids);
              sessionStorage.setItem(dedupKey, new Date().toISOString());
            // 🩹 Mission #13: second-shot — إعادة إرسال CAPI بالبصمات الكاملة
            // (آمن: نفس event_id → Meta dedup → لا مضاعفة، فقط تحسين المطابقة)
            fetch(`${API_BASE_URL}/api/payment/second-shot`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderId }),
            }).catch(() => {});
            }
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
      const url = await createCheckoutSession(
        [{
          id: UPSELL_PRODUCT.id,
          title: `[ADD-ON UPSELL] ${UPSELL_PRODUCT.title}`,
          price: UPSELL_PRODUCT.dealPrice,
          image_url: UPSELL_PRODUCT.image_url,
          quantity: 1,
        }]
      );
      window.location.href = url;
    } catch (err) {
      alert('Could not initiate add-on checkout. Your main order is still safe.');
    } finally {
      setIsUpsellProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4F8FB] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-12 h-12 border-4 border-[#5B7EA6] border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-black text-[#2E4057]">Confirming Order Settlement...</h2>
        <p className="text-xs text-gray-500 mt-1">Securing dispatch protocol with international air logistics...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4F8FB] flex flex-col items-center justify-center p-4 sm:p-6 font-sans py-12">
      <div className="max-w-md w-full space-y-6">
        
        {/* بطاقة تأكيد الطلب الأساسية */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-3xl p-6 sm:p-8 text-center space-y-4">
          {/* ✨ REPLICA_V3 — حلقة النجاح المتحركة (نفس المعاينة: هالة + قرص بنفسجي + ✓) */}
          <div className="w-24 h-24 bg-fog-100 rounded-full flex items-center justify-center mx-auto laclarc-ringin">
            <div className="w-14 h-14 rounded-full bg-linear-to-br from-[#5B7EA6] to-[#7FA1C4] text-white flex items-center justify-center shadow-lg shadow-[#5B7EA6]/40">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#5B7EA6] bg-fog-50 px-3 py-1 rounded-full border border-fog-100 inline-block mb-1.5">
              Verified Settlement &bull; {method}
            </span>
            <h1 className="text-2xl font-black text-[#2E4057]">Payment Confirmed!</h1>
            <p className="text-xs text-gray-500 mt-1">
              Your parcel is now in automated dispatch. Order #{verifiedOrder?.orderId || orderIdParam || 'Confirmed'}.
            </p>
          </div>
        </div>

        {/* =========================================================================
            <GlassIcon ch="🔥" size="xs" /> عرض الـ 1-Click Upsell الذكي (ينبثق بحواف نيون وعد تنازلي)
           ========================================================================= */}
        {!upsellDismissed && (
          <div className="bg-linear-to-br from-[#2E4057] to-[#33475C] text-white p-6 rounded-3xl shadow-2xl border-2 border-[#5B7EA6] relative overflow-hidden space-y-4 animate-scale">
            
            {/* مؤقت الـ 5 دقائق المتناقص */}
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#7FA1C4] flex items-center gap-1">
                <span><GlassIcon i="zap" size="xs" /></span> Exclusive One-Time Offer
              </span>
              <span className="text-xs font-mono font-black bg-black/40 px-2.5 py-1 rounded-lg border border-white/10 text-butter-up-300">
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
                  <span className="text-base font-black text-fog-600">${UPSELL_PRODUCT.dealPrice.toFixed(2)}</span>
                  <span className="text-xs text-gray-400 line-through">${UPSELL_PRODUCT.originalPrice.toFixed(2)}</span>
                  <span className="text-[10px] font-black bg-coral-500/20 text-coral-600 px-1.5 py-0.5 rounded">
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
                className="w-full bg-linear-to-r from-[#7FA1C4] to-coral-600 hover:brightness-110 text-white font-black py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-coral-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isUpsellProcessing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span><GlassIcon i="zap" size="xs" /></span> Yes! Add to My Parcel for $9.99
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
            className="w-full bg-[#2E4057] hover:bg-[#33475C] text-white py-3.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition shadow-md active:scale-95 cursor-pointer"
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
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8FB]">
        <div className="w-8 h-8 border-3 border-[#5B7EA6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}