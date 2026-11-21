// GET /api/auth/passkey/credentials — Phase C (port nsb/routes/webauthn.js F#73)
// قائمة بصمات المستخدم (+ rpId وuserId base64url باش الclient يطلق Signal API صح)
// يتطلب Bearer JWT ولا كوكي الجلسة · 200 {rpId,userId,credentials[]} · 401/403/500
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import {
  pbPasskeyAuth,
  pbPasskeyUserId,
  pbPhasefRow,
  pbRpConfig,
  pbUserHandle,
  pbWarn,
} from '@/app/api/auth/passkey/_pb-passkey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PbCredListRow {
  id: string;
  name: string;
  aaguid: string | null;
  transports: unknown;
  device_type: string | null;
  backed_up: unknown;
  created_at: string | null;
  last_used_at: string | null;
}

const ts = (v: string | null): number | null => (v ? new Date(v).getTime() || null : null);

export async function GET(request: Request) {
  const auth = await pbPasskeyAuth(request);
  if (!auth.ok) return auth.res;

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const userId = pbPasskeyUserId(auth.user);
    const rows = (await pbPhasefRow<PbCredListRow[]>(
      sql,
      'SELECT phasef_webauthn_cred_list($1) AS r',
      [userId],
    )) ?? [];

    // الباك القديم كان ORDER BY created_at DESC — الدالة كترجع ASC → نفس العقد هنا
    rows.sort((a, b) => (ts(b.created_at) ?? 0) - (ts(a.created_at) ?? 0));

    const { rpId } = await pbRpConfig();

    return NextResponse.json({
      rpId,
      userId: pbUserHandle(userId), // base64url بلا padding — صالح للSignal API
      credentials: rows.map((c) => ({
        id: c.id,
        name: c.name,
        aaguid: c.aaguid || null,
        transports: Array.isArray(c.transports) ? (c.transports as string[]) : [],
        deviceType: c.device_type || null,
        backedUp: c.backed_up === true,
        registeredAt: ts(c.created_at),
        lastUsedAt: ts(c.last_used_at),
      })),
    });
  } catch (e) {
    pbWarn('credentials list', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
