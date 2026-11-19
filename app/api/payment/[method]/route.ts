// /api/payment/[method] — F107: catch-all proxy لطرق الدفع اللي مازالو على Render
// (crypto/manual/baridimob...). Render حي = نفس السلوك حرفياً. Render واقف =
// 501 واضح (ماشي 404 Next) — الفرونت كيعرض رسالة نجاعة بدل انكسار صامت.
// ⚠️ /api/payment/gateways و /api/payment/verify-session مسارات ثابتة —
//    Next كيعطيهم الأولوية فوق هادا (ماكاينش تعارض).
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';

export const dynamic = 'force-dynamic';

async function handle(request: Request, method: string) {
  const url = new URL(request.url);
  const rawBody = method !== 'GET' && method !== 'HEAD'
    ? await request.text().catch(() => '')
    : undefined;
  const proxied = await pbProxy(request, '/api/payment/' + url.pathname.split('/').pop() + url.search, rawBody);
  if (proxied) return proxied;
  return NextResponse.json(
    { error: 'Payment method temporarily unavailable. Please use card payment (Stripe).' },
    { status: 501 },
  );
}

export async function GET(request: Request) { return handle(request, 'GET'); }
export async function POST(request: Request) { return handle(request, 'POST'); }
