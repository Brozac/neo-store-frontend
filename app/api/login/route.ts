// POST /api/login — نقل حرفي من الباك القديم (server.js /api/login · authLimiter)
// 401 'Invalid credentials' · 403 unverified · 200 {message,token,user} · 500 'Server error'
// 🩹 F-H1 — زايد على الباك القديم: كوكي الجلسة httpOnly session_token
//   (نفس الكوكي اللي كيقراه /api/orders/my-orders عبر pbExtractToken).
// DB عبر SEC definer: phasef_user_by_email.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbSignUserJwt } from '@/lib/pb/pb-jwt';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { compare } from 'bcryptjs';

export const dynamic = 'force-dynamic';

const AUTH_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

interface UserByEmail {
  found?: boolean;
  id?: number;
  name?: string | null;
  email?: string | null;
  password_hash?: string | null;
  is_verified?: boolean;
}

export async function POST(request: Request) {
  try {
    if (!pbRateLimit(`auth:${pbClientIp(request)}`, AUTH_LIMIT.max, AUTH_LIMIT.windowMs)) {
      return NextResponse.json({ message: 'Too many requests, please try again after 15 minutes.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { email, password } = body;
    const cleanEmail = normalizeEmail(email); // 🩹 FIX#8

    const secret = await getPbJwtSecret();
    if (!secret) return NextResponse.json({ message: 'Server error' }, { status: 500 });
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ message: 'Server error' }, { status: 500 });

    const rows = await sql.unsafe('SELECT phasef_user_by_email($1) AS r', [cleanEmail]);
    const u = (rows[0]?.r ?? null) as UserByEmail | null;
    if (!u?.found) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // حساب social بلا password — bcrypt.compare كيرمي على NULL hash → نرجعو 401 آمن
    if (!u.password_hash) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const validPassword = await compare(String(password ?? ''), u.password_hash);
    if (!validPassword) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    if (!u.is_verified) {
      return NextResponse.json({ message: 'Please verify your email first. Check your inbox.' }, { status: 403 });
    }

    // نفس jwt.sign({ id, name }, JWT_SECRET, { expiresIn: '7d' })
    const token = await pbSignUserJwt(
      { id: u.id as number, name: u.name == null ? undefined : String(u.name) },
      secret,
      7 * 24 * 60 * 60,
    );

    const res = NextResponse.json({
      message: 'Logged in successfully',
      token,
      user: { id: u.id, name: u.name, email: u.email },
    });
    // كوكي الجلسة — نفس الاسم/المدة اللي كيتقراو فـ /api/orders/my-orders (7 أيام)
    res.cookies.set('session_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 604800,
    });
    return res;
  } catch (e) {
    console.warn('[pb-login] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
