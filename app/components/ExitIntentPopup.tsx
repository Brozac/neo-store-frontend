'use client';

import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';
import { useRouter } from 'next/navigation';

export default function ExitIntentPopup() {
  const router = useRouter();
  const { applyWheelDiscount, cartTotal } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 دقائق (600 ثانية)
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    const hasShown = sessionStorage.getItem('exit_intent_shown');
    if (hasShown) return;

    // 1. رصد حركة الماوس نحو أعلى الشاشة على أجهزة الحاسوب
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 15 && !sessionStorage.getItem('exit_intent_shown')) {
        setIsOpen(true);
        sessionStorage.setItem('exit_intent_shown', 'true');
      }
    };

    // 2. مؤقت خمول احتياطي للأجهزة الذكية (الهواتف) بعد 35 ثانية
    const mobileTimer = setTimeout(() => {
      if (!sessionStorage.getItem('exit_intent_shown')) {
        setIsOpen(true);
        sessionStorage.setItem('exit_intent_shown', 'true');
      }
    }, 35000);

    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(mobileTimer);
    };
  }, []);

  // عداد الـ 10 دقائق المتناقص
  useEffect(() => {
    if (!isOpen) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsOpen(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // تطبيق الخصم ومتابعة التسوق بنقرة زر واحدة
  const handleClaim = () => {
    setClaimed(true);
    // تفعيل خصم 10% في السلة مباشرة
    applyWheelDiscount(10);

    setTimeout(() => {
      setIsOpen(false);
      // إذا كانت السلة تحتوي على منتجات، نوجهه لإنهاء الدفع فوراً
      if (cartTotal > 0) {
        router.push('/cart');
      }
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="bg-linear-to-br from-[#1D1E3C] to-[#2D2E5C] text-white border-2 border-[#8B78C6] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-center overflow-hidden animate-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 text-sm font-bold"
          aria-label="Close"
        >
          ✕
        </button>

        {/* أيقونة العرض (باللون الوردي Laclarc) */}
        <div className="w-14 h-14 bg-[#FF6B9D]/20 text-[#FF6B9D] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 border border-[#FF6B9D]/30">
          🎁
        </div>

        {/* العداد والتحذير */}
        <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 text-[#FF6B9D] px-3 py-1 rounded-full border border-white/10 inline-block mb-1">
          Limited Exit Offer &bull; Expires in {formatTimer(timeLeft)}
        </span>

        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mt-2">
          Wait! Don&apos;t Leave Empty Handed...
        </h2>

        <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto mt-2">
          Take an extra <strong className="text-[#8B78C6]">10% OFF</strong> on your entire purchase right now. Valid for the next 10 minutes only!
        </p>

        {/* بطاقة كود الخصم */}
        <div className="bg-white/5 border border-dashed border-[#8B78C6] p-3.5 rounded-2xl my-4">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Use Code at Checkout:</span>
          <span className="font-mono font-black text-lg sm:text-xl text-white tracking-widest bg-[#8B78C6]/30 px-4 py-1 rounded-xl border border-[#8B78C6]/40 inline-block">
            LACLARC10
          </span>
        </div>

        {/* أزرار الإجراء */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleClaim}
            disabled={claimed}
            className="w-full bg-linear-to-r from-[#FF6B9D] to-rose-600 hover:brightness-110 text-white font-black py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {claimed ? (
              <><span>✓</span> 10% Discount Applied!</>
            ) : (
              <><span>⚡</span> Claim 10% & Shop Now</>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-[11px] text-gray-400 hover:text-white transition py-1 cursor-pointer"
          >
            No thanks, I prefer paying full price
          </button>
        </div>

      </div>
    </div>
  );
}