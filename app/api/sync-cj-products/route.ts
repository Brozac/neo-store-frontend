// GET /api/sync-cj-products — Phase I: Mass Sync Engine (bounded 12/نداء)
// listV2 (keyword اختياري) → أول 12 → query فردي → phasei_upsert_imported_product
// الموجود skip بلا overwrite — النداءات المتتالية (من اللوحة) كيكملو الكاتالوگ تدريجياً
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';
import { cjFetch, calculateSellingPrice, sanitizeDescription } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

const BATCH = 12;

interface CjListItem { pid?: string }
interface CjProduct {
  pid?: string;
  productName?: string;
  productNameEn?: string;
  productImage?: string;
  productImageSet?: string[];
  sellPrice?: string | number;
  productWeight?: string | number;
  categoryId?: string;
  materialNameEn?: string;
  productVideo?: string;
  description?: string;
  variants?: Record<string, unknown>[];
}

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const keyword = (new URL(request.url).searchParams.get('keyword') ?? '').trim().slice(0, 60);

  try {
    const res = await cjFetch('/product/listV2', {
      method: 'POST',
      body: {
        pageNum: 1,
        pageSize: BATCH,
        ...(keyword ? { productNameEn: keyword } : {}),
      },
    });
    const env = res.data;
    const d = (env?.code === 200 ? env?.data ?? null : null) as { list?: CjListItem[] } | null;
    const list = Array.isArray(d?.list) ? (d!.list as CjListItem[]) : [];
    if (list.length === 0) {
      return NextResponse.json({ ok: true, message: 'No CJ products returned for this batch.' });
    }

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    for (const item of list) {
      const pid = String(item?.pid ?? '').trim();
      if (!pid) continue;
      try {
        const q = await cjFetch('/product/query', { query: { pid } });
        const qenv = q.data;
        const p = (qenv?.code === 200 ? qenv?.data ?? null : null) as CjProduct | null;
        if (!p || !p.pid) {
          failed += 1;
          continue;
        }
        const pricing = calculateSellingPrice(p.sellPrice, Number(p.productWeight) || 0, null);
        const images = Array.isArray(p.productImageSet) ? p.productImageSet.slice(0, 10) : [];
        const row = {
          pid: String(p.pid),
          title: String(p.productNameEn ?? p.productName ?? 'Product').slice(0, 300),
          price: pricing.safePrice,
          original_price: pricing.safeOriginalPrice,
          image_url: String(p.productImage ?? images[0] ?? '').slice(0, 1000),
          images,
          description: sanitizeDescription(p.description ?? ''),
          material: String(p.materialNameEn ?? '').slice(0, 200),
          colors: [],
          sizes: [],
          category: 'other',
          cj_category_id: String(p.categoryId ?? '').slice(0, 64),
          variants: Array.isArray(p.variants) ? p.variants.slice(0, 100) : [],
          has_video: Boolean(p.productVideo),
          video_url: p.productVideo ? String(p.productVideo).slice(0, 600) : null,
          weight_grams: Math.round(Number(p.productWeight) || 0),
          volume_cm3: 0,
          sales_count: 0,
          delivery_cycle: '',
          free_shipping: false,
        };
        const r = await withDb((sql) => callFn(sql, 'phasei_upsert_imported_product', [row]));
        if (r?.ok === true) {
          if (r.action === 'imported') imported += 1;
          else skipped += 1;
        } else failed += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Sync batch done — imported: ${imported}, skipped (existing): ${skipped}, failed: ${failed}. Call again for the next batch.`,
    });
  } catch (e) {
    console.warn('[admin-sync-cj] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Mass sync failed to start.' }, { status: 502 });
  }
}
