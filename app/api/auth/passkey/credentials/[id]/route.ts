// PUT/DELETE /api/auth/passkey/credentials/:id — Phase C (port nsb/routes/webauthn.js F#73)
// إدارة البصمات — user-owned check داخل الدوال (ok:FOUND) → 404 إلا ماكاينش
// PUT 200 {success:true,name} · DELETE 200 {success:true} · 400 بلا سميّة · 401/403/404/500
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbRuntime } from '@/lib/pb/pb-env';
import {
  pbJsonBody,
  pbPasskeyAudit,
  pbPasskeyAuth,
  pbPasskeyUserId,
  pbPhasefRow,
  pbWarn,
} from '@/app/api/auth/passkey/_pb-passkey';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// PUT — إعادة تسمية (label فالسيرفر فقط — ما كيطلقش signalCurrentUserDetails، دليل management §72)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await pbPasskeyAuth(request);
  if (!auth.ok) return auth.res;

  try {
    const body = await pbJsonBody(request);
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 50) : '';
    if (!name) return NextResponse.json({ error: 'A name is required.' }, { status: 400 });

    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const r = await pbPhasefRow<{ ok: boolean }>(
      sql,
      'SELECT phasef_webauthn_cred_rename($1, $2, $3) AS r',
      [id, pbPasskeyUserId(auth.user), name],
    );
    if (!r || r.ok !== true) {
      return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, name });
  } catch (e) {
    pbWarn('credentials rename', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — حذف بصمة (الclient من بعد كيطلق signalAllAcceptedCredentials بالمتبقي)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await pbPasskeyAuth(request);
  if (!auth.ok) return auth.res;

  try {
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    const userId = pbPasskeyUserId(auth.user);
    const r = await pbPhasefRow<{ ok: boolean }>(
      sql,
      'SELECT phasef_webauthn_cred_delete($1, $2) AS r',
      [id, userId],
    );
    if (!r || r.ok !== true) {
      return NextResponse.json({ error: 'Credential not found.' }, { status: 404 });
    }

    const { waitUntil } = await getPbRuntime();
    pbPasskeyAudit(sql, waitUntil, 'PASSKEY_DELETED', userId, {
      credentialId: String(id).slice(0, 8) + '…',
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    pbWarn('credentials delete', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
