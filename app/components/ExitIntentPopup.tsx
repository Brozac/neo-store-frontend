'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GlassIcon from '@/components/ui/GlassIcon';

export default function ExitIntentPopup() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 دقائق
  const [claimed, setClaimed] = useState(false);
  // ✨ state فاري default — القراءة ديال localStorage كتتم غير داخل useEffect
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // ✨✨ كل شي كيلمس المتصفح (localStorage/sessionStorage) هنا فقط —
    // الـ useEffect عمرو مايتنفذ فالـ SSR/prerender

    // تخصيص بالاسم إلا كان المستخدم مسجل
    try {
      const userData = JSON.parse(localStorage.getItem('user_data') || 'null');
      setUserName(userData?.name?.split(' ')[0] || '');
    } catch {
      // user_data تالف — نتجاهلو بصمت
    }

    if (sessionStorage.getItem('exit_intent_shown')) return;

    const cartItems = JSON.parse(localStorage.getItem('cart') || '[]');
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return; // سلة خاوية → بلا بوب
    }

    let shown = false;
    const markShown = () => {
      if (shown) return;
      shown = true;
      sessionStorage.setItem('exit_intent_shown', 'true');
      setIsOpen(true);
    };

    // 1. ديسكتوب: نية الخروج (الماوس طالع)
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 15) markShown();
    };

    // 2. موبايل: بدل التاب/قرّب التطبيق
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') markShown();
    };

    // 3. موبايل احتياط: خمول 45 ثانية بلا تفاعل
    let idleTimer: ReturnType<typeof setTimeout>;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(markShown, 45000);
    };
    resetIdle();
    const idleEvents: (keyof WindowEventMap)[] = ['scroll', 'touchstart', 'click'];
    idleEvents.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));

    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibility);
      idleEvents.forEach((ev) => window.removeEventListener(ev, resetIdle));
      clearTimeout(idleTimer);
    };
  }, []);

  // عداد التنازلي
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

  const handleClaim = () => {
    setClaimed(true);
    sessionStorage.setItem('laclarc_coupon', 'LACLARC10');
    setTimeout(() => {
      setIsOpen(false);
      router.push('/cart');
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
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition active:scale-90 text-sm font-bold"
          aria-label="Close"
        >
          <GlassIcon i="x" size="xs" />
        </button>

        <div className="w-14 h-14 bg-[#FF6B9D]/20 text-[#FF6B9D] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3 border border-[#FF6B9D]/30">
          <GlassIcon ch="🎁" size="xs" />
        </div>

        <span className="text-[10px] font-black uppercase tracking-widest bg-black/40 text-[#FF6B9D] px-3 py-1 rounded-full border border-white/10 inline-block mb-1">
          Limited Exit Offer &bull; Expires in {formatTimer(timeLeft)}
        </span>

        <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mt-2">
          {userName ? `Wait ${userName}! ` : 'Wait! '}Don&apos;t Leave Empty Handed...
        </h2>

        <p className="text-xs text-gray-300 leading-relaxed max-w-sm mx-auto mt-2">
          Take an extra <strong className="text-[#8B78C6]">10% OFF</strong> on your entire purchase right now. Valid for the next 10 minutes only!
        </p>

        <div className="bg-white/5 border border-dashed border-[#8B78C6] p-3.5 rounded-2xl my-4">
          <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Use Code at Checkout:</span>
          <span className="font-mono font-black text-lg sm:text-xl text-white tracking-widest bg-[#8B78C6]/30 px-4 py-1 rounded-xl border border-[#8B78C6]/40 inline-block">
            LACLARC10
          </span>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleClaim}
            disabled={claimed}
            className="w-full bg-linear-to-r from-[#FF6B9D] to-rose-600 hover:brightness-110 text-white font-black py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-pink-500/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {claimed ? (
              <><span><GlassIcon i="check" size="xs" /></span> 10% Discount Applied!</>
            ) : (
              <><span><GlassIcon i="zap" size="xs" /></span> Claim 10% &amp; Shop Now</>
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