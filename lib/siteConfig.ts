// lib/siteConfig.ts — F#93 التحكم في الظهور (Visibility Control)
// ═══════════════════════════════════════════════════════════════════════
// المصدر الوحيد لشكل كونفيگ ظهور الموقع — مشترك كلاينت/سيرفر (بلا server-only).
//
// التخزين: KV/R2 binding تاع الـ Worker (نفس الرابط الحي — صفر إعداد جديد)
// → app/api/site-config/route.ts هو الباب الوحيد للقراءة العامة والكتابة الإدارية.
//
// القواعد:
//   · DEFAULT = كلشي ظاهر — غياب الكونفيگ أو فشل القراءة = فتح كامل (fail-open).
//     السبب: عطل الكونفيگ ما يحقش يطيح المتجر — الإخفاء يرجع تلقائياً عند أول نجاح.
//   · null/false معالجة صريحة: `cfg?.sections.hero !== false` هي القراءة الموحدة.
//   · hiddenCategories كتسجل slugPath كامل (l1/l2/l3) — نفس شكل product.category.
// ═══════════════════════════════════════════════════════════════════════

// ─── أقسام الصفحة الرئيسية ───
export interface HomeSectionsConfig {
  hero: boolean;            // بانر Hero + المنتجات المرشحة
  categoriesRail: boolean;  // شريط الأقسام الدائري (rail)
  deals: boolean;           // Lightning Deals (عروض البرق)
  reels: boolean;           // Watch & Shop reels (مزدوج مع show_reels الباك)
  trending: boolean;        // Trending Now (الأكورديون اللمسي)
}

// ─── فروع الموقع (الصفحات) ───
export type BranchId =
  | 'all-products'
  | 'categories'
  | 'category'
  | 'products'
  | 'track-order'
  | 'track'
  | 'exchange'
  | 'favorites'
  | 'orders'
  | 'profile'
  | 'review'
  | 'refund'
  | 'privacy'
  | 'terms'
  | 'cj-product'
  | 'cj-search';

export interface BranchMeta {
  id: BranchId;
  path: string;          // المسار المرجعي (للعرض)
  prefixes: string[];    // قواعد المطابقة — مطابقة بحدود المقطع (/track ما يبلعش /track-order)
  label: string;
  ar: string;
  desc: string;
  dangerous?: boolean;   // إخفاؤه كيقطع تجارة حية — يتطلب تأكيد
}

export const BRANCHES: BranchMeta[] = [
  {
    id: 'all-products', path: '/all-products', prefixes: ['/all-products'],
    label: 'All Products page', ar: 'صفحة كل المنتجات',
    desc: 'The dedicated all-products grid (3rd door of the catalog).',
  },
  {
    id: 'categories', path: '/categories', prefixes: ['/categories'],
    label: 'Departments hub', ar: 'دليل الأقسام',
    desc: 'The /categories SEO hub — hides it from menus AND blocks the page.',
  },
  {
    id: 'category', path: '/category/*', prefixes: ['/category'],
    label: 'Category product pages', ar: 'صفحات الأقسام',
    desc: 'Product listing pages under /category/… (governed per-category below too).',
  },
  {
    id: 'products', path: '/products/*', prefixes: ['/products'],
    label: 'Product detail pages', ar: 'صفحات المنتوجات',
    desc: '⚠️ DANGEROUS — every buy button dies. Only for maintenance windows.',
    dangerous: true,
  },
  {
    id: 'track-order', path: '/track-order', prefixes: ['/track-order'],
    label: 'Track shipment', ar: 'تتبع الشحنة',
    desc: 'Customer shipment tracking page.',
  },
  {
    id: 'track', path: '/track', prefixes: ['/track'],
    label: 'Legacy track page', ar: 'صفحة التتبع القديمة',
    desc: 'The older /track route (kept for old links).',
  },
  {
    id: 'exchange', path: '/exchange', prefixes: ['/exchange'],
    label: 'Exchange center', ar: 'مركز الاستبدال',
    desc: 'Exchange request flow (t= token pages included).',
  },
  {
    id: 'favorites', path: '/favorites', prefixes: ['/favorites'],
    label: 'Wishlist', ar: 'المفضلة',
    desc: 'Saved products page + its navbar/dock entries.',
  },
  {
    id: 'orders', path: '/orders', prefixes: ['/orders'],
    label: 'My orders', ar: 'طلباتي',
    desc: 'Customer order history page.',
  },
  {
    id: 'profile', path: '/profile', prefixes: ['/profile'],
    label: 'Account / profile', ar: 'الحساب',
    desc: 'Profile page + its dock entry (login stays available).',
  },
  {
    id: 'review', path: '/review', prefixes: ['/review'],
    label: 'Review page', ar: 'صفحة التقييم',
    desc: 'Post-order review flow (t= token pages included).',
  },
  {
    id: 'refund', path: '/refund', prefixes: ['/refund'],
    label: 'Refund policy', ar: 'سياسة الاسترجاع',
    desc: 'Refund & return policy page (footer link included).',
  },
  {
    id: 'privacy', path: '/privacy', prefixes: ['/privacy'],
    label: 'Privacy policy', ar: 'سياسة الخصوصية',
    desc: 'GDPR privacy page (footer link included).',
  },
  {
    id: 'terms', path: '/terms', prefixes: ['/terms'],
    label: 'Terms of service', ar: 'شروط الخدمة',
    desc: 'Terms page (footer link included).',
  },
  {
    id: 'cj-product', path: '/cj-product', prefixes: ['/cj-product'],
    label: 'CJ product lookup', ar: 'بحث CJ للمنتج',
    desc: 'Internal CJ sourcing lookup tool.',
  },
  {
    id: 'cj-search', path: '/cj-search', prefixes: ['/cj-search'],
    label: 'CJ catalog search', ar: 'بحث كتالوگ CJ',
    desc: 'Internal CJ catalog search tool.',
  },
  // ⛔ محجوزة للتجارة — لا يمكن إخفاؤها أبداً: /cart /checkout /success /cancel /auth
];

