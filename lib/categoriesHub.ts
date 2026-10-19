// lib/categoriesHub.ts — Section 4: data layer ديال hub /categories
//
// السُلّم ديال الـ fallback (الصفحة كتعمر تخدم):
//   1) /api/categories/hub   ← الأفضل: شجرة + counts حقيقية + صور الجذور
//   2) /api/categories       ← الشجرة برك (بلا counts) — الروابط كاملين SSR
//   3) null                  ← الصفحة كترجع للسلوك القديم (client fetch)
//
// التخزين المؤقت: Data Cache ديال Next (revalidate 21600 = 6 سوايع)
// — نفس TTL ديال الكاش ديال الباكند → اتساق كامل.
import { cache } from 'react';

export interface HubNode {
  id: number;
  name: string;
  slug: string;
  /** المسار الكامل من الجذر — المصدر الحقيقي للـ URL: /category/{slugPath} */
  slugPath: string;
  /** عدد المنتجات (stock_status=true) — null إلا الباكند ما عطاهاش */
  count: number | null;
  /** صورة تمثيلية (للجذور) — من نفس نمط /api/categories */
  image_url: string | null;
  children: HubNode[];
}

export interface CategoriesHub {
  nodes: HubNode[];
  /** true = counts حقيقية من /api/categories/hub */
  counts: boolean;
  totals: { categories: number; products: number } | null;
}

interface RawNode {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  slugPath?: unknown;
  count?: unknown;
  image_url?: unknown;
  children?: RawNode[];
}

// ✨ Tenet #4 — بلا hardcoded URLs (نفس نمط lib/categorySeo.ts)
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://neo-store-backend.onrender.com';

async function getJSON(path: string): Promise<unknown> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 21600 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // فشل الـ data ماكيطيحش الصفحة — السُلّم كيكمل
  }
}

/**
 * كنبنيو slugPath كامل من الجذر (l1/l2/l3) — نحسبوه من الشجرة ديما،
 * حتى إلا جا من hub endpoint (idempotent — نفس القيمة).
 * هادا هو اللي كيمنع باغ الـ sitemap القديم (روابط مبسطين بلا أب).
 */
function buildNodes(raw: RawNode[] | undefined, prefix = ''): HubNode[] {
  const out: HubNode[] = [];
  for (const n of raw || []) {
    if (!n || typeof n.slug !== 'string' || !n.slug) continue;
    const slugPath = prefix ? `${prefix}/${n.slug}` : n.slug;
    out.push({
      id: typeof n.id === 'number' ? n.id : 0,
      name: typeof n.name === 'string' && n.name ? n.name : n.slug,
      slug: n.slug,
      slugPath,
      count: typeof n.count === 'number' && Number.isFinite(n.count) && n.count >= 0 ? n.count : null,
      image_url:
        typeof n.image_url === 'string' && n.image_url ? n.image_url : null,
      children: buildNodes(n.children, slugPath),
    });
  }
  return out;
}

export const fetchCategoriesHub = cache(
  async (): Promise<CategoriesHub | null> => {
    // 1) hub endpoint (الجديد — Section 4)
    const hub = (await getJSON('/api/categories/hub')) as {
      nodes?: RawNode[];
      counts?: boolean;
      totals?: { categories: number; products: number } | null;
    } | null;
    if (hub && Array.isArray(hub.nodes) && hub.nodes.length > 0) {
      return {
        nodes: buildNodes(hub.nodes),
        counts: !!hub.counts,
        totals: hub.totals ?? null,
      };
    }

    // 2) الشجرة العادية (القديمة — بلا counts) — الروابط كاملين فالـ SSR
    const tree = (await getJSON('/api/categories')) as RawNode[] | null;
    if (Array.isArray(tree) && tree.length > 0) {
      return { nodes: buildNodes(tree), counts: false, totals: null };
    }

    // 3) فشل كامل — الصفحة كترجع للسلوك القديم
    return null;
  }
);
