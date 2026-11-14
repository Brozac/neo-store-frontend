// app/api/csp-reports/route.ts — F#74 L4: مستقبل تقارير CSP (مرحلة المراقبة)
// Report-Only كيصيفط violation reports هنا — كنسجلو فاللوج ونردّو 204 (بلا تخزين).
// بعد أسبوعين من المراقبة: خطة الانتقال لEnforce موثقة فـ next.config.ts (كومنتاي CSP).
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.text();
    // صفر PII — violation-report تاع المتصفح فقط (document-uri/violated-directive/source-file)
    console.log('[CSP-REPORT]', body.slice(0, 1200));
  } catch {
    // جسم خاطئ — نتجاهلو بصمت (المتصفحات ما كيعاودوش الارسال على 204)
  }
  return new NextResponse(null, { status: 204 });
}
