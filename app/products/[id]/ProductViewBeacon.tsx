'use client';

// app/products/[id]/ProductViewBeacon.tsx — phase-abc: product_view beacon (البند 9)
// ═══════════════════════════════════════════════════════════════════════
// مكوّن صغير client-side — كيطلق نبضة product_view → /api/analytics/collect
// → STORE_ANALYTICS.writeDataPoint (بلا أي صف في Supabase).
//
// ليش client-side وماشي server-side؟ الـ HTML تاع PDP كيتخدم من الحافة
// (zone cache s-maxage) — HIT ما كيوصلش للـ Worker أصلاً — إذن العد
// السيرفري كيغلط بالنقص. الـ beacon كيجري فالمتصفح دائماً = العد الحقيقي
// للزوار حتى على الـ HTML المتكاشي. المكون منفصل على ProductDetailsClient
// (ملف ~122KB) باش أي تعديل إضافي ما يلمسش الملف الكبير.
// ═══════════════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { sendAnalyticsBeacon } from '@/lib/beacon';

export default function ProductViewBeacon({ productId }: { productId: number | string }) {
  useEffect(() => {
    const pid = Number(productId);
    if (Number.isFinite(pid) && pid > 0) {
      sendAnalyticsBeacon('product_view', { productId: Math.floor(pid) });
    }
    // مرة وحدة لكل mount فعلي — ركوب/هبوط الروت = view جديد (نفس عقد PDC mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
