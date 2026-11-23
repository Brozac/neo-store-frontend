// POST /api/webhooks/cj — phase-abc: CJ webhook للكاتالوگ في الـ worker (البند 7b)
// ═══════════════════════════════════════════════════════════════════════
// 🧭 قرار معماري موثق (درس تدقيق phase-abc — 2026-11-24):
//   rpc.laclarc.com (Phase E) هو مستقبل CJ webhook الحي والمسجل عند CJ —
//   ORDER/LOGISTIC/MAKEUP/WALLET عنده machine كاملة محصّنة (P0-20 probe ·
//   forward-only · shipment emails) — ما نكررهاش هنا أبداً (إيميلات مزدوجة =
//   خطر حقيقي). الفجوة الحقيقية اللي كيعوضها هادا الـ route:
//     · rpc كيتعامل مع PRODUCT/VARIANT/STOCK = أرشفة برك (ADR-E4) — الستوك
//       الحي يوصل للكاطوگ بعد ≤6h عبر الـ cron. هنا: تحديث فوري + purge.
//   إذن الـ route هادا:
//     · PRODUCT/VARIANT/STOCK → حارس ?k= (fail-closed 403 — نفس عقد rpc
//       catalog_gate_ok) → استجواب CJ مباشرة (نفس syncOneProductFromCj —
//       shape-agnostic، ما كيتوكلش على شكل payload) → كتابة مشروطة → purge
//     · ORDER → يُرفض للـ rpc صراحةً (سجل + 200 — ما كيمنعش CJ من الـ retry
//       ولا كيكسر شي شيء — rpc هو اللي مسجل عند CJ حياً)
//     · MAKEUP/WALLET/PRIVATE_ORDER → حارس ?k= + سجل برك (التحقق المالي
//       الكامل بالـ HMAC-MD5 candidates عند rpc — نسخة جزئية هنا = خطر رفض
//       خاطئ، فنأرشف ونعاود للـ rpc)
//
// ⚙️ إعداد المالك (اختياري — مفعّل فقط إلا سجل url الكاتالوگ عند CJ):
//   wrangler secret put CJ_WEBHOOK_SECRET   (نفس ?k= اللي فـ rpc أو جديد)
//   CJ Dashboard → الاشتراكات: PRODUCT/VARIANT/STOCK →
//     https://laclarc.com/api/webhooks/cj?k=<CJ_WEBHOOK_SECRET>
// ═══════════════════════════════════════════════════════════════════════
import { NextResponse } from 'next/server';
import { getPbRuntime, pbVar } from '@/lib/pb/pb-env';
import { getRwSql } from '@/lib/pb/pb-db';
import { syncOneProductFromCj, purgeZoneFiles } from '@/lib/price-sync';
import { bumpEdgeCacheVersion } from '@/lib/kv-store';

export const dynamic = 'force-dynamic';

interface CjWebhookEvent {
  type?: string;
  messageType?: string;
  messageId?: string;
  openId?: string;
  params?: Record<string, unknown>;
  [key: string]: unknown;
}

const CATALOG_TOPICS = new Set(['PRODUCT', 'VARIANT', 'STOCK']);
const FINANCIAL_TOPICS = new Set(['MAKEUP', 'WALLET', 'PRIVATE_ORDER']);

// idempotency per-isolate (best effort — الأمان الحقيقي فالـ SQL المشروط)
const seenMessages = new Set<string>();
function seenMessage(id: string): boolean {
  if (!id) return false;
  if (seenMessages.has(id)) return true;
  if (seenMessages.size > 500) seenMessages.clear();
  seenMessages.add(id);
  return false;
}

/** مقارنة ثابتة الوقت للسرّ (?k=) — نفس العقد تاع rpc timing_safe_eq */
function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** استخراج pid دفاعياً من كل المواقع المحتملة فالـ payload */
function extractPid(event: CjWebhookEvent): string {
  const sources: unknown[] = [
    event.params,
    event as Record<string, unknown>,
  ];
  const keys = ['pid', 'productId', 'productID', 'ProductId', 'product_id'];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of keys) {
      const v = (src as Record<string, unknown>)[k];
      const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
      if (s) return s.slice(0, 64);
    }
  }
  return '';
}

/** نبض cj_webhook_heartbeat — صف واحد (كشف صمت CJ — نفس H4 تاع rpc) */
async function heartbeat(
  sql: { unsafe(q: string, p?: unknown[]): Promise<Record<string, unknown>[]> },
  etype: string,
  mtype: string,
): Promise<void> {
  const t = mtype ? `${etype}/${mtype.slice(0, 40)}` : etype.slice(0, 60);
  try {
    const upd = await sql.unsafe(
      `UPDATE cj_webhook_heartbeat SET last_at = now(), last_type = $1 WHERE id = 1`,
      [t],
    );
    if (upd.length === 0) {
      await sql.unsafe(
        `INSERT INTO cj_webhook_heartbeat (id, last_at, last_type) VALUES (1, now(), $1)
         ON CONFLICT (id) DO UPDATE SET last_at = now(), last_type = EXCLUDED.last_type`,
        [t],
      );
    }
  } catch { /* fail-open */ }
}

