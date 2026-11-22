// POST /api/admin/login — Phase I: دخول same-origin مزدوج الكوكي
// ═══════════════════════════════════════════════════════════════════════
// · التحقق من الاعتمادات كيبقى عند rpc (المصدر الرسمي — لم نلمسه)
// · الرد كيضبط جوج كوكيز:
//     admin_token       ← من Set-Cookie تاع rpc (للـ endpoints الباقية على rpc)
//     admin_token_next  ← موقّع HS256/JWT_SECRET — للجار same-origin (بلا شبكة)
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { pbOriginOk } from '@/lib/pb/pb-user';
import { pbSignUserJwt, getPbJwtSecret } from '@/lib/pb/pb-jwt';
import { ADMIN_COOKIE, ADMIN_TTL_SECONDS } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const AUTH_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function rpcBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://rpc.laclarc.com').replace(/\/+$/, '');
}

function cookieAttrs(maxAge: number): string {
  return `Max-Age=${maxAge}; Path=/; Domain=.laclarc.com; HttpOnly; Secure; SameSite=Lax`;
}

export async function POST(request: Request) {
  if (!pbOriginOk(request)) {
    return NextResponse.json({ message: 'Forbidden origin' }, { status: 403 });
  }
  if (!pbRateLimit(`adminauth:${pbClientIp(request)}`, AUTH_LIMIT.max, AUTH_LIMIT.windowMs)) {
    return NextResponse.json(
      { message: 'Too many requests, please try again after 15 minutes.' },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = String(body.email ?? '').trim();
  const password = String(body.password ?? '');
  if (!email || !password) {
    return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
  }

  // ─── 1. التحقق من rpc (المصدر الرسمي للاعتمادات) ───
  let rpcCookieValue = '';
  let rpcMessage = 'Server error';
  let rpcStatus = 502;
  try {
    const up = await fetch(`${rpcBase()}/api/admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://laclarc.com',
        'User-Agent': 'Mozilla/5.0 (laclarc-next-admin)',
      },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(25000),
    });
    rpcStatus = up.status;
    const j = (await up.json().catch(() => ({}))) as { message?: string };
    rpcMessage = j.message || rpcMessage;
    const setCookie = up.headers.get('set-cookie') || '';
    if (up.ok && setCookie.includes('admin_token=')) {
      rpcCookieValue = setCookie.split('admin_token=')[1].split(';')[0].trim();
    }
  } catch {
    rpcStatus = 502;
    rpcMessage = 'Backend unreachable';
  }

  if (rpcStatus !== 200 || !rpcCookieValue) {
    return NextResponse.json(
      { message: rpcStatus === 401 || rpcStatus === 403 ? 'Invalid credentials' : rpcMessage },
      { status: rpcStatus === 401 || rpcStatus === 403 ? 401 : 502 },
    );
  }

  // ─── 2. الكوكي المحلي (التحقق same-origin بلا شبكة) ───
  const secret = await getPbJwtSecret();
  if (!secret) {
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
  const nextToken = await pbSignUserJwt({ role: 'admin' } as never, secret, ADMIN_TTL_SECONDS);

  const res = NextResponse.json({ message: 'Logged in successfully' }, { status: 200 });
  res.headers.append(
    'Set-Cookie',
    `admin_token=${rpcCookieValue}; ${cookieAttrs(ADMIN_TTL_SECONDS)}`,
  );
  res.headers.append(
    'Set-Cookie',
    `${ADMIN_COOKIE}=${encodeURIComponent(nextToken)}; ${cookieAttrs(ADMIN_TTL_SECONDS)}`,
  );
  return res;
}
