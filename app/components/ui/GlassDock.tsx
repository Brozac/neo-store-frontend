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
      className="gdock-glass fixed bottom-3 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-0.5 rounded-3xl border border-fog-200/80 bg-white/92 backdrop-blur-2xl px-2 py-1.5 shadow-[0_14px_34px_rgba(91,126,166,0.18),inset_0_1px_0_0_rgba(255,255,255,0.95)]"
    >
      {ITEMS.map(({ href, label, Ico }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all active:scale-90 ' +
              (active
                ? 'bg-fog-200 text-fog-700 font-extrabold'
                : 'text-temu-gray-text hover:bg-fog-50 hover:text-fog-600')
            }
          >
            <Ico size={19} strokeWidth={active ? 2.4 : 1.9} />
            <span className="text-[9px] font-bold leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
