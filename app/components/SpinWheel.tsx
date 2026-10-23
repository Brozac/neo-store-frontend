'use client';

import { useState, useEffect } from 'react';
import { useCart } from '../context/CartContext';

export default function SpinWheel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [rotation, setRotation] = useState(0);
  const { applyWheelDiscount } = useCart();

  useEffect(() => {
    try {
      const hasPlayed = localStorage.getItem('spinWheelPlayed');
      if (!hasPlayed) {
        const timer = setTimeout(() => setIsOpen(true), 6000);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, []);

  // ✨ نسب خصم واقعية ومحفزة للشراء (تم إلغاء ثغرة Free Ship 100% التي كانت تصفر الحساب!)
  const segments = [
    { text: '5% OFF', value: 5, color: '#5B7EA6', icon: '⭐' },
    { text: 'Try Again', value: 0, color: '#2E4057', icon: '😭' },
    { text: '10% OFF', value: 10, color: '#7FA1C4', icon: '🎁' },
    { text: '7% OFF', value: 7, color: '#357A8B', icon: '🔥' },
    { text: 'Try Again', value: 0, color: '#2E4057', icon: '😭' },
    { text: '15% VIP', value: 15, color: '#FFA500', icon: '👑' },
    { text: '5% OFF', value: 5, color: '#5B7EA6', icon: '🎉' },
    { text: '8% LUCKY', value: 8, color: '#7FA1C4', icon: '🍀' },
  ];

  const handleSpin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || isSpinning) return;

    setIsSpinning(true);
    setResult(null);

    // حفظ الإيميل في LocalStorage للتسويق
    try {
      localStorage.setItem('subscriber_email', email.trim());
    } catch (err) {}

    // اختيار الجائزة (ترجيح الفوز بنسبة 85% لرفع التحويل)
    const winningPool = segments.filter(s => s.value > 0);
    const selectedSegment = Math.random() > 0.15 
      ? winningPool[Math.floor(Math.random() * winningPool.length)]
      : segments.find(s => s.value === 0) || segments[0];

    const segmentIndex = segments.indexOf(selectedSegment);
    const segmentAngle = 360 / segments.length;
    // ضبط زاوية الدوران لمطابقة المؤشر العلوي بدقة
    const targetAngle = 360 * 5 + (360 - (segmentIndex * segmentAngle)) - (segmentAngle / 2);
    setRotation(prev => prev + targetAngle);

    setTimeout(async () => {
      setIsSpinning(false);
      setResult(selectedSegment.text);
      try {
        localStorage.setItem('spinWheelPlayed', 'true');
      } catch (err) {}

      // تطبيق الخصم الحقيقي في CartContext بأمان
      if (selectedSegment.value > 0) {
        // 🩹 WHEEL_V1 — claim token موقّع من السيرفر (النسبة العارية ما تتصادقش)
    try {
      const claimRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com'}/api/wheel/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pct: selectedSegment.value })
      });
      const claimData = await claimRes.json();
      if (claimData.wheelToken) sessionStorage.setItem('wheel_token', claimData.wheelToken);
    } catch (e) { /* claim فاشل = خصم بلا token — السيرفر كيرفضو بأمان */ }
    applyWheelDiscount(selectedSegment.value);
      }
    }, 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden border border-white/20">
        
        {/* Close Button */}
        <button 
          onClick={() => setIsOpen(false)} 
          className="absolute top-4 right-4 text-gray-400 hover:text-black transition cursor-pointer z-20 active:scale-90 p-2 text-sm font-bold"
        >
          ✕
        </button>

        {!result ? (
          <>
            <h2 className="text-2xl sm:text-3xl font-black text-temu-black mb-1 tracking-tight">
               Spin & Win Discounts!
            </h2>
            <p className="text-temu-gray-text text-xs sm:text-sm mb-6 font-medium">
              Enter your email to unlock your exclusive instant store discount.
            </p>
            
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto mb-6">
              {/* Spinning Wheel Body */}
              <div 
                className="absolute inset-0 rounded-full shadow-2xl border-4 border-white transition-transform duration-[4000ms] ease-out"
                style={{ 
                  transform: `rotate(${rotation}deg)`,
                  background: `conic-gradient(
                    ${segments.map((s, i) => `${s.color} ${i * 45}deg ${(i + 1) * 45}deg`).join(', ')}
                  )`
                }}
              >
                {segments.map((seg, i) => {
                  const angle = i * 45 + 22.5;
                  const rad = (angle - 90) * Math.PI / 180;
                  const x = 50 + 35 * Math.cos(rad);
                  const y = 50 + 35 * Math.sin(rad);
                  return (
                    <div 
                      key={i} 
                      className="absolute text-white text-center font-black select-none pointer-events-none"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: `translate(-50%, -50%) rotate(${angle}deg)`
                      }}
                    >
                      <span className="block text-xl mb-0.5 drop-shadow">{seg.icon}</span>
                      <span className="block text-[10px] uppercase tracking-tighter drop-shadow">{seg.text}</span>
                    </div>
                  );
                })}
              </div>
              
              {/* Indicator Arrow */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[22px] border-t-butter-up-400 z-20 drop-shadow-md"></div>
              
              {/* Spin Trigger Hub */}
              <button 
                onClick={handleSpin} 
                disabled={isSpinning || !email.trim()}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full shadow-2xl flex items-center justify-center font-black text-xs sm:text-sm text-temu-black border-4 border-gray-900 hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed z-20 cursor-pointer active:scale-95"
              >
                {isSpinning ? (
                  <div className="w-5 h-5 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
                ) : 'SPIN ⚡'}
              </button>
            </div>

            <form onSubmit={handleSpin} className="space-y-2">
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email to activate..."
                required
                disabled={isSpinning}
                className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-full px-5 py-3 text-xs text-temu-black placeholder-gray-400 focus:outline-none focus:border-temu-orange transition"
              />
              <p className="text-[10px] text-gray-400">Coupon applied automatically to your cart total upon winning.</p>
            </form>
          </>
        ) : (
          <div className="py-6 space-y-4">
            <div className="text-5xl animate-bounce">🎁</div>
            <h2 className="text-2xl font-black text-temu-black">Congratulations!</h2>
            <div className="p-4 bg-maroccan-tea-50 rounded-2xl border border-maroccan-tea-200">
              <p className="text-xl font-black text-maroccan-tea-600 mb-1">{result}</p>
              <p className="text-xs text-maroccan-tea-800 font-medium">Your discount has been activated in your shopping cart!</p>
            </div>
            
            <button 
              onClick={() => setIsOpen(false)}
              className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-3.5 px-6 rounded-full transition cursor-pointer active:scale-95 shadow-md text-xs uppercase tracking-wider"
            >
              Claim & Continue Shopping &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}