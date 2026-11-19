// GET /api/products — F107 CATALOG-LIVE (proxy → fallback: db-ro كامل)
// نفس الانقسامات حرفياً من server.js:2991:
//   minimal=1 → sitemap chunk · page=N → page/mosaic mode · count=1 → عدّاد
//   search/category → بحث صارم · limit=N (≤50) → hero/products-list · bare → FULL_CAP
import { NextResponse } from 'next/server';
import { pbProxy } from '@/lib/pb/pb-proxy';
import {
  dbCatalogPage, dbCatalogCount, dbCatalogSearch, dbCatalogFull,
  dbProductsMinimal, dbProductsLimit,
} from '@/lib/db-reads';

export const dynamic = 'force-dynamic';

const json = (data: unknown, cc?: string, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: cc ? { 'Cache-Control': cc } : undefined,
  });

// 🩹 F107.1 — cross-request promise pollution (تحذير workerd الموثق) كيخلي
// query عابر فاشل (~1/6 فالبورست) + cold-start CPU roulette. النداء الواحد
// الفوري: retry وحدة بعد 120ms — النتيجة undefined = fail آمن (بلا side effects).
async function withRetry<T>(fn: () => Promise<T | undefined>): Promise<T | undefined> {
  const first = await fn().catch(() => undefined);
  if (first !== undefined) return first;
  await new Promise((r) => setTimeout(r, 120));
  return fn().catch(() => undefined);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // 1) proxy — Render حي = نفس السلوك حرفياً (query كيمرر كامل)
  const proxied = await pbProxy(request, '/api/products' + url.search);
  if (proxied) return proxied;

  // 2) fallback أصلي — الكاتالوگ من Supabase (Hyperdrive RO)
  try {
    const q = url.searchParams;

    // minimal chunked — server.js:3003
    if (q.get('minimal') === '1') {
      const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
      const data = await withRetry(() => dbProductsMinimal(page));
      if (data !== undefined) return json(data, 'public, s-maxage=3600, stale-while-revalidate=86400');
      return json({ error: 'Internal Server Error' }, 'no-store', 500);
    }

    // pagination mode — server.js:3019 (page presence قبل count — نفس الترتيب)
    if (q.get('page')) {
      const rows = await withRetry(() => dbCatalogPage(q));
      if (rows !== undefined) return json(rows, 'public, s-maxage=60, stale-while-revalidate=300');
      return json({ error: 'Internal Server Error' }, 'no-store', 500);
    }

    // عدّاد الفئة — server.js:3065
    if (q.get('count') === '1') {
      const data = await withRetry(() => dbCatalogCount(q));
      if (data !== undefined) return json(data);
      return json({ error: 'Internal Server Error' }, 'no-store', 500);
    }

    const search = q.get('search') || '';
    const category = q.get('category') || 'All';

    // bare — limit ولا FULL_CAP — server.js:3084
    if (search === '' && category === 'All') {
      const limitParam = parseInt(q.get('limit') || '', 10);
      if (Number.isFinite(limitParam) && limitParam > 0) {
        const rows = await withRetry(() => dbProductsLimit(Math.min(limitParam, 50))); // F#55 AntiClone
        if (rows !== undefined) return json(rows, 'public, s-maxage=600, stale-while-revalidate=3600');
        return json({ error: 'Internal Server Error' }, 'no-store', 500);
      }
      const rows = await withRetry(() => dbCatalogFull());
      if (rows !== undefined) return json(rows, 'public, s-maxage=600, stale-while-revalidate=3600');
      return json({ error: 'Internal Server Error' }, 'no-store', 500);
    }

    // بحث/تصنيف — server.js:3113
    const rows = await withRetry(() => dbCatalogSearch(q));
    if (rows !== undefined) return json(rows);
    return json({ error: 'Internal Server Error' }, 'no-store', 500);
  } catch (e) {
    console.warn('[pb-products] fallback failed:', e instanceof Error ? e.message : e);
    return json({ error: 'Internal Server Error' }, 'no-store', 500);
  }
}
