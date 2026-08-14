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
    const hasPlayed = localStorage.getItem('spinWheelPlayed');
    if (!hasPlayed) {
      const timer = setTimeout(() => setIsOpen(true), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const segments = [
    { text: '10% OFF', value: 10, color: '#FFA500', icon: '🎉' },
    { text: 'Try Again', value: 0, color: '#1D1E3C', icon: '😭' },
    { text: '15% OFF', value: 15, color: '#FF6B9D', icon: '🎁' },
    { text: '5% OFF', value: 5, color: '#8B78C6', icon: '⭐' },
    { text: '20% OFF', value: 20, color: '#357A8B', icon: '🔥' },
    { text: 'Try Again', value: 0, color: '#1D1E3C', icon: '😭' },
    { text: '10% OFF', value: 10, color: '#FF6B9D', icon: '🎉' },
    { text: 'Free Ship', value: 100, color: '#8B78C6', icon: '🚚' },
  ];

  const handleSpin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSpinning) return;

    setIsSpinning(true);
    setResult(null);

    const randomIndex = Math.floor(Math.random() * segments.length);
    const selectedSegment = segments[randomIndex];
    
    const segmentAngle = 360 / segments.length;
    const targetAngle = 360 * 5 + (360 - (randomIndex * segmentAngle)) - (segmentAngle / 2);
    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      setIsSpinning(false);
      setResult(selectedSegment.text);
      localStorage.setItem('spinWheelPlayed', 'true');

      if (selectedSegment.value > 0) {
        applyWheelDiscount(selectedSegment.value);
      }
    }, 4000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-100 p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden">
        {/* ✨ زر الإغلاق مع تأثير اللمس */}
        <button 
          onClick={() => setIsOpen(false)} 
          className="absolute top-4 right-4 text-temu-gray-light hover:text-temu-black transition cursor-pointer z-10 active:scale-90"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        {!result ? (
          <>
            <h2 className="text-3xl font-extrabold text-temu-black mb-2">🎉 Spin & Win!</h2>
            <p className="text-temu-gray-text text-sm mb-6">Enter your email to spin the wheel and win exclusive discounts!</p>
            
            <div className="relative w-72 h-72 mx-auto mb-6">
              {/* ✨ تصحيح مدة الانتقال إلى duration-[4000ms] */}
              <div 
                className="absolute inset-0 rounded-full shadow-xl transition-transform duration-4000 ease-out"
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
                      className="absolute text-white text-center font-bold"
                      style={{
                        left: `${x}%`,
                        top: `${y}%`,
                        transform: `translate(-50%, -50%) rotate(${angle}deg)`
                      }}
                    >
                      <span className="block text-2xl mb-1 drop-shadow-md">{seg.icon}</span>
                      <span className="block text-[10px] drop-shadow-md">{seg.text}</span>
                    </div>
                  );
                })}
              </div>
              
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-12 border-l-transparent border-r-12 border-r-transparent border-t-24 border-t-[#FFA500] z-20 drop-shadow-lg"></div>
              
              {/* ✨ زر الدوران مع تأثير اللمس */}
              <button 
                onClick={handleSpin} 
                disabled={isSpinning || !email}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white rounded-full shadow-2xl flex items-center justify-center font-extrabold text-temu-black border-4 border-temu-black hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed z-20 cursor-pointer active:scale-95 touch-manipulation"
              >
                {isSpinning ? (
                  <div className="w-6 h-6 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
                ) : 'SPIN'}
              </button>
            </div>

            <form onSubmit={handleSpin}>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={isSpinning}
                className="w-full bg-temu-offwhite border-2 border-temu-gray-border-light rounded-full px-6 py-3 text-sm focus:outline-none focus:border-temu-orange mb-2 transition"
              />
              <p className="text-xs text-temu-gray-light">By playing, you agree to receive marketing emails.</p>
            </form>
          </>
        ) : (
          <div className="py-8">
            <div className="text-6xl mb-4">🎁</div>
            <h2 className="text-3xl font-extrabold text-temu-black mb-2">Congratulations!</h2>
            <p className="text-xl font-bold text-temu-error mb-6">{result}</p>
            
            {result.includes('%') || result.includes('Ship') ? (
              <div className="bg-temu-offwhite border-2 border-dashed border-temu-orange rounded-xl p-4 mb-6">
                <p className="text-sm text-temu-gray-text">Discount applied automatically to your cart!</p>
              </div>
            ) : (
              <p className="text-temu-gray-text mb-6">You didn't win a discount this time. Better luck next time!</p>
            )}

            {/* ✨ زر المتابعة مع تأثير اللمس */}
            <button 
              onClick={() => setIsOpen(false)}
              className="bg-temu-black text-white font-bold py-3 px-8 rounded-full hover:bg-temu-dark transition cursor-pointer active:scale-95 shadow-md"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  );
}