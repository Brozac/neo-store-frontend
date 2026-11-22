// POST /api/admin/sync-single-product — Phase I: Ingest PID + Lightning Deal ⚡
// GET /product/query?pid → pricing v3.1 (calculateSellingPrice) → phasei_upsert_imported_product
// → imported = phasei_toggle_deal (Auto Lightning Deal) → {message}
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { withDb, callFn } from '@/lib/admin-db';
import { cjFetch, calculateSellingPrice, sanitizeDescription } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

interface CjProduct {
  pid?: string;
  productName?: string;
  productNameEn?: string;
  productImage?: string;
  productImageSet?: string[];
  sellPrice?: string | number;
  productWeight?: string | number;
  categoryId?: string;
  categoryName?: string;
  materialNameEn?: string;
  productVideo?: string;
  description?: string;
  variants?: { sku?: string; sellPrice?: string | number; size?: string; color?: string }[];
}

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { pid?: unknown };
  const pid = String(body.pid ?? '').trim().slice(0, 64);
  if (!/^[0-9]{6,25}$/.test(pid)) {
    return NextResponse.json({ error: 'valid CJ pid required' }, { status: 400 });
  }

  try {
    const res = await cjFetch('/product/query', { query: { pid } });
    const env = res.data;
    const p = (env?.code === 200 ? env?.data ?? null : null) as CjProduct | null;
    if (!p || !p.pid) {
      return NextResponse.json({ error: 'Product not found on CJ' }, { status: 404 });
    }

    const pricing = calculateSellingPrice(p.sellPrice, Number(p.productWeight) || 0, null);
    const images = Array.isArray(p.productImageSet) ? p.productImageSet.slice(0, 10) : [];
    const sizes = Array.from(new Set((p.variants ?? []).map((v) => String(v.size ?? '').trim()).filter(Boolean))).slice(0, 30);
    const colors = Array.from(new Set((p.variants ?? []).map((v) => String(v.color ?? '').trim()).filter(Boolean))).slice(0, 30);

    const row = {
      pid: String(p.pid),
      title: String(p.productNameEn ?? p.productName ?? 'Product').slice(0, 300),
      price: pricing.safePrice,
      original_price: pricing.safeOriginalPrice,
      image_url: String(p.productImage ?? images[0] ?? '').slice(0, 1000),
      images,
      description: sanitizeDescription(p.description ?? ''),
      material: String(p.materialNameEn ?? '').slice(0, 200),
      colors,
      sizes,
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
    if (r === null) return NextResponse.json({ error: 'DB unavailable' }, { status: 502 });
    if (r.ok === false) {
      return NextResponse.json({ error: r.error }, { status: 400 });
    }

    const action = String(r.action ?? '');
    if (action === 'skipped_existing') {
      return NextResponse.json({ ok: true, message: `PID ${pid} already in catalog (id ${r.id}) — skipped.` });
    }

    // Auto Lightning Deal ⚡ — كما تعد الواجهة
    if (Number.isInteger(Number(r.id)) && Number(r.id) > 0) {
      await withDb((sql) => callFn(sql, 'phasei_toggle_deal', [Number(r.id)]));
    }
    return NextResponse.json({
      ok: true,
      message: `Product imported (id ${r.id}) at $${pricing.safePrice} — Lightning Deal activated.`,
    });
  } catch (e) {
    console.warn('[admin-sync-single] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to sync product.' }, { status: 502 });
  }
}
