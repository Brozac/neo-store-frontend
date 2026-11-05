'use client';

/**
 * ═══════════════════════════════════════════════════════════════════
 * 👁️ LACLARC SITE VISIBILITY — F#93 التحكم في الظهور (Provider + Gate)
 * ═══════════════════════════════════════════════════════════════════
 * Provider واحد فوق شجرة المتجر:
 *   · fetch مرة واحدة / جلسة (sessionStorage TTL 120s) من /api/site-config
 *   · cfg = null حتى الجلب — كل القراءات `cfg?.x !== false` (fail-open:
 *     الكونفيگ المفقود ما يطيحش المتجر — الإخفاء يرجع عند أول نجاح)
 *   · BranchGate كيحجب فروع الموقع المخفية: لوحة "غير متاح مؤقتاً" مكان
 *     الصفحة كاملة (بلا navbar/footer/dock) — /admin مستثناة دايماً.
 *
 * الاستعمال في أي كلاينت كومبوننت:
 *   const { cfg, ready } = useSiteConfig();
 *   {cfg?.sections.hero !== false && <HeroSection …/>}
 *   isCategoryHidden(product.category, cfg?.hiddenCategories)
 * ═══════════════════════════════════════════════════════════════════
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  fetchSiteConfig, matchHiddenBranch, type SiteVisibilityConfig, type BranchId, BRANCHES,
} from '@/lib/siteConfig';

interface SiteConfigCtx {
  cfg: SiteVisibilityConfig | null;   // null = لسه ما وصلش / فشل → fail-open
  ready: boolean;                     // true = أول محاولة قراءة كملت (نجاح أو فشل)
  refresh: () => Promise<void>;       // إعادة جلب قسرية (بلا كاش)
}

const Ctx = createContext<SiteConfigCtx>({ cfg: null, ready: false, refresh: async () => {} });

export function useSiteConfig(): SiteConfigCtx {
  return useContext(Ctx);
}

export function UnavailablePanel({ branch, refLabel }: { branch?: BranchId; refLabel?: string }) {
  const meta = branch ? BRANCHES.find(b => b.id === branch) : undefined;
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="bg-white border border-temu-gray-border-light rounded-2xl shadow-sm p-10 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-serene-mint flex items-center justify-center text-2xl">
          🚧
        </div>
        <h1 className="text-lg font-black text-temu-black">Temporarily unavailable</h1>
        <p className="text-sm text-temu-gray-text leading-relaxed">
          This part of the store is closed for now. Everything else is still open — welcome back anytime.
        </p>
        <p className="text-xs text-gray-400" dir="rtl" lang="ar">
          هذا القسم مغلق مؤقتاً — بقية المتجر مفتوحة وعاكلة.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#5F8271] hover:bg-[#4E6F60] text-white font-extrabold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition active:scale-95"
        >
          Back to the store
        </Link>
        {meta && <p className="text-[10px] text-gray-300 font-mono pt-2">ref: {meta.path}</p>}
        {!meta && refLabel && <p className="text-[10px] text-gray-300 font-mono pt-2">ref: {refLabel}</p>}
      </div>
    </div>
  );
}

export default function SiteConfigProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<SiteVisibilityConfig | null>(null);
  const [ready, setReady] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      const next = await fetchSiteConfig({ force });
      setCfg(next);
    } catch {
      // فشل الشبكة = fail-open (cfg يبقى null) — المتجر كامل ظاهر
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return (
    <Ctx.Provider value={{ cfg, ready, refresh }}>
      <BranchGate>{children}</BranchGate>
    </Ctx.Provider>
  );
}

/** حاجز الفروع — كيبدل الصفحة المخفية كاملة بلوحة "غير متاح مؤقتاً" */
function BranchGate({ children }: { children: React.ReactNode }) {
  const { cfg, ready } = useSiteConfig();
  const pathname = usePathname();

  const hidden = ready && cfg && pathname && !pathname.startsWith('/admin')
    ? matchHiddenBranch(pathname, cfg.branches)
    : null;

  if (hidden) return <UnavailablePanel branch={hidden} />;
  return <>{children}</>;
}
