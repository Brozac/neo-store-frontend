// POST /api/auth/passkey/register/options — Phase C (port nsb/routes/webauthn.js F#73)
// يتطلب Bearer JWT ولا كوكي الجلسة · body اختياري: { promotion?: bool, conditional?: bool }
// 200 PublicKeyCredentialCreationOptionsJSON · 401 بلا توكن · 403 توكن غالط
// · 429 rate limit (30/15m) · 404 user ماكاينش · 500 سيرفر
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getRwSql } from '@/lib/pb/pb-db';
import {
  pbB64u,
  pbChallengePut,
  pbJsonBody,
  pbPasskeyAuth,
  pbPasskeyLimitOptions,
  pbPasskeyUserId,
  pbPhasefRow,
  pbRpConfig,
  pbTransportsOf,
  pbWarn,
} from '@/app/api/auth/passkey/_pb-passkey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // نفس ترتيب الباك: authenticateToken ← optionsLimiter ← handler
  const auth = await pbPasskeyAuth(request);
  if (!auth.ok) return auth.res;

  const limited = pbPasskeyLimitOptions(request);
  if (limited) return limited;

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const body = await pbJsonBody(request);
    const userId = pbPasskeyUserId(auth.user);
    const promotion = body.promotion === true;
    const conditional = body.conditional === true;

    // الJWT ديال /api/login فيه id+name فقط — email كيجي من DB (وحسابات social كيحتاجوه)
    const dbUser = await pbPhasefRow<{ id: number; name: string | null; email: string | null }>(
      sql,
      'SELECT phasef_webauthn_user_email_name($1) AS r',
      [userId],
    );
    if (!dbUser) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    // excludeCredentials — منع تسجيل نفس الpasskey مرتين (الدالة كترجع ASC على created_at)
    const existing = await pbPhasefRow<Array<{ id: string; transports: unknown }>>(
      sql,
      'SELECT phasef_webauthn_cred_list($1) AS r',
      [userId],
    );

    const { rpId, rpName } = await pbRpConfig();

    const options = await generateRegistrationOptions({
      rpName,
      rpID: rpId,
      // v9 كياخد string كيدوز كما هو → base64url(utf8(id)) = نفس handle تاع الباك القديم
      userID: pbB64u(Buffer.from(String(userId), 'utf8')),
      userName: dbUser.email || String(userId),
      userDisplayName: dbUser.name || '',
      attestationType: 'none',
      excludeCredentials: (existing ?? []).map((c) => ({
        // v9 كيشفّر من Buffer → base64url — نفس الناتج النهائي
        id: Buffer.from(c.id, 'base64url'),
        type: 'public-key' as const,
        transports: pbTransportsOf(c.transports),
      })),
      authenticatorSelection: {
        residentKey: 'required',      // discoverable — ضروري للدخول بلا username
        requireResidentKey: true,
        userVerification: 'preferred',
        // flow الترقية بعد password → platform؛ flow الإدارة → نسيبو (security keys مسموحة)
        ...(promotion && !conditional ? { authenticatorAttachment: 'platform' as const } : {}),
      },
      extensions: { credProps: true },
    });

    // الchallenge كيتحفظ مربوط بالمستخدم — الverify كيقرا الflags من الجدول ماشي من الclient
    const put = await pbChallengePut(sql, {
      challenge: options.challenge,
      type: 'registration',
      userId,
      uv: 'preferred',
      conditional,
    });
    if (!put) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    return NextResponse.json(options); // جاهز لـparseCreationOptionsFromJSON
  } catch (e) {
    pbWarn('register/options', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
