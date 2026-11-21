// POST /api/reset-password — نقل حرفي من الباك القديم (server.js · authLimiter)
// 400 'Token and new password are required.' · 400 weak password
// · 400 'Invalid or expired token.' · 200 {message} — الباك كان كيرمي 400 على أي خطأ
// DB عبر SEC definer: phasef_user_set_password.
// ملاحظة: الباك القديم كان كيضبط is_verified = true فنفس UPDATE — الـ definer
//   phasef_user_set_password كيبدل الـ hash فقط (عقد الـ SEC — ما كاينش SQL مباشر هنا).
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbVerifyJwt } from '@/lib/pb/pb-jwt';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { genSalt, hash } from 'bcryptjs';

export const dynamic = 'force-dynamic';

const AUTH_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function assertStrongPassword(pw: unknown): boolean {
  return typeof pw === 'string' && pw.length >= 8;
}

export async function POST(request: Request) {
  try {
    if (!pbRateLimit(`auth:${pbClientIp(request)}`, AUTH_LIMIT.max, AUTH_LIMIT.windowMs)) {
      return NextResponse.json({ message: 'Too many requests, please try again after 15 minutes.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { token, newPassword } = body;
    if (!token || !newPassword) {
      return NextResponse.json({ message: 'Token and new password are required.' }, { status: 400 });
    }
    if (!assertStrongPassword(newPassword)) {
      // 🩹 FIX#7
      return NextResponse.json({ message: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const secret = await getPbJwtSecret();
    if (!secret) return NextResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });

    const decoded = await pbVerifyJwt(String(token), secret);
    if (!decoded || decoded.type !== 'reset') {
      // 🩹 FIX#3 — typed token
      return NextResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });
    }
    const userId = Number(decoded.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });
    }

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });

    const salt = await genSalt(10);
    const passwordHash = await hash(String(newPassword), salt);
    await sql.unsafe('SELECT phasef_user_set_password($1, $2) AS r', [userId, passwordHash]);

    return NextResponse.json({ message: 'Password reset successfully! You can now log in.' });
  } catch (e) {
    // نفس الباك: أي خطأ (توكن غالط/منتهي ولا DB) → 400 بنفس الرسالة
    console.warn('[pb-reset] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ message: 'Invalid or expired token.' }, { status: 400 });
  }
}
