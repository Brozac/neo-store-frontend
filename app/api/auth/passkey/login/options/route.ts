// POST /api/auth/passkey/login/options — Phase C (port nsb/routes/webauthn.js F#73)
// عام (قبل المصادقة) · allowCredentials: [] = discoverable → دخول بلا username
// 200 PublicKeyCredentialRequestOptionsJSON · 429 rate limit (30/15m) · 500 سيرفر
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getRwSql } from '@/lib/pb/pb-db';
import {
  pbChallengePut,
  pbPasskeyLimitOptions,
  pbRpConfig,
  pbWarn,
} from '@/app/api/auth/passkey/_pb-passkey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const limited = pbPasskeyLimitOptions(request);
  if (limited) return limited;

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const { rpId } = await pbRpConfig();

    const options = await generateAuthenticationOptions({
      rpID: rpId,
      allowCredentials: [],
      userVerification: 'preferred',
    });

    // المستوى ديال UV كيتسجل فالسيرفر — الverify كيفرضو بلا اعتماد على الclient
    const put = await pbChallengePut(sql, {
      challenge: options.challenge,
      type: 'authentication',
      userId: null,
      uv: options.userVerification || 'preferred',
      conditional: false,
    });
    if (!put) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    return NextResponse.json(options); // جاهز لـparseRequestOptionsFromJSON
  } catch (e) {
    pbWarn('login/options', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
