'use client';

import React, { useRef, useState, ReactNode } from 'react';

export default function TiltCard({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  const [transform, setTransform] = useState('');
  const [glow, setGlow] = useState('radial-gradient(circle 400px at 50% -20%, rgba(255,255,255,0.3), rgba(0,0,0,0))');

  const handleMouseEnter = () => {
    if (cardRef.current) {
      setBounds(cardRef.current.getBoundingClientRect());
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!bounds) return;
    
    const mouseX = e.clientX - bounds.x;
    const mouseY = e.clientY - bounds.y;
    
    const centerX = mouseX - bounds.width / 2;
    const centerY = mouseY - bounds.height / 2;
    const distance = Math.sqrt(centerX ** 2 + centerY ** 2);

    setTransform(`
      scale3d(1.07, 1.07, 1.07)
      rotate3d(
        ${centerY / 100},
        ${-centerX / 100},
        0,
        ${Math.log(distance) * 3}deg
      )
    `);

    setGlow(`
      radial-gradient(
        circle 350px at ${mouseX}px ${mouseY}px,
        rgba(255, 255, 255, 0.9), 
        rgba(139, 120, 198, 0.2) 50%,
        rgba(0, 0, 0, 0) 100%
      )
    `);
  };

  const handleMouseLeave = () => {
    setBounds(null);
    setTransform('');
    setGlow('radial-gradient(circle 400px at 50% -20%, rgba(255,255,255,0.3), rgba(0,0,0,0))');
  };

  // دعم اللمس للهواتف المحمولة
  const handleTouchStart = (e: React.TouchEvent) => {
    if (cardRef.current) {
      setBounds(cardRef.current.getBoundingClientRect());
      // تطبيق التأثير فور لمس البطاقة بناءً على موقع الإصبع
      if (e.touches[0]) {
        handleTouchMove(e);
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!bounds || !e.touches[0]) return;
    
    const touch = e.touches[0];
    const mouseX = touch.clientX - bounds.x;
    const mouseY = touch.clientY - bounds.y;
    
    const centerX = mouseX - bounds.width / 2;
    const centerY = mouseY - bounds.height / 2;
    const distance = Math.sqrt(centerX ** 2 + centerY ** 2);

    setTransform(`
      scale3d(1.07, 1.07, 1.07)
      rotate3d(
        ${centerY / 100},
        ${-centerX / 100},
        0,
        ${Math.log(distance) * 3}deg
      )
    `);

    setGlow(`
      radial-gradient(
        circle 350px at ${mouseX}px ${mouseY}px,
        rgba(255, 255, 255, 0.9), 
        rgba(139, 120, 198, 0.2) 50%,
        rgba(0, 0, 0, 0) 100%
      )
    `);
  };

  const handleTouchEnd = () => {
    setBounds(null);
    setTransform('');
    setGlow('radial-gradient(circle 400px at 50% -20%, rgba(255,255,255,0.3), rgba(0,0,0,0))');
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: transform,
        transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
        transformStyle: 'preserve-3d',
        boxShadow: bounds ? '0 10px 30px 10px rgba(139, 120, 198, 0.4)' : '0 1px 5px rgba(0,0,0,0.1)',
        position: 'relative',
        willChange: 'transform',
        // ✨ السطر السحري: يسمح بتمرير الصفحة للأسفل/الأعلى دون أن تعيق البطاقة ذلك
        touchAction: 'pan-x pan-y',
      }}
      className="rounded-temu-sm overflow-hidden"
    >
      {children}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          left: 0,
          top: 0,
          backgroundImage: glow,
          pointerEvents: 'none',
          transition: 'background-image 50ms linear',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}