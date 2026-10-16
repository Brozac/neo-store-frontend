/**
 * ═══════════════════════════════════════════════════════════════
 * Laclarc Image Optimizer — High-Performance UI Runtime — Phase 1
 * ═══════════════════════════════════════════════════════════════
 * مثبت بالدليل: cf.cjdropshipping.com يدعم OSS transforms:
 * 259,677B → 15,696B (−94%) — webp أصلي — x-oss-server-time: 15ms
 * ═══════════════════════════════════════════════════════════════
 * 🩹 v2.1 — Task 10 Review:
 * FIX-CLAMP — width = 0 / NaN / سالب كان يسقط بصمت في 96 (أو 1400) —
 *             الآن يرجع 400 (الافتراضي المعقول) بدل تشوه بصمت.
 * FIX-HTTP  — URL من CDN معروف بـ http:// يترقّى https:// قبل الـ transform —
 *             صفحة HTTPS + صورة HTTP = mixed content = المتصفح يبلوكي الصورة
 *             كلياً. (1688/sourcing صور قديمة قد تأتي http — الترقية تلقائية الآن)
 * ───────────────────────────────────────────────────────────────
 * 🩹 FIX — square mode (m_fill,w,h): للـ thumb (دوائر الشريط) فقط.
 *    w_96 وحده كان يرجّع مستطيل بنفس الـ aspect الأصلي → داخل دائرة
 *    rounded-full كان المحتوى يظهر مقصوصاً من الجوانب.
 *    m_fill,w_96,h_96 = قص مربع مركزي 96×96 — الدائرة كاملة دائماً.
 *    ProductCard/detail/zoom تبقى بـ aspect الأصلي — صفر تغيير بصري.
 * ═══════════════════════════════════════════════════════════════
 */

const OSS_TRANSFORM = (w: number) =>
  `x-oss-process=image/resize,w_${w}/quality,q_80/format,webp`;

// 🩹 البنّاء المربّع — نفس معاملات الجودة + m_fill بقصّ مركزي
const OSS_TRANSFORM_SQUARE = (w: number) =>
  `x-oss-process=image/resize,m_fill,w_${w},h_${w}/quality,q_80/format,webp`;

// 🩹 FIX-HTTP — نفس عائلات الـ tiers المُحوَّلة فقط (localhost/مصادر مجهولة تبقى كما هي)
const HTTPS_UPGRADE_HOSTS = ['cjdropshipping.com', 'alicdn.com', 'aliyuncs.com'];

const ALLOWED_WIDTHS = [96, 200, 400, 800, 1400] as const;
type AllowedWidth = (typeof ALLOWED_WIDTHS)[number];

function clampWidth(w: number): AllowedWidth {
  // 🩹 FIX-CLAMP — 0 كان يعطي 96، NaN كان يعطي 1400 — كلاهما غير مقصود
  if (!Number.isFinite(w) || w <= 0) return 400;
  for (const allowed of ALLOWED_WIDTHS) {
    if (w <= allowed) return allowed;
  }
  return 1400;
}

export function getOptimizedImage(raw?: string | null, width = 400, square = false): string {
  if (!raw) return '/icon-512.png';
  if (raw.startsWith('/')) return raw;

  const w = clampWidth(width);
  const transform = square ? OSS_TRANSFORM_SQUARE(w) : OSS_TRANSFORM(w);

  try {
    const u = new URL(raw);

    // 🩹 FIX-HTTP — ترقية https للـ CDNs المعروفين (متجر https + صورة http = بلوك)
    if (
      u.protocol === 'http:' &&
      HTTPS_UPGRADE_HOSTS.some((h) => u.hostname.endsWith(h))
    ) {
      u.protocol = 'https:';
    }

    // ─── Tier 1: CJ CDN — الدليل المثبت ✓ ───
    if (
      u.hostname === 'cf.cjdropshipping.com' ||
      u.hostname.endsWith('.cjdropshipping.com')
    ) {
      if (u.searchParams.has('x-oss-process')) return raw;
      u.searchParams.set('x-oss-process', transform);  // 🩹 square-aware
      return u.toString();
    }

    // ─── Tier 1.5: Alibaba (1688 sourcing) ───
    if (
      u.hostname.endsWith('.alicdn.com') ||
      u.hostname.endsWith('.aliyuncs.com')
    ) {
      if (u.searchParams.has('x-oss-process')) return raw;
      u.searchParams.set('x-oss-process', transform);  // 🩹 square-aware
      return u.toString();
    }

    // ─── Tier 2: Cloudinary خاصتنا ───
    if (u.hostname === 'res.cloudinary.com') {
      if (raw.includes('f_auto')) return raw;
      // 🩹 square-aware: crop_fill للمربع / w فقط للعادي
      return square
        ? raw.replace('/upload/', `/upload/c_fill,g_auto,q_auto,w_${w},h_${w}/`)
        : raw.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`);
    }

    return raw;
  } catch (e) {
    console.warn(`[ImgOpt] invalid URL: ${raw?.slice(0, 80)} — serving raw`);
    return raw;
  }
}

export const IMG = {
  thumb:  (u?: string | null) => getOptimizedImage(u, 96, true),   // 🩹 مربع — دوائر الشريط
  small:  (u?: string | null) => getOptimizedImage(u, 200),
  card:   (u?: string | null) => getOptimizedImage(u, 400),
  detail: (u?: string | null) => getOptimizedImage(u, 800),
  zoom:   (u?: string | null) => getOptimizedImage(u, 1400),
};
