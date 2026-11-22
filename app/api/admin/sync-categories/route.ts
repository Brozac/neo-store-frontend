// POST /api/admin/sync-categories — Phase I: شجرة CJ → phasei_sync_categories_bulk
// GET /product/getCategory (3 مستويات) → flatten بمراجع ref/p → bulk فنداء واحد
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

interface CjL1 { categoryFirstId?: string; categoryFirstName?: string; categoryFirstList?: CjL2[] }
interface CjL2 { categorySecondId?: string; categorySecondName?: string; categorySecondList?: CjL3[] }
interface CjL3 { categoryId?: string; categoryName?: string }

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `cat-${Math.abs(hash(name))}`;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const res = await cjFetch('/product/getCategory', {});
    const env = res.data;
    if (!env || env.code !== 200 || !Array.isArray(env.data)) {
      return NextResponse.json({ error: env?.message || 'CJ categories unavailable' }, { status: 502 });
    }

    const items: { level: number; name: string; slug: string; ref?: string; p?: string; cj_id?: string }[] = [];
    let l1n = 0;
    for (const [i1, l1] of (env.data as CjL1[]).entries()) {
      const name1 = String(l1.categoryFirstName ?? '').trim();
      if (!name1) continue;
      const ref1 = `l1-${i1}`;
      items.push({ level: 1, name: name1.slice(0, 120), slug: slugify(name1), ref: ref1 });
      l1n += 1;
      for (const [i2, l2] of (l1.categoryFirstList ?? []).entries()) {
        const name2 = String(l2.categorySecondName ?? '').trim();
        if (!name2) continue;
        const ref2 = `l2-${i1}-${i2}`;
        items.push({ level: 2, name: name2.slice(0, 120), slug: slugify(name2), ref: ref2, p: ref1 });
        for (const l3 of l2.categorySecondList ?? []) {
          const name3 = String(l3.categoryName ?? '').trim();
          if (!name3) continue;
          items.push({
            level: 3, name: name3.slice(0, 120), slug: slugify(name3),
            p: ref2, cj_id: String(l3.categoryId ?? '').slice(0, 64),
          });
        }
      }
    }

    if (items.length === 0 || items.length > 5000) {
      return NextResponse.json({ error: `category tree size out of bounds (${items.length})` }, { status: 502 });
    }

    const r = await withDb((sql) => callFn(sql, 'phasei_sync_categories_bulk', [items]));
    if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
    if (r.ok === false) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      message: `Categories synced — L1: ${l1n}, total: ${r.total}, inserted: ${r.inserted}, updated: ${r.updated}.`,
    });
  } catch (e) {
    console.warn('[admin-sync-categories] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Category sync failed' }, { status: 502 });
  }
}
