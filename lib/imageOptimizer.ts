/**
 * ═══════════════════════════════════════════════════════════════
 * Laclarc Image Optimizer — High-Performance UI Runtime — Phase 1
 * ═══════════════════════════════════════════════════════════════
 * مثبت بالدليل: cf.cjdropshipping.com يدعم OSS transforms:
 * 259,677B → 15,696B (−94%) — webp أصلي — x-oss-server-time: 15ms
 * ═══════════════════════════════════════════════════════════════
 */

const OSS_TRANSFORM = (w: number) =>
  `x-oss-process=image/resize,w_${w}/quality,q_80/format,webp`;

const ALLOWED_WIDTHS = [96, 200, 400, 800, 1400] as const;
type AllowedWidth = (typeof ALLOWED_WIDTHS)[number];

function clampWidth(w: number): AllowedWidth {
  for (const allowed of ALLOWED_WIDTHS) {
    if (w <= allowed) return allowed;
  }
  return 1400;
}

export function getOptimizedImage(raw?: string | null, width = 400): string {
  if (!raw) return '/icon-512.png';
  if (raw.startsWith('/')) return raw;

  const w = clampWidth(width);

  try {
    const u = new URL(raw);

    // ─── Tier 1: CJ CDN — الدليل المثبت ✓ ───
    if (
      u.hostname === 'cf.cjdropshipping.com' ||
      u.hostname.endsWith('.cjdropshipping.com')
    ) {
      if (u.searchParams.has('x-oss-process')) return raw;
      u.searchParams.set('x-oss-process', OSS_TRANSFORM(w));  // ← الاسم الموحد
      return u.toString();
    }

    // ─── Tier 1.5: Alibaba (1688 sourcing) ───
    if (
      u.hostname.endsWith('.alicdn.com') ||
      u.hostname.endsWith('.aliyuncs.com')
    ) {
      if (u.searchParams.has('x-oss-process')) return raw;
      u.searchParams.set('x-oss-process', OSS_TRANSFORM(w));  // ← الاسم الموحد
      return u.toString();
    }

    // ─── Tier 2: Cloudinary خاصتنا ───
    if (u.hostname === 'res.cloudinary.com') {
      if (raw.includes('f_auto')) return raw;
      return raw.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`);
    }

    return raw;
  } catch (e) {
    console.warn(`[ImgOpt] invalid URL: ${raw?.slice(0, 80)} — serving raw`);
    return raw;
  }
}

export const IMG = {
  thumb:  (u?: string | null) => getOptimizedImage(u, 96),
  small:  (u?: string | null) => getOptimizedImage(u, 200),
  card:   (u?: string | null) => getOptimizedImage(u, 400),
  detail: (u?: string | null) => getOptimizedImage(u, 800),
  zoom:   (u?: string | null) => getOptimizedImage(u, 1400),
};