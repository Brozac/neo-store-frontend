'use client';

// ════════════════════════════════════════════════════════════════
// GlassDock [glassdock-v1] — الـ dock الزجاجي العائم ديال LaClarc
// (Kit 29h — شريط زجاجي مضبّب فأسفل الشاشة: الرئيسية · المتجر · السلة ·
//  الطلبات · التتبع — كيخفى أوتوماتيكياً فصفحات /admin)
// ════════════════════════════════════════════════════════════════

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Package, Radar, ShoppingBag, ShoppingCart, type LucideIcon } from 'lucide-react';

interface DockItem { href: string; label: string; Ico: LucideIcon }

const ITEMS: DockItem[] = [
  { href: '/', label: 'Home', Ico: House },
  { href: '/all-products', label: 'Shop', Ico: ShoppingBag },
  { href: '/cart', label: 'Cart', Ico: ShoppingCart },
  { href: '/orders', label: 'Orders', Ico: Package },
  { href: '/track-order', label: 'Track', Ico: Radar },
];

export default function GlassDock() {
  const pathname = usePathname();
  if (!pathname || pathname.startsWith('/admin')) return null;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-1 rounded-2xl border border-white/70 bg-white/65 backdrop-blur-xl px-2 py-1.5 shadow-[0_10px_36px_-10px_rgba(23,23,26,0.45),inset_0_1px_0_0_rgba(255,255,255,0.9)]"
    >
      {ITEMS.map(({ href, label, Ico }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all active:scale-90 ' +
              (active
                ? 'bg-[#6B3DB4] text-white shadow-[0_4px_14px_-4px_rgba(107,61,180,0.75)]'
                : 'text-gray-500 hover:bg-white/90 hover:text-[#6B3DB4]')
            }
          >
            <Ico size={19} strokeWidth={2.3} />
            <span className="text-[9px] font-bold leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
