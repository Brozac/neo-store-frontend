// POST /api/admin/scrape-product — Phase I: سكرايب خارجي (Alibaba/AliExpress/أي صفحة)
// OpenGraph + JSON-LD — نفس العقد: {title, price, image_url, images, description}
// بلا أسرار ولا headless browser — fetch مباشر مع حد حجم + timeout
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const MAX_HTML = 3 * 1024 * 1024; // 3MB — لا ننزل الشي كلو

function metaTag(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*content=["']([^"']+["']`,
    'i',
  );
  const m = html.match(re);
  if (m) return m[1];
  // بعض الصفحات content قبل property
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+["'][^>]*(?:property|name)=["']${prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`,
    'i',
  );
  return html.match(re2)?.[1] ?? '';
}

function extractPrice(html: string): string {
  // JSON-LD offers.price (الأدق) — ثم fallback regex على قيم بالدولار
  try {
    const ldMatches = html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );
    for (const m of ldMatches) {
      const j = JSON.parse(m[1].trim()) as Record<string, unknown>;
      const candidates = [j, ...(Array.isArray(j['@graph']) ? (j['@graph'] as Record<string, unknown>[]) : [])];
      for (const c of candidates) {
        const offers = c?.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
        const o = Array.isArray(offers) ? offers[0] : offers;
        const price = (o as { price?: unknown } | undefined)?.price;
        if (price != null && Number(price) > 0) return String(price);
        const low = (o as { lowPrice?: unknown } | undefined)?.lowPrice;
        if (low != null && Number(low) > 0) return String(low);
      }
    }
  } catch { /* JSON-LD مكسور — نكمل */ }
  const m = html.match(/["']price["']\s*:\s*["']?(\d+(?:\.\d{1,2})?)["']?/i);
  return m?.[1] ?? '';
}

export async function POST(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const rawUrl = String(body.url ?? '').trim();
  let target: URL;
  try {
    target = new URL(rawUrl);
    if (!/^https?:$/.test(target.protocol)) throw new Error('bad protocol');
  } catch {
    return NextResponse.json({ error: 'valid http(s) URL required' }, { status: 400 });
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    });
    if (!res.ok) {
      return NextResponse.json({ error: `fetch failed (${res.status})` }, { status: 502 });
    }
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      const dec = new TextDecoder();
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value?.byteLength ?? 0;
        html += dec.decode(value, { stream: true });
        if (received > MAX_HTML) {
          void reader.cancel().catch(() => undefined);
          break;
        }
      }
    }

    const title = (metaTag(html, 'og:title') || metaTag(html, 'twitter:title') || '').slice(0, 300);
    const description = (metaTag(html, 'og:description') || metaTag(html, 'description') || '').slice(0, 5000);
    const mainImage = (metaTag(html, 'og:image') || metaTag(html, 'twitter:image') || '').slice(0, 1000);
    const gallery = [...html.matchAll(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+["']/gi)]
      .map((m) => m[1])
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .slice(0, 10);
    const price = extractPrice(html);

    if (!title && !mainImage) {
      return NextResponse.json(
        { error: 'Could not extract product data — page may require JavaScript rendering.' },
        { status: 422 },
      );
    }
    return NextResponse.json({
      title,
      price,
      image_url: mainImage,
      images: gallery.length ? gallery : mainImage ? [mainImage] : [],
      description,
    });
  } catch (e) {
    console.warn('[admin-scrape] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to fetch product details.' }, { status: 502 });
  }
}
