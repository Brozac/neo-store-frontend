// F#105-R2UPLOAD — رفع صور عبر POST /api/upload (الباك كيصيفطها لـ Cloudflare R2)
// العقد تاع الباك (من بعد migration): FormData حقل images + Bearer JWT + رد { urls: [...] }
// انسخ هاد الملف لـ frontend/lib/upload-r2.js
//
// الاستعمال:
import { uploadToR2 } from '@/lib/upload-r2';
const url = await uploadToR2(file, jwtToken);            // صورة وحدة — يرجّع أول URL
//   const urls = await uploadToR2Multi(files, jwtToken);     // حتى 10 صور
//
// ملاحظة: pages تاع review و profile راهم كيرفعو مباشرة بـ fetch تاعهم —
// هاد lib موجهة للـ UI الجديدة (banners، أي فورم مستقبلية).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.laclarc.com';

async function postImages(files, jwtToken) {
  const list = Array.isArray(files) ? files : [files];
  for (const f of list) {
    if (!f || !f.type || !f.type.startsWith('image/')) throw new Error('الملف ماشي صورة');
    if (f.size > 10 * 1024 * 1024) throw new Error('الملف فوق 10MB');
  }
  const fd = new FormData();
  for (const f of list) fd.append('images', f, f.name || 'image.jpg');
  const r = await fetch(`${API_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: jwtToken ? { Authorization: `Bearer ${jwtToken}` } : undefined,
    body: fd,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.urls || !j.urls.length) throw new Error(j.error || 'فشل الرفع');
  return j.urls;
}

export async function uploadToR2(file, jwtToken) {
  const urls = await postImages(file, jwtToken);
  return urls[0]; // URL نهائي على pub-…r2.dev — حطو مباشرة فالـ payload
}

export async function uploadToR2Multi(files, jwtToken) {
  return postImages(files, jwtToken);
}
