// POST /api/logout — مسح كوكي الجلسة session_token (Max-Age=0) + رسالة نجاح
// (نفس نمط /api/admin/logout القديم — واضح كوكي الجلسة بدل admin_token)
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ message: 'Logged out successfully' });
  res.cookies.set('session_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
