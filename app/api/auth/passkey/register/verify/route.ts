// POST /api/auth/passkey/register/verify — Phase C (port nsb/routes/webauthn.js F#73)
// يتطلب Bearer JWT ولا كوكي الجلسة · body = credential.toJSON()
// 200 {verified:true} · 400 ردود التحقق · 429 rate limit (10/15m) · 500 سيرفر
import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbRuntime } from '@/lib/pb/pb-env';
import {
  pbB64u,
  pbChallengeRestore,
  pbChallengeTake,
  pbExtractChallenge,
  pbJsonBody,
  pbPasskeyAudit,
  pbPasskeyAuth,
  pbPasskeyLimitVerify,
  pbPasskeyUserId,
  pbPhasefRow,
  pbRpConfig,
  pbWarn,
  type VerifyRegistrationResponseOpts,
} from '@/app/api/auth/passkey/_pb-passkey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await pbPasskeyAuth(request);
  if (!auth.ok) return auth.res;

  const limited = pbPasskeyLimitVerify(request);
  if (limited) return limited;

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });
    const { waitUntil } = await getPbRuntime();

    const body = await pbJsonBody(request);
    const userId = pbPasskeyUserId(auth.user);

    const challenge = pbExtractChallenge(body);
    if (!challenge) return NextResponse.json({ error: 'Invalid registration response.' }, { status: 400 });

    const row = await pbChallengeTake(sql, challenge, 'registration');
    if (!row) {
      return NextResponse.json({ error: 'Challenge expired or already used. Please retry.' }, { status: 400 });
    }
    if (row.user_id !== userId) {
      // ملاحظة: الchallenge مستهلك وبلا restore — نفس السلوك القديم حرفياً
      return NextResponse.json({ error: 'Challenge does not belong to this account.' }, { status: 400 });
    }

    const { rpId, origins } = await pbRpConfig();

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body as unknown as VerifyRegistrationResponseOpts['response'],
        expectedChallenge: challenge,
        expectedOrigin: origins, // apex + www — v9 كيقبل مصفوفة
        expectedRPID: rpId,
        requireUserVerification: false, // طلبنا 'preferred' — قاعدة الدليل الحرفية؛ وإلا authenticators بلا قفل شاشة كيرميو فشل زائف
        // ⚠️ v9 ما عندش requireUserPresence — UP كيفرض دايماً (deviation موثق من الباك v14)
      });
    } catch (verifyErr) {
      pbWarn('register/verify challenge', verifyErr);
      await pbChallengeRestore(sql, row); // B-L12: فشل التحقق ما يهدمش الchallenge
      return NextResponse.json({ error: 'Registration verification failed.' }, { status: 400 });
    }

    const { verified } = verification;
    if (!verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed.' }, { status: 400 });
    }

    const info = verification.registrationInfo;
    const resBody = (body as { response?: { transports?: unknown } }).response;
    const transports = Array.isArray(resBody?.transports) ? (resBody.transports as string[]) : [];

    // ON CONFLICT — إعادة تسجيل نفس الcredential كتعوض السجل (نمط SimpleWebAuthn الرسمي)
    const upsert = await pbPhasefRow<{ ok: boolean }>(
      sql,
      'SELECT phasef_webauthn_cred_upsert($1::jsonb) AS r',
      [
        JSON.stringify({
          id: pbB64u(info.credentialID),           // v9: Uint8Array → base64url — مفتاح البحث الوحيد
          user_id: userId,
          public_key: pbB64u(info.credentialPublicKey),
          counter: info.counter || 0,
          transports,
          device_type: info.credentialDeviceType || null, // singleDevice | multiDevice
          backed_up: info.credentialBackedUp === true,
          aaguid: info.aaguid || null,
          name: 'Passkey',
        }),
      ],
    );
    if (!upsert || upsert.ok !== true) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    pbPasskeyAudit(sql, waitUntil, 'PASSKEY_REGISTERED', userId, {
      aaguid: info.aaguid || null,
      deviceType: info.credentialDeviceType || null,
      backedUp: info.credentialBackedUp === true,
      conditional: row.conditional === true,
    });

    return NextResponse.json({ verified: true });
  } catch (e) {
    pbWarn('register/verify', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
