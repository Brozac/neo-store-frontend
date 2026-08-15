'use client';
import { useState, useRef } from 'react';

export default function StarRating({ onChange }: { onChange: (rating: number) => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ratings = [
    { id: 1, name: 'Terrible' },
    { id: 2, name: 'Bad' },
    { id: 3, name: 'OK' },
    { id: 4, name: 'Good' },
    { id: 5, name: 'Excellent' }
  ];

  const handleClick = (value: number) => {
    setRating(value);
    onChange(value);
  };

  // ✨ تتبع حركة الإصبع لتعمية النجوم على الهواتف
  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch && containerRef.current) {
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const star = el?.closest('[data-star-value]');
      if (star) {
        const value = parseInt(star.getAttribute('data-star-value') || '0', 10);
        if (value > 0) {
          setHover(value);
        }
      }
    }
  };

  // ✨ عند رفع الإصبع، يتم تثبيت التقييم
  const handleTouchEnd = () => {
    if (hover > 0) {
      handleClick(hover);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={containerRef}
        className="flex relative pb-2" 
        onMouseLeave={() => setHover(0)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'manipulation' }}
      >
        {ratings.map((r) => {
          const isFilled = (hover || rating) >= r.id;
          return (
            <button
              key={r.id}
              type="button"
              data-star-value={r.id} // ✨ ضروري لتتبع الإصبع
              onClick={() => handleClick(r.id)}
              onMouseEnter={() => setHover(r.id)}
              className="p-2 cursor-pointer focus:outline-none transition-transform hover:scale-110 active:scale-110 touch-manipulation"
              aria-label={`${r.id} stars—${r.name}`}
            >
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 32 32" 
                aria-hidden="true"
                className={isFilled ? 'text-temu-error' : 'text-temu-gray-border-light'}
              >
                <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <g transform="translate(16,16) rotate(180)">
                    <polygon
                      points="0,15 4.41,6.07 14.27,4.64 7.13,-2.32 8.82,-12.14 0,-7.5 -8.82,-12.14 -7.13,-2.32 -14.27,4.64 -4.41,6.07"
                      fill="currentColor"
                      className="transition-all duration-300"
                    />
                  </g>
                </g>
              </svg>
            </button>
          );
        })}
      </div>
      <p className="text-sm font-medium text-temu-gray-text h-5">
        {hover ? ratings.find(r => r.id === hover)?.name : rating ? ratings.find(r => r.id === rating)?.name : ''}
      </p>
    </div>
  );
}