// POST /api/upload — Phase F (مرآة الأصلي): Cloudinary unsigned→signed upload
// authenticateToken إجباري · images[] حد 10 · jpg/png/jpeg/webp · 5MB · folder neo_store_uploads
// الرد: {urls:[secure_url]} — نفس العقد (ReviewForm/review invite كيستعملوها)
import { NextResponse } from 'next/server';
import { pbRequireUser, pbSecret } from '@/lib/pb/pb-user';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(request: Request) {
  try {
    const user = await pbRequireUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Access Denied: No token provided' },
        { status: 401 },
      );
    }

    const cloudName = await pbSecret('CLOUDINARY_CLOUD_NAME');
    const apiKey = await pbSecret('CLOUDINARY_API_KEY');
    const apiSecret = await pbSecret('CLOUDINARY_API_SECRET');
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Failed to upload files' }, { status: 503 });
    }

    const form = await request.formData();
    const files = form.getAll('images').filter((f): f is File => f instanceof File);
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }
    if (files.length > 10) {
      return NextResponse.json({ error: 'Failed to upload files' }, { status: 400 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'neo_store_uploads';
    // توقيع Cloudinary: params مرتّبة أبجدياً ثم api_secret
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1Hex(toSign);

    const urls: string[] = [];
    for (const file of files) {
      if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'Failed to upload files' }, { status: 400 });
      }
      const buf = await file.arrayBuffer();
      const cForm = new FormData();
      cForm.append('file', new Blob([buf], { type: file.type }), file.name.slice(0, 120));
      cForm.append('api_key', apiKey);
      cForm.append('timestamp', String(timestamp));
      cForm.append('folder', folder);
      cForm.append('signature', signature);
      const up = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: 'POST',
        body: cForm,
        signal: AbortSignal.timeout(30000),
      });
      const j = (await up.json().catch(() => null)) as { secure_url?: string } | null;
      if (!up.ok || !j?.secure_url) {
        console.warn('[pb-upload] cloudinary failed:', up.status);
        return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 });
      }
      urls.push(j.secure_url);
    }

    return NextResponse.json({ urls }, { status: 200 });
  } catch (e) {
    console.warn('[pb-upload] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 });
  }
}
