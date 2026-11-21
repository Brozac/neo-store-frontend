// GET /api/verify-email?token= — نقل حرفي من الباك القديم (server.js /api/verify-email)
// نجاح → 200 HTML (نفس الـ inline styles حرفياً) · فشل → 400 HTML/نص
// 🩹 FIX#3 — typed token: verify-token لا يصلح أبداً reset-token
// DB عبر SEC definer: phasef_user_mark_verified.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbVerifyJwt } from '@/lib/pb/pb-jwt';

export const dynamic = 'force-dynamic';

function htmlResponse(html: string, status: number): NextResponse {
  return new NextResponse(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function frontendUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'https://laclarc.com';
}

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return htmlResponse('Invalid token.', 400);

    const secret = await getPbJwtSecret();
    const sql = await getRwSql();
    if (!secret || !sql) return htmlResponse(VERIFY_FAIL_HTML, 400);

    const decoded = await pbVerifyJwt(token, secret);
    if (!decoded) return htmlResponse(VERIFY_FAIL_HTML, 400);
    if (decoded.type !== 'verify') return htmlResponse('Invalid token type.', 400); // 🩹 FIX#3
    const userId = Number(decoded.id);
    if (!Number.isFinite(userId) || userId <= 0) return htmlResponse(VERIFY_FAIL_HTML, 400);

    await sql.unsafe('SELECT phasef_user_mark_verified($1) AS r', [userId]);

    // نفس الـ HTML حرفياً من الباك القديم (inline styles)
    return htmlResponse(
      '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;text-align:center;margin-top:60px;padding:0 20px;"><h1 style="color:#2E4057;">Email verified successfully! <span style="color:#7C9E85;">✓</span></h1><p style="color:#7A8CA0;">You can now log in to your account.</p><a href="' +
        frontendUrl() +
        '/auth" style="display:inline-block;margin-top:14px;background:#5B7EA6;color:#fff;padding:13px 32px;border-radius:12px;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;">Go to Login</a></div>',
      200,
    );
  } catch (e) {
    console.warn('[pb-verify-email] failed:', e instanceof Error ? e.message : e);
    return htmlResponse(VERIFY_FAIL_HTML, 400);
  }
}

// نفس الـ HTML تاع الفشل حرفياً من الباك القديم
const VERIFY_FAIL_HTML =
  '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;text-align:center;margin-top:60px;padding:0 20px;"><h1 style="color:#B05C5C;">Invalid or expired link</h1><p style="color:#7A8CA0;">This link is invalid or has expired. Try logging in — if anything is wrong, we are here to help.</p></div>';
