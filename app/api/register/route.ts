// POST /api/register — نقل حرفي من الباك القديم (server.js /api/register · authLimiter)
// 400 'All fields are required' · 400 weak password · 400 'Email already registered'
// · 201 {message} · 500 {message:'Server error'}
// DB عبر SEC definer: phasef_user_by_email + phasef_user_register.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbSignUserJwt } from '@/lib/pb/pb-jwt';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { sendEmail } from '@/lib/emails';
import { verifyEmail } from '@/lib/email-templates';
import { genSalt, hash } from 'bcryptjs';

export const dynamic = 'force-dynamic';

// authLimiter القديم كان أصعب من الlimiter العام — 10 محاولات / 15 دقيقة
const AUTH_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

// نفس helpers الباك القديم — normalizeEmail = trim+lowercase · assertStrongPassword = length>=8
function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

function assertStrongPassword(pw: unknown): boolean {
  return typeof pw === 'string' && pw.length >= 8;
}

function frontendUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'https://laclarc.com';
}

interface RegisterResult {
  ok?: boolean;
  id?: number;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    if (!pbRateLimit(`auth:${pbClientIp(request)}`, AUTH_LIMIT.max, AUTH_LIMIT.windowMs)) {
      return NextResponse.json({ message: 'Too many requests, please try again after 15 minutes.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { name, email, password } = body;
    if (!name || !email || !password) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }
    if (!assertStrongPassword(password)) {
      return NextResponse.json({ message: 'Password must be at least 8 characters.' }, { status: 400 }); // 🩹 FIX#7
    }
    const cleanEmail = normalizeEmail(email); // 🩹 FIX#8

    const secret = await getPbJwtSecret();
    if (!secret) return NextResponse.json({ message: 'Server error' }, { status: 500 });
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ message: 'Server error' }, { status: 500 });

    // dup check (كان SELECT id FROM users WHERE email = $1)
    const dupRows = await sql.unsafe('SELECT phasef_user_by_email($1) AS r', [cleanEmail]);
    const dup = (dupRows[0]?.r ?? null) as { found?: boolean } | null;
    if (dup?.found) {
      return NextResponse.json({ message: 'Email already registered' }, { status: 400 });
    }

    // bcryptjs — pure JS (nodejs_compat) — نفس genSalt(10) + hash تاع الباك
    const salt = await genSalt(10);
    const passwordHash = await hash(String(password), salt);

    // SEC definer — provider NULL (register الكلاسيكي بلا social)
    const regRows = await sql.unsafe('SELECT phasef_user_register($1, $2, $3, NULL) AS r', [
      String(name),
      cleanEmail,
      passwordHash,
    ]);
    const reg = (regRows[0]?.r ?? null) as RegisterResult | null;
    if (!reg?.ok || reg.id == null) {
      if (reg?.reason === 'dup') {
        return NextResponse.json({ message: 'Email already registered' }, { status: 400 });
      }
      // bad_input — الحقول تتحقق فوق · defensive فقط
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    // 🩹 FIX#3 — typed token: verify-token لا يصلح أبداً reset-token (1d)
    const verifyToken = await pbSignUserJwt({ id: reg.id, type: 'verify' }, secret, 24 * 60 * 60);
    const verifyUrl = `${frontendUrl()}/auth/verify-email?token=${verifyToken}`;

    await sendEmail({
      to: cleanEmail,
      subject: 'Confirm your email — Welcome to Laclarc',
      html: verifyEmail({ name: String(name), verifyUrl }),
    });

    return NextResponse.json(
      { message: 'User registered successfully! Please check your email to verify your account.' },
      { status: 201 },
    );
  } catch (e) {
    console.warn('[pb-register] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
