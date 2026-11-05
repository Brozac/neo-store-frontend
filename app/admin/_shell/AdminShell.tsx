'use client';

/**
 * ═══════════════════════════════════════════════════════════════════
 * 🛰️ LACLARC OPERATIONS SHELL — غرفة العمليات الموحدة (OpCenter v2)
 * ═══════════════════════════════════════════════════════════════════
 * هيكل واحد لكل صفحات /admin: سايدبار قيادة + توببار تليمتري حي.
 * - عدادات الأطابور حية كل 90 ثانية — null = مجهول (لا نكذب بـ 0 — DRS Tenet 3)
 * - toLocale* دائماً بعد الـ mount أو بـ suppressHydrationWarning (درس F#59)
 * - 401/403 → adminApi interceptor يوجّه لـ /admin/login تلقائياً
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import adminApi from '../../utils/adminApi';

interface QueueCounts {
  baridi: number | null;   // null = مجهول — لا نكذب بـ 0
  failed: number | null;
  disputes: number | null;
  ping: number;
  backend: 'checking' | 'healthy' | 'offline';
  lastChecked: string;
}

interface NavItem {
  id: string;
  href: string;
  label: string;
  ar: string;
  icon: string;
  badge?: (c: QueueCounts) => number | null;
  badgeTone?: 'alert' | 'warn';
}

interface NavGroup {
  ar: string;
  en: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    ar: 'القيادة',
    en: 'COMMAND',
    items: [
      { id: 'home', href: '/admin', label: 'Operations Room', ar: 'غرفة القيادة', icon: '⚡' },
      { id: 'orders', href: '/admin/orders', label: 'Orders Hub', ar: 'مركز الطلبات', icon: '📦' },
      { id: 'settings', href: '/admin/settings', label: 'Store Settings', ar: 'إعدادات المتجر', icon: '⚙️' },
      { id: 'visibility', href: '/admin/visibility', label: 'Visibility Control', ar: 'التحكم في الظهور', icon: '👁️' },
    ],
  },
  {
    ar: 'الأطابور',
    en: 'QUEUES',
    items: [
      { id: 'baridimob', href: '/admin/baridimob', label: 'BaridiMob Queue', ar: 'أطابور باريديموب', icon: '🇩🇿', badge: c => c.baridi, badgeTone: 'alert' },
      { id: 'failed-orders', href: '/admin/failed-orders', label: 'Failed in CJ', ar: 'الفاشلة', icon: '🚨', badge: c => c.failed, badgeTone: 'alert' },
      { id: 'disputes', href: '/admin/disputes', label: 'Disputes', ar: 'النزاعات', icon: '⚖️', badge: c => c.disputes, badgeTone: 'warn' },
    ],
  },
  {
    ar: 'الكتالوگ',
    en: 'CATALOG',
    items: [
      { id: 'manage', href: '/admin/manage', label: 'Products', ar: 'المنتجات', icon: '🛍️' },
      { id: 'payment-settings', href: '/admin/payment-settings', label: 'Payment Gateways', ar: 'بوابات الدفع', icon: '💳' },
    ],
  },
  {
    ar: 'الأنظمة',
    en: 'ENGINES',
    items: [
      { id: 'advanced', href: '/admin/advanced', label: 'CJ Financial Engine', ar: 'المحرك المالي CJ', icon: '🛠️' },
    ],
  },
];

const POLL_MS = 90_000;

export default function AdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [clock, setClock] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [counts, setCounts] = useState<QueueCounts>({
    baridi: null,
    failed: null,
    disputes: null,
    ping: 0,
    backend: 'checking',
    lastChecked: '--',
  });
  const navRef = useRef<HTMLDivElement>(null);

  // 🖱️ عجلة الموس → سكرول أفقي للناڤيگيشن (نفس نمط الداشبورد)
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 🕐 الساعة الحية — بعد الـ mount فقط (hydration آمن)
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB'));
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, []);

  const pollTelemetry = useCallback(async () => {
    const t0 = Date.now();
    // فشل وحدة ما ما يطيحش الباقي — كل أطابور مستقل (fail-visible: null)
    const [baridiRes, failedRes, disputesRes] = await Promise.all([
      adminApi.get('/admin/manual-orders').then(r => r.data).catch(() => null),
      adminApi.get('/admin/failed-orders').then(r => r.data).catch(() => null),
      adminApi.get('/admin/disputes').then(r => r.data).catch(() => null),
    ]);

    const countBaridi = Array.isArray(baridiRes)
      ? baridiRes.filter((o: any) => o.status === 'pending').length
      : null;
    const countFailed = Array.isArray(failedRes) ? failedRes.length : null;
    const dList = disputesRes?.data?.list ?? (Array.isArray(disputesRes?.data) ? disputesRes.data : null);
    const countDisputes = Array.isArray(dList)
      ? dList.filter((d: any) => {
          const s = String(d.status || '').toLowerCase();
          return s === 'processing' || s === 'pending' || s === 'open';
        }).length
      : null;

    const allNull = countBaridi === null && countFailed === null && countDisputes === null;

    setCounts({
      baridi: countBaridi,
      failed: countFailed,
      disputes: countDisputes,
      ping: Date.now() - t0,
      backend: allNull ? 'offline' : 'healthy',
      lastChecked: new Date().toLocaleTimeString('en-GB'),
    });
  }, []);

  useEffect(() => {
    pollTelemetry();
    const t = setInterval(pollTelemetry, POLL_MS);
    return () => clearInterval(t);
  }, [pollTelemetry]);

  // إغلاق الدروار عند تغيير الصفحة
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await adminApi.post('/admin/logout'); } finally { router.push('/admin/login'); }
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-linear-to-tr from-[#5F8271] to-[#C86F4E] rounded-xl flex items-center justify-center font-black text-white shadow-lg shrink-0">
            L
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-sm tracking-wide leading-tight">LACLARC OPS</p>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">غرفة العمليات v2</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map(group => (
          <div key={group.en}>
            <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
              {group.en} <span className="text-white/25 font-bold normal-case tracking-normal">· {group.ar}</span>
            </p>
            <div className="space-y-1">
              {group.items.map(item => {
                const active = pathname === item.href;
                const badgeVal = item.badge?.(counts) ?? null;
                const badgeHot = (badgeVal ?? 0) > 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => { router.push(item.href); setDrawerOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer active:scale-[0.98] ${
                      active
                        ? 'bg-linear-to-r from-[#5F8271] to-[#4E6F60] text-white shadow-lg shadow-black/20'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="text-base shrink-0 w-5 text-center">{item.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold leading-tight truncate">{item.label}</span>
                      <span className={`block text-[10px] leading-tight ${active ? 'text-white/60' : 'text-white/35'}`}>{item.ar}</span>
                    </span>
                    {badgeVal !== null && (
                      <span className={`shrink-0 min-w-6 h-6 px-1.5 rounded-full text-[11px] font-black flex items-center justify-center ${
                        badgeHot
                          ? (item.badgeTone === 'warn' ? 'bg-amber-400 text-amber-950' : 'bg-[#C86F4E] text-white animate-pulse')
                          : 'bg-white/10 text-white/40'
                      }`}>
                        {badgeVal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer — حالة النظام */}
      <div className="px-4 py-4 border-t border-white/10 space-y-2.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-2 font-bold text-white/60">
            <span className={`w-2 h-2 rounded-full ${
              counts.backend === 'healthy' ? 'bg-emerald-400 animate-pulse' : counts.backend === 'checking' ? 'bg-amber-400' : 'bg-red-500'
            }`}></span>
            Backend
          </span>
          <span suppressHydrationWarning className="font-mono text-white/40">{counts.ping}ms</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-white/60 font-bold">Last Pulse</span>
          <span suppressHydrationWarning className="font-mono text-white/40">{counts.lastChecked}</span>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full mt-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/20 text-red-300 text-xs font-black transition cursor-pointer active:scale-[0.98] disabled:opacity-50"
        >
          {loggingOut ? <div className="w-3.5 h-3.5 border-2 border-red-300 border-t-transparent rounded-full animate-spin"></div> : '🔒'} Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-temu-offwhite text-temu-black font-sans">
      {/* ═══ Desktop Sidebar ═══ */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#26332C] flex-col z-40">
        {SidebarContent}
      </aside>

      {/* ═══ Mobile Drawer ═══ */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[82vw] bg-[#26332C] h-full shadow-2xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* ═══ Content Column ═══ */}
      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-temu-offwhite/85 backdrop-blur-md border-b border-temu-gray-border-light">
          <div ref={navRef} className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 py-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open operations menu"
              className="lg:hidden w-10 h-10 shrink-0 rounded-xl bg-white border border-temu-gray-border-light flex items-center justify-center cursor-pointer active:scale-95 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-black text-temu-black truncate leading-tight">{title}</h1>
              {subtitle && <p className="text-[11px] text-gray-500 truncate hidden sm:block">{subtitle}</p>}
            </div>

            {/* Live pills */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => router.push('/admin/baridimob')}
                title="BaridiMob pending review"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-temu-gray-border-light text-[11px] font-bold text-temu-black cursor-pointer hover:border-[#5F8271]/50 transition"
              >
                🇩🇿
                <span className={counts.baridi !== null && counts.baridi > 0 ? 'text-[#C86F4E]' : 'text-gray-400'}>
                  {counts.baridi === null ? '—' : counts.baridi}
                </span>
              </button>
              <button
                onClick={() => router.push('/admin/failed-orders')}
                title="Orders failed in CJ"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-temu-gray-border-light text-[11px] font-bold text-temu-black cursor-pointer hover:border-[#5F8271]/50 transition"
              >
                🚨
                <span className={counts.failed !== null && counts.failed > 0 ? 'text-red-500' : 'text-gray-400'}>
                  {counts.failed === null ? '—' : counts.failed}
                </span>
              </button>
              <button
                onClick={() => router.push('/admin/disputes')}
                title="Open CJ disputes"
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-temu-gray-border-light text-[11px] font-bold text-temu-black cursor-pointer hover:border-[#5F8271]/50 transition"
              >
                ⚖️
                <span className={counts.disputes !== null && counts.disputes > 0 ? 'text-amber-600' : 'text-gray-400'}>
                  {counts.disputes === null ? '—' : counts.disputes}
                </span>
              </button>
              <span className="hidden md:inline font-mono text-[11px] text-gray-400" suppressHydrationWarning>{clock}</span>
              <button
                onClick={() => router.push('/')}
                title="Open storefront"
                className="w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full bg-white border border-temu-gray-border-light text-[11px] font-bold text-temu-black cursor-pointer hover:border-[#5F8271]/50 transition flex items-center justify-center gap-1.5"
              >
                🌐<span className="hidden sm:inline">Storefront</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 pb-24">
          {children}
        </main>
      </div>
    </div>
  );
}
