'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import {
  HomeIcon, SearchIcon, BagIcon, TrackIcon,
  ProfileIcon, HeartIcon,
} from './icons/LaclarcIcons';

interface DockItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  activeMatch?: (path: string) => boolean;
  badge?: number;
}

export default function GlassDock() {
  const pathname = usePathname();
  const { totalItemsCount, isMounted } = useCart();
  const itemsRef = useRef<HTMLDivElement>(null);

  // 🖱️ حساب المسافة من الماوس لكل عنصر — يحدّث --d على كل عنصر
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const dock = itemsRef.current;
    if (!dock) return;
    const items = Array.from(
      dock.querySelectorAll<HTMLElement>('.gdock-item')
    ) as HTMLElement[];
    const rect = dock.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    items.forEach((item: HTMLElement) => {
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.left - rect.left + itemRect.width / 2;
      const distance = Math.abs(mouseX - itemCenter) / itemRect.width;
      item.style.setProperty('--d', distance.toFixed(2));
    });
  };

  const handleMouseLeave = () => {
    const dock = itemsRef.current;
    if (!dock) return;
    dock
      .querySelectorAll<HTMLElement>('.gdock-item')
      .forEach((item: HTMLElement) => {
        item.style.setProperty('--d', '3'); // خارج نطاق التأثير
      });
  };

    const ITEMS: DockItem[] = [
    {
      href: '/',
      icon: <HomeIcon size={24} active={pathname === '/'} />,
      label: 'Home',
      activeMatch: (p) => p === '/',
    },
    {
      href: '/categories',
      icon: <SearchIcon size={24} active={pathname?.startsWith('/categories') || false} />,
      label: 'Browse',
      activeMatch: (p) => p.startsWith('/categories'),
    },
    {
      href: '/cart',
      icon: <BagIcon
        size={24}
        active={pathname === '/cart'}
        badge={isMounted && totalItemsCount > 0}
      />,
      label: 'Cart',
      badge: isMounted && totalItemsCount > 0 ? totalItemsCount : undefined,
    },
    {
      href: '/track-order',
      icon: <TrackIcon size={24} active={pathname?.startsWith('/track') || false} />,
      label: 'Track',
      activeMatch: (p) => p.startsWith('/track'),
    },
    {
      href: '/favorites',
      icon: <HeartIcon size={24} active={pathname?.startsWith('/favorites') || false} />,
      label: 'Wishlist',
      activeMatch: (p) => p.startsWith('/favorites'),
    },

    {
      href: '/profile',
      icon: <ProfileIcon size={24} active={pathname?.startsWith('/profile') || false} />,
      label: 'Profile',
      activeMatch: (p) => p.startsWith('/profile') || p.startsWith('/orders'),
    },
  ];

  return (
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 pointer-events-none pb-[env(safe-area-inset-bottom)]">      <div
        className="pointer-events-auto gdock-glass rounded-full px-3 py-2.5 flex items-center gap-1"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div ref={itemsRef} className="flex items-center gap-1 relative">
          {ITEMS.map((item) => {
            const isActive = item.activeMatch?.(pathname || '') ?? false;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="gdock-item relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl text-temu-gray-text hover:text-temu-black transition-colors cursor-pointer"
                title={item.label}
              >
                {/* المؤشر النشط — نقطة تحت الأيقونة */}
                <span
                  className={`gdock-glyph relative z-10 transition-colors ${
                    isActive ? 'text-temu-orange' : ''
                  }`}
                >
                  {item.icon}
                </span>
                {isActive && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-temu-orange" />
                )}

                {/* Badge السلة */}
                {typeof item.badge === 'number' && (
                  <span className="absolute -top-0.5 -right-0.5 bg-temu-error text-white text-[9px] font-black min-w-4.5 h-4.5 flex items-center justify-center rounded-full border-2 border-white shadow-md">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}

                {/* Tooltip — يظهر مع hover */}
                <span className="gdock-tip absolute -top-9 bg-[#1D1E3C] text-white text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap pointer-events-none opacity-0 transition-opacity">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CSS — فيزياء Bencho (raised cosine magnification) */}
      <style jsx global>{`
        .gdock-glass {
          background: rgba(255, 255, 255, 0.82);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow:
            0 8px 32px rgba(29, 30, 60, 0.12),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        /* 🔥 الفيزياء — raised cosine على المسافة من الماوس */
        .gdock-glyph {
          --f: max(0, (1 + cos(180deg * var(--d) / 3)) / 2);
          transform: translateY(calc(8px * var(--f) * -1))
                     scale(calc(1 + 1.32 * var(--f) - var(--f)));
          transform-origin: 50% 100%;
          transition: transform 220ms cubic-bezier(0.32, 0.72, 0.24, 1);
        }

        /* الرمز يكبر — لا الزر كله (badge/label ثابتان) */
        .gdock-item { transform: none; }

        /* Tooltip يظهر مع hover */
        .gdock-item:hover .gdock-tip {
          opacity: 1;
          transition-delay: 150ms;
        }

        /* موبايل — أحجام أصغر (CSS خام — بصيغة صحيحة) */
        @media (max-width: 640px) {
          .gdock-item {
            width: 3rem;
            height: 3rem;
          }
        }
      `}</style>
    </div>
  );
}