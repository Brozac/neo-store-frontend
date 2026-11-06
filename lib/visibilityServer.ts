// lib/visibilityServer.ts — v28 [total-vanish] القراءة السيرفرية لكونفيگ الظهور
// ═══════════════════════════════════════════════════════════════════════
// المصدر: GET {BACKEND}/api/settings (store_settings — نفس مصدر الكلاينت)
// الفرق: هاد القراءة كتمشي في السيرفر (layout / sitemaps / hub) — يعني
//        الإخفاء كيبان في **أول HTML** بلا JS وبلا فلاش وبلا SEO.
//
// الكاش: data-cache بوسم `visibility` — revalidate يومي على الورق، لكن
//        /api/visibility-revalidate (الحفظ الإداري) كيفرّغ الوسم دغيا =
//        الانتشار فوري بعد Save. الكتابة وحدة/يوم على ISR budget (عليها
//        الـ tag purge — ما كاينش revalidate زمني قصير).
//
// fail-open: أي فشل/غياب = DEFAULT_CONFIG = كلشي ظاهر — عطل القراءة ما
//            يطيحش المتجر أبداً (نفس فلسفة الكلاينت في lib/siteConfig.ts).
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import {
  configFromBackendLists,
  DEFAULT_CONFIG,
  type SiteVisibilityConfig,
} from './siteConfig';

const BACKEND_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com'
).replace(/\/+$/, '');

export const VISIBILITY_TAG = 'visibility';

export async function getServerVisibility(): Promise<SiteVisibilityConfig> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/settings`, {
      next: { revalidate: 86400, tags: [VISIBILITY_TAG] },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ...DEFAULT_CONFIG };
    const json = await res.json().catch(() => null);
    return configFromBackendLists(
      json?.hidden_routes,
      json?.hidden_sections,
      json?.show_reels
    );
  } catch {
    // Render بارد / شبكة طايحة → fail-open (الافتراضي: كلشي ظاهر)
    return { ...DEFAULT_CONFIG };
  }
}
