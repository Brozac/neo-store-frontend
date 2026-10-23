'use client';

import React, { useRef, useState, ReactNode } from 'react';

export default function TiltCard({ children }: { children: ReactNode }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<DOMRect | null>(null);
  const [hovering, setHovering] = useState(false);   // فقط للـ box-shadow toggle — state واحد رخيص

  const updateTilt = (clientX: number, clientY: number) => {
    const el = cardRef.current;
    if (!el) return;
    const b = boundsRef.current;
    if (!b) return;

    const mouseX = clientX - b.x;
    const mouseY = clientY - b.y;
    const centerX = mouseX - b.width / 2;
    const centerY = mouseY - b.height / 2;
    const distance = Math.sqrt(centerX ** 2 + centerY ** 2);

    // 🚀 مباشرة على الـ DOM — صفر re-render، GPU-accelerated
    el.style.transform = `
      scale3d(1.07, 1.07, 1.07)
      rotate3d(
        ${centerY / 100},
        ${-centerX / 100},
        0,
        ${Math.log(distance) * 3}deg
      )
    `;
    if (glowRef.current) {
      glowRef.current.style.backgroundImage = `
        radial-gradient(
          circle 350px at ${mouseX}px ${mouseY}px,
          rgba(255, 255, 255, 0.9),
          rgba(91,126,166, 0.2) 50%,
          rgba(0, 0, 0, 0) 100%
        )
      `;
    }
  };

  const handleMouseEnter = () => {
    if (cardRef.current) {
      boundsRef.current = cardRef.current.getBoundingClientRect();
      setHovering(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    updateTilt(e.clientX, e.clientY);
  };

  const handleMouseLeave = () => {
    boundsRef.current = null;
    setHovering(false);
    if (cardRef.current) cardRef.current.style.transform = '';
    if (glowRef.current) glowRef.current.style.backgroundImage =
      'radial-gradient(circle 400px at 50% -20%, rgba(255,255,255,0.3), rgba(0,0,0,0))';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (cardRef.current) {
      boundsRef.current = cardRef.current.getBoundingClientRect();
      setHovering(true);
      if (e.touches[0]) updateTilt(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) updateTilt(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = handleMouseLeave;

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
        transition: 'transform 150ms ease-out, box-shadow 150ms ease-out',
        transformStyle: 'preserve-3d',
        boxShadow: hovering ? '0 10px 30px 10px rgba(91,126,166, 0.4)' : '0 1px 5px rgba(0,0,0,0.1)',
        position: 'relative',
        willChange: 'transform',
        touchAction: 'pan-x pan-y',
      }}
      className="rounded-temu-sm overflow-hidden"
    >
      {children}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          left: 0,
          top: 0,
          backgroundImage: 'radial-gradient(circle 400px at 50% -20%, rgba(255,255,255,0.3), rgba(0,0,0,0))',
          pointerEvents: 'none',
          transition: 'background-image 50ms linear',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
}