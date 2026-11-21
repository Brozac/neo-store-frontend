// POST /api/auth/cookie-session — SessionBridge bridge (M#48)
// الكلاينت (app/components/SessionBridge.tsx) كيصيفط:
//   fetch(API + '/api/auth/cookie-session', { method:'POST',
//     headers: { Authorization: `Bearer ${session.laclarcToken}` }, credentials:'include' })
// حيث laclarcToken = JWT ديال laclarc ({id, email} · 7d · JWT_SECRET) من /api/auth/social.
// الدور: تحويل التوكن إلى كوكي جلسة httpOnly session_token (نفس كوكي /api/login)
//   — التوكن يبقى فالذاكرة فقط وما كيتخزنش في JS-accessible storage (F-H1).
// 401 {message:'Access Denied: No token provided'} · 403 {message:'Invalid or expired token'}
import { NextResponse } from 'next/server';
import { getPbJwtSecret, pbVerifyJwt } from '@/lib/pb/pb-jwt';
import { pbExtractToken } from '@/lib/pb/pb-secure-checkout';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { token } = pbExtractToken(request);
    if (!token) {
      return NextResponse.json({ message: 'Access Denied: No token provided' }, { status: 401 });
    }

    const secret = await getPbJwtSecret();
    if (!secret) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const user = await pbVerifyJwt(token, secret);
    if (!user) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 403 });
    }

    // نفس كوكي الجلسة تاع /api/login — نفس الاسم/المدة/الأعلام (7 أيام)
    const res = NextResponse.json({
      message: 'Session cookie set successfully',
      user: { id: user.id ?? null, name: user.name ?? null, email: user.email ?? null },
    });
    res.cookies.set('session_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 604800,
    });
    return res;
  } catch (e) {
    console.warn('[pb-cookie-session] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