// ─── شكل الكونفيگ الكامل ───
export interface SiteVisibilityConfig {
  v: 1;
  updatedAt?: string;               // ISO — السيرفر كيكتبها عند الحفظ
  sections: HomeSectionsConfig;
  hiddenCategories: string[];       // slugPath كامل (l1 أو l1/l2 أو l1/l2/l3)
  branches: Record<BranchId, boolean>;
}

export const SECTION_META: { key: keyof HomeSectionsConfig; label: string; ar: string; desc: string; icon: string }[] = [
  { key: 'hero', label: 'Hero banner', ar: 'بانر الصفحة', icon: '🏛️', desc: 'The top hero section with trending picks on the homepage.' },
  { key: 'categoriesRail', label: 'Categories rail', ar: 'شريط الأقسام', icon: '🧭', desc: 'The round category rail under the hero (quick department switcher).' },
  { key: 'deals', label: 'Lightning Deals', ar: 'عروض البرق', icon: '⚡', desc: 'The flash deals carousel (products flagged as deals).' },
  { key: 'reels', label: 'Watch & Shop reels', ar: 'الريلز', icon: '🎬', desc: 'Video reels carousel. Also respects the backend show_reels key — both are kept in sync.' },
  { key: 'trending', label: 'Trending Now', ar: 'الأكثر رواجاً', icon: '🔥', desc: 'The touch-accordion trending strip on the homepage.' },
];

export const DEFAULT_CONFIG: SiteVisibilityConfig = {
  v: 1,
  sections: { hero: true, categoriesRail: true, deals: true, reels: true, trending: true },
  hiddenCategories: [],
  branches: Object.fromEntries(BRANCHES.map(b => [b.id, true])) as Record<BranchId, boolean>,
};

// ─── التحقق والتطبيع (الكتابة الإدارية تمر من هنا — fail-closed على الشكل) ───
const SLUG_RE = /^[a-z0-9][a-z0-9/_-]{0,199}$/;

export function sanitizeConfig(input: unknown): SiteVisibilityConfig | null {
  if (!input || typeof input !== 'object') return null;
  const i = input as Record<string, unknown>;

  const sectionsIn = (i.sections && typeof i.sections === 'object' ? i.sections : {}) as Record<string, unknown>;
  const sections: HomeSectionsConfig = { ...DEFAULT_CONFIG.sections };
  for (const key of Object.keys(DEFAULT_CONFIG.sections) as (keyof HomeSectionsConfig)[]) {
    const v = sectionsIn[key];
    if (typeof v === 'boolean') sections[key] = v;
  }

  let hiddenCategories: string[] = [];
  if (Array.isArray(i.hiddenCategories)) {
    hiddenCategories = [...new Set(
      i.hiddenCategories
        .filter((s): s is string => typeof s === 'string')
        .map(s => s.trim().toLowerCase().replace(/^\/+|\/+$/g, ''))
        .filter(s => SLUG_RE.test(s))
    )].slice(0, 300);
  }

  const branches: Record<BranchId, boolean> = { ...DEFAULT_CONFIG.branches };
  const branchesIn = (i.branches && typeof i.branches === 'object' ? i.branches : {}) as Record<string, unknown>;
  for (const b of BRANCHES) {
    const v = branchesIn[b.id];
    if (typeof v === 'boolean') branches[b.id] = v;
  }

  return { v: 1, sections, hiddenCategories, branches };
}

// ─── مطابقة الفروع — بحدود المقطع: /track ما تبلعش /track-order ───
export function matchHiddenBranch(pathname: string, branches: Record<BranchId, boolean>): BranchId | null {
  if (!pathname) return null;
  for (const b of BRANCHES) {
    if (branches[b.id] !== false) continue;
    for (const p of b.prefixes) {
      if (pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?')) return b.id;
    }
  }
  return null;
}

// ─── مطابقة الأقسام المخفية — product.category = "l1/l2/l3" ───
// مخفي إذا: مساوي للـ slugPath المخفي، أو تحت أحد الأقسام المخفية (شجرة كاملة).
export function isCategoryHidden(productCategory: unknown, hidden: string[] | undefined | null): boolean {
  if (!hidden || hidden.length === 0 || !productCategory) return false;
  const cat = String(productCategory).trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!cat) return false;
  for (const h of hidden) {
    if (cat === h || cat.startsWith(h + '/')) return true;
  }
  return false;
}

// ─── قراءة الكلاينت — sessionStorage TTL + fetch ───
const SS_KEY = 'laclarc_sitecfg_v1';
const SS_TTL_MS = 60_000; // دقيقة واحدة — متناسقة مع s-maxage=60 تاع الراوت (التغييرات توصل ≤ 2 دقيقة)

interface SSCache { t: number; cfg: SiteVisibilityConfig }

export async function fetchSiteConfig(opts: { force?: boolean } = {}): Promise<SiteVisibilityConfig> {
  if (!opts.force && typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SSCache;
        if (parsed?.cfg?.v === 1 && Date.now() - parsed.t < SS_TTL_MS) return parsed.cfg;
      }
    } catch { /* sessionStorage ميت (private mode) — نكمل بfetch */ }
  }

  const res = await fetch('/api/site-config', { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  const cfg = sanitizeConfig(json?.config) ?? { ...DEFAULT_CONFIG };

  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify({ t: Date.now(), cfg }));
  } catch { /* ignore */ }
  return cfg;
}