async function logEvent(
  sql: { unsafe(q: string, p?: unknown[]): Promise<Record<string, unknown>[]> },
  eventType: string,
  details: Record<string, unknown>,
  severity: 'info' | 'warning' | 'error' = 'info',
): Promise<void> {
  try {
    await sql.unsafe(
      `INSERT INTO system_events (event_type, details, severity)
       VALUES ($1, $2::jsonb, $3)`,
      [eventType.slice(0, 120), JSON.stringify(details), severity],
    );
  } catch { /* fail-open */ }
}

/** المعالجة الخلفية — كل شيء fail-safe */
async function processCjEvent(event: CjWebhookEvent): Promise<void> {
  const type = String(event.type ?? '').trim();
  const mtype = String(event.messageType ?? '').slice(0, 40);
  const sql = await getRwSql();
  if (!sql) {
    console.warn('[wh-cj] rw unavailable — event', type);
    return;
  }
  try {
    await heartbeat(sql, type || 'EMPTY', mtype);

    if (CATALOG_TOPICS.has(type)) {
      // idempotency (retries)
      if (seenMessage(String(event.messageId ?? ''))) return;

      const pid = extractPid(event);
      if (!pid) {
        await logEvent(sql, 'WEBHOOK_CATALOG', { topic: type, messageType: mtype, note: 'no_pid_extracted' });
        return;
      }
      const prows = await sql.unsafe(
        `SELECT id, stock_status FROM products WHERE cj_product_id = $1 LIMIT 1`,
        [pid],
      );
      const row = prows[0];
      if (!row) {
        await logEvent(sql, 'WEBHOOK_CATALOG', { topic: type, pid, note: 'not_in_catalog' });
        return;
      }
      const id = Number(row.id);
      try {
        // نفس التدفق تاع الـ cron — استجواب CJ + كتابة مشروطة (ضد dead tuples)
        const changed = await syncOneProductFromCj(sql, id, pid, Boolean(row.stock_status));
        if (changed) {
          // purge نفس عقد edge-cache-purge: bump النسخة + zone purge للـ URLs الدقيقة
          await bumpEdgeCacheVersion();
          await purgeZoneFiles([id]);
          await logEvent(sql, 'WEBHOOK_CATALOG_SYNCED', { topic: type, pid, productId: id });
        }
      } catch (e) {
        await logEvent(
          sql,
          'WEBHOOK_CATALOG_SYNC_FAILED',
          { topic: type, pid, productId: id, error: e instanceof Error ? e.message : String(e) },
          'warning',
        );
      }
      return;
    }

    if (type === 'ORDER' || FINANCIAL_TOPICS.has(type)) {
      // 🔁 defer — rpc.laclarc.com هو المعالج المسجل حياً (شوف الهيدر فوق)
      await logEvent(sql, 'WEBHOOK_DEFERRED_TO_RPC', { topic: type, messageType: mtype });
      return;
    }

    // باقي المواضيع — سجل فقط
    await logEvent(sql, `WEBHOOK_${(type || 'UNKNOWN').slice(0, 100)}`, { messageType: mtype });
  } catch (e) {
    console.warn('[wh-cj] process failed:',
      e instanceof Error ? e.message : e);
  } finally {
    try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text().catch(() => '');

  let event: CjWebhookEvent;
  try {
    event = JSON.parse(rawBody) as CjWebhookEvent;
  } catch {
    return NextResponse.json({ code: 400, message: 'Bad JSON' }, { status: 400 });
  }
  const type = String(event.type ?? '').trim();

  // ─── حارس ?k= (fail-closed — نفس عقد rpc catalog_gate_ok) ───
  // PRODUCT/VARIANT/STOCK + المالية — كلهم كيتطلبو السرّ (الـ ORDER المرفض
  // للـ rpc أمانه عند rpc أصلاً — هنا سجل برك حتى إلا جا من غير سرّ)
  const { env, waitUntil } = await getPbRuntime();
  const url = new URL(request.url);
  const provided = (url.searchParams.get('k') || request.headers.get('x-cj-secret') || '').trim();
  const secret = pbVar(env, 'CJ_WEBHOOK_SECRET');

  if (CATALOG_TOPICS.has(type) || FINANCIAL_TOPICS.has(type)) {
    if (!secret) {
      console.error('[wh-cj] CJ_WEBHOOK_SECRET missing — fail-closed');
      return NextResponse.json({ code: 503, message: 'Webhook not configured' }, { status: 503 });
    }
    if (!provided || !timingSafeEqStr(provided, secret)) {
      console.warn('[wh-cj] catalog/financial topic without valid secret → 403');
      return NextResponse.json({ code: 403, message: 'Forbidden' }, { status: 403 });
    }
  }

  // 200 فوري + معالجة خلفية (نفس عقد rpc cj_webhook_entry)
  waitUntil(processCjEvent(event));
  return NextResponse.json({ code: 200, message: 'OK' });
}
