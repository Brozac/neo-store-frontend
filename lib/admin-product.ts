// lib/admin-product.ts — Phase I: parser مشترك لـ payload المنتج (add/update)
// الحرس الحقيقي في الدوال المضيقة — هنا فقط التطهير والحدود (نفس الحراس UX)
import 'server-only';

export interface ProductPayload {
  title: string;
  price: number;
  original: number | null;
  image_url: string;
  images: string[];
  description: string;
  material: string;
  colors: string[];
  sizes: string[];
  category: string;
}

export function parseProductPayload(body: Record<string, unknown>): ProductPayload {
  const title = String(body.title ?? '').trim().slice(0, 300);
  const price = Number(body.price);
  const rawOriginal = body.original_price;
  const original =
    rawOriginal === null || rawOriginal === '' || rawOriginal === undefined
      ? null
      : Number(rawOriginal);
  const image_url = String(body.image_url ?? body.image ?? '').trim().slice(0, 1000);
  const asStrArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim().slice(0, 200)).filter(Boolean)
      : typeof v === 'string'
        ? v.split(',').map((x) => x.trim().slice(0, 200)).filter(Boolean)
        : [];
  const images = asStrArr(body.images);
  const description = String(body.description ?? '').slice(0, 20000);
  const material = String(body.material ?? '').slice(0, 200);
  const colors = asStrArr(body.colors);
  const sizes = asStrArr(body.sizes);
  const category = String(body.category ?? 'other').trim().slice(0, 300) || 'other';
  return { title, price, original, image_url, images, description, material, colors, sizes, category };
}
