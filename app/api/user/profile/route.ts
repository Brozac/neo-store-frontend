// GET/PUT /api/user/profile — نقل حرفي من الباك القديم (authenticateToken replica)
// 401 {message:'Access Denied: No token provided'} · 403 {message:'Invalid or expired token'}
// · GET 404 {message:'User not found'} · PUT 400 {message:'Name is required'}
// Auth من Bearer ولا كوكي الجلسة session_token (ReviewForm/profile كيتصلو بـ
// credentials:'include' بلا هيدر — نفس نمط /api/orders/my-orders: pbExtractToken).
// DB عبر SEC definer: phasef_user_profile + phasef_user_update_profile.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbVerifyJwt, PbJwtPayload } from '@/lib/pb/pb-jwt';
import { pbExtractToken, pbCsrfOk } from '@/lib/pb/pb-secure-checkout';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  name?: string | null;
  email?: string | null;
  profile_picture?: string | null;
}

interface UpdateResult {
  ok?: boolean;
  profile?: ProfileRow;
}

async function authenticate(
  request: Request,
): Promise<{ user: PbJwtPayload } | { error: NextResponse }> {
  const { token, viaCookie } = pbExtractToken(request);
  if (!token) {
    return { error: NextResponse.json({ message: 'Access Denied: No token provided' }, { status: 401 }) };
  }
  // CSRF defense: كوكي + method مغيرة → Origin إجباري (نفس my-orders)
  if (!pbCsrfOk(request, viaCookie)) {
    return { error: NextResponse.json({ message: 'Forbidden origin' }, { status: 403 }) };
  }
  const secret = await getPbJwtSecret();
  if (!secret) {
    return { error: NextResponse.json({ message: 'Server error' }, { status: 500 }) };
  }
  const user = await pbVerifyJwt(token, secret);
  if (!user) {
    return { error: NextResponse.json({ message: 'Invalid or expired token' }, { status: 403 }) };
  }
  return { user };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if ('error' in auth) return auth.error;

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ message: 'Server error' }, { status: 500 });

    const rows = await sql.unsafe('SELECT phasef_user_profile($1) AS r', [Number(auth.user.id)]);
    const profile = (rows[0]?.r ?? null) as ProfileRow | null;
    if (!profile) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (e) {
    console.warn('[pb-profile] GET failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticate(request);
    if ('error' in auth) return auth.error;
    const userId = Number(auth.user.id);

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { name, profilePicture } = body;
    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ message: 'Server error' }, { status: 500 });

    const rows = await sql.unsafe('SELECT phasef_user_update_profile($1, $2, $3) AS r', [
      userId,
      String(name),
      profilePicture == null ? null : String(profilePicture),
    ]);
    const updated = (rows[0]?.r ?? null) as UpdateResult | null;
    if (!updated?.ok || !updated.profile) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    // نفس شكل الباك: RETURNING id, name, email, profile_picture → rows[0]
    return NextResponse.json({ id: userId, ...updated.profile });
  } catch (e) {
    console.warn('[pb-profile] PUT failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
