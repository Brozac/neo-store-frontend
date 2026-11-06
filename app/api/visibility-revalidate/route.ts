import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { backendFetch } from '@/lib/backend-server';
import { VISIBILITY_TAG } from '@/lib/visibilityServer';

// ═══ v28 [total-vanish] — تفريغ كاش الظهور بعد الحفظ الإداري ═══════════
// صفحة الأدمن (visibility) كتستدعي هاد المسار مباشرة بعد ما ينجح
// PUT /admin/settings/hidden_routes|hidden_sections عند الباك.
//
// علاش: كونفيگ الظهور ولّى كيتقرا في السيرفر (layout + sitemaps + hub)
// بكاش مُوَسْم `visibility`. بلا تفريغ، الصفحات الثابتة (هوم، السياسات…)
// كانت غادي تبقى كتخدم بالـ HTML القديم حتى يطيح الـ revalidate اليومي.
// هاد المسار كيفرّغ الوسم → أول طلبية جاية كتعاود التوليد بالكونفيگ الجديد
// = الانتشار فوري (ثواني) بعد Save.
//
// الأمان: نفس حرس site-config PUT — الجلسة كيتحقق منها عند الباك الحي
// (كوكي admin_token). /api مستثناة من الـ middleware (ما كتتصيدش).
export const dynamic = 'force-dynamic';

export async function POST() {
  // 1) الجلسة الإدارية — نفس نمط app/api/site-config PUT
  try {
    await backendFetch('/api/admin/settings');
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: 'Unauthorized — admin session required' },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Cannot verify admin session right now (backend unreachable) — nothing was purged' },
      { status: 502 }
    );
  }

  // 2) تفريغ وسم الظهور — الصفحات المتأثرة كتعاود التوليد عند أول طلب
  // (Next 16: revalidateTag(tag, profile) — 'max' = نفس نمط /api/revalidate)
  revalidateTag(VISIBILITY_TAG, 'max');

  return NextResponse.json({ ok: true, tag: VISIBILITY_TAG });
}
