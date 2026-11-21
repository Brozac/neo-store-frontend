// POST /api/forgot-password — نقل حرفي من الباك القديم (server.js · authLimiter)
// anti-enumeration: نفس الرد دايماً — موجود أم لا · 500 {message:'Server error'}
// DB عبر SEC definer: phasef_user_by_email.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbSignUserJwt } from '@/lib/pb/pb-jwt';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { sendEmail } from '@/lib/emails';
import { passwordReset } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

const AUTH_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

function frontendUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'https://laclarc.com';
}

export async function POST(request: Request) {
  try {
    if (!pbRateLimit(`auth:${pbClientIp(request)}`, AUTH_LIMIT.max, AUTH_LIMIT.windowMs)) {
      return NextResponse.json({ message: 'Too many requests, please try again after 15 minutes.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const cleanEmail = normalizeEmail(body.email); // 🩹 FIX#8

    // ⚠️ DB/env كيتحمّلو هنا (ماشي قبل الرد) — إلا طاحو نرجعو 500 بحال الباك
    const secret = await getPbJwtSecret();
    const sql = await getRwSql();
    if (!secret || !sql) return NextResponse.json({ message: 'Server error' }, { status: 500 });

    // موجود؟ → typed reset token (15m — 🩹 FIX#3)
    const rows = await sql.unsafe('SELECT phasef_user_by_email($1) AS r', [cleanEmail]);
    const u = (rows[0]?.r ?? null) as { found?: boolean; id?: number } | null;

    if (u?.found && u.id != null) {
      const resetToken = await pbSignUserJwt({ id: u.id, type: 'reset' }, secret, 15 * 60);
      const resetUrl = `${frontendUrl()}/auth/reset-password?token=${resetToken}`;

      await sendEmail({
        to: cleanEmail,
        subject: 'Reset your password — Laclarc',
        html: passwordReset({ resetUrl }),
      });
    }

    // anti-enumeration: نفس الرد موجود أم لا
    return NextResponse.json({
      message: 'If that email exists in our system, a reset link has been sent.',
    });
  } catch (e) {
    console.warn('[pb-forgot] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
