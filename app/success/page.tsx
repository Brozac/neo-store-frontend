'use client';

import { useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '../context/CartContext'; // ✨ تأكدي من المسار الصحيح للـ CartContext

// كومبوننت المحتوى الذي يقرأ الـ Query Parameters
function SuccessContent() {
  const searchParams = useSearchParams();
  const amount = parseFloat(searchParams.get('amount') || '0') || 0;
  
  // ✨ جلب دالة clearCart من الـ Context
  const { clearCart } = useCart();

  useEffect(() => {
    // 1. تفريغ السلة من الـ State و localStorage في نفس اللحظة
    clearCart();

    // 2. تتبع عملية الشراء لفيسبوك (Meta Pixel) بالمبلغ الحقيقي
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Purchase', {
        value: amount,
        currency: 'USD'
      });
    }

    // 3. تتبع عملية الشراء لتيك توك (TikTok Pixel) بالمبلغ الحقيقي
    if (typeof window !== 'undefined' && (window as any).ttq) {
      (window as any).ttq.track('CompletePayment', {
        value: amount,
        currency: 'USD'
      });
    }
  }, [amount, clearCart]); // إعادة التشغيل إذا تغير المبلغ

  return (
    <main className="min-h-screen bg-[#F4F3F8] flex items-center justify-center p-6 font-sans">
      <div className="bg-white border border-gray-100 shadow-2xl rounded-[2.5rem] p-8 max-w-md w-full text-center">
        
        {/* أيقونة النجاح بتصميم دائري ناعم وظل داخلي */}
        <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-emerald-50/50">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>

        {/* العنوان والوصف بتدرجات ألوان المتجر */}
        <h1 className="text-2xl font-extrabold text-[#1D1E3C] mb-2">Payment Successful!</h1>
        <p className="text-xs text-[#9A9AB0] font-medium leading-relaxed mb-8 px-4">
          Thank you for your purchase. We have successfully processed your transaction and are getting your order ready.
        </p>

        {/* زر العودة للمتجر بلون الـ Brand الأساسي */}
        <Link 
          href="/"
          className="w-full block bg-[#8B78C6] text-white py-4 rounded-2xl font-bold text-xs tracking-wide shadow-xl hover:bg-[#7a67b5] transition-all cursor-pointer text-center active:scale-95"
        >
          Return to Store
        </Link>
      </div>
    </main>
  );
}

// الصفحة الرئيسية التي تغلف المحتوى داخل Suspense (مطلوب في Next.js 16 لـ useSearchParams)
export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F4F3F8]">
        <div className="w-8 h-8 border-2 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}