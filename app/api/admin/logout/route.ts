// POST /api/admin/logout — Phase I: خروج same-origin — مسح جوج الكوكيز
// بلا شبكة: Set-Cookie Max-Age=0 بنفس attributes كيصفي admin_token (من rpc)
// و admin_token_next (المحلي) — الـ sessions يموتو في الحين.
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const CLEAR = 'Max-Age=0; Path=/; Domain=.laclarc.com; HttpOnly; Secure; SameSite=Lax';

export async function POST(request: Request) {
  const res = NextResponse.json({ message: 'Logged out' }, { status: 200 });
  res.headers.append('Set-Cookie', `admin_token=; ${CLEAR}`);
  res.headers.append('Set-Cookie', `${ADMIN_COOKIE}=; ${CLEAR}`);
  return res;
}
