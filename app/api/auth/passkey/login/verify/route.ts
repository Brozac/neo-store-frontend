// POST /api/auth/passkey/login/verify — Phase C (port nsb/routes/webauthn.js F#73)
// عام (قبل المصادقة) · body = credential.toJSON()
// الرد نفس شكل /api/login بالضبط + كوكي الجلسة httpOnly (F-H1)
// 200 {message,token,user} · 400 challenge/رد غالط · 401 تحقق فاشل · 404 credential مجهول
// · 429 rate limit (10/15m) · 500 سيرفر
import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbRuntime } from '@/lib/pb/pb-env';
import { pbSignUserJwt } from '@/lib/pb/pb-jwt';
import {
  pbChallengeRestore,
  pbChallengeTake,
  pbExtractChallenge,
  pbJsonBody,
  pbPasskeyAudit,
  pbPasskeyLimitVerify,
  pbPhasefRow,
  pbRpConfig,
  pbTransportsOf,
  pbWarn,
  type VerifyAuthenticationResponseOpts,
} from '@/app/api/auth/passkey/_pb-passkey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const limited = pbPasskeyLimitVerify(request);
  if (limited) return limited;

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ message: 'Server error' }, { status: 500 });
    const { waitUntil } = await getPbRuntime();

    const body = await pbJsonBody(request);
    const credentialId = typeof body.id === 'string' ? body.id : null;
    const challenge = pbExtractChallenge(body);
    if (!credentialId || !challenge) {
      return NextResponse.json({ message: 'Invalid authentication response.' }, { status: 400 });
    }

    const row = await pbChallengeTake(sql, challenge, 'authentication');
    if (!row) {
      return NextResponse.json({ message: 'Challenge expired or already used. Please retry.' }, { status: 400 });
    }

    const cred = await pbPhasefRow<{
      id: string;
      user_id: number;
      public_key: string;
      counter: number;
      transports: unknown;
    }>(
      sql,
      'SELECT phasef_webauthn_cred_get($1) AS r',
      [credentialId],
    );
    // 404 صريح = إشارة معروفة للclient باش يطلق signalUnknownCredential (دليل authentication §38)
    if (!cred) return NextResponse.json({ message: 'Credential not found.' }, { status: 404 });

    const { rpId, origins } = await pbRpConfig();

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body as unknown as VerifyAuthenticationResponseOpts['response'],
        expectedChallenge: challenge,
        expectedOrigin: origins,
        expectedRPID: rpId,
        // v9: authenticator (ماشي credential تاع v13+) — مفاتيح credentialID/credentialPublicKey
        authenticator: {
          credentialID: new Uint8Array(Buffer.from(cred.id, 'base64url')),
          credentialPublicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64url')),
          counter: Number(cred.counter) || 0,
          transports: pbTransportsOf(cred.transports),
        },
        requireUserVerification: row.uv === 'required', // 'preferred' مسجل فالسيرفر → relaxation صحيح
      });
    } catch (verifyErr) {
      // counter تراجع = clone suspicion → نفس الرد العام (بلا كشف السبب)
      pbWarn('login/verify challenge', verifyErr);
      await pbChallengeRestore(sql, row); // B-L12: فشل التحقق ما يهدمش الchallenge
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    if (!verification.verified) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const info = verification.authenticationInfo;
    await sql.unsafe('SELECT phasef_webauthn_cred_touch($1, $2) AS r', [cred.id, info.newCounter || 0]);

    const user = await pbPhasefRow<{ id: number; name: string; email: string | null }>(
      sql,
      'SELECT phasef_webauthn_user_email_name($1) AS r',
      [cred.user_id],
    );
    if (!user) return NextResponse.json({ message: 'Credential not found.' }, { status: 404 });

    // JWT مطابق تماما لـ/api/login ({id,name} · 7d) — حتى حسابات Google-social كيدخلو هنا
    const token = await pbSignUserJwt({ id: user.id, name: user.name });

    pbPasskeyAudit(sql, waitUntil, 'PASSKEY_LOGIN', user.id, {
      credentialId: String(cred.id).slice(0, 8) + '…',
      backedUp: info.credentialBackedUp === true,
    });

    const res = NextResponse.json({
      message: 'Logged in successfully',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
    // 🩹 SECURITY-FIX (F-H1): كوكي جلسة httpOnly — نفس الاسم اللي كيقراو الroutes الأخرى
    res.headers.append(
      'Set-Cookie',
      `session_token=${token}; HttpOnly; Secure; Path=/; Max-Age=604800; SameSite=Lax`,
    );
    return res;
  } catch (e) {
    pbWarn('login/verify', e);
    return NextResponse.json({ message: 'Server error' }, { status: 500 });
  }
}
