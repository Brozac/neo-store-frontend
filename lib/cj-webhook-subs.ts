// lib/cj-webhook-subs.ts — تجديد اشتراكات ويبهوك CJ (البند B — عقد المالك 2026-11-27)
// ═══════════════════════════════════════════════════════════════════════
// الخلفية (تحقيق حي 2026-11-27): 999 اشتراك منتج (متجر B512) تديروا 2026-09-12
// والصلاحية 30 يوم (وثيقة webhook.html الرسمية) → كلهم منتهيين من 2026-10-12
// → الستوك/المنتجات الحية ما كانوش يوصلو. CJ ما يقبلش subscribeAll بعد يوليو
// 2026 — لازم IDs محددة ≤100/نداء، والتجديد idempotent (ما يستهلكش سقف إضافي
// وكيجدّد نافذة الـ 30 يوم من وقت النداء).
//
// العقد:
//   · كل نداءات cjFetch — نفس التوكن/الـ retries/حماية النقاط ديال الموقع
//   · فشل دفعة → نكمل البقية (fail-open) — العدادات في الرد وsystem_events
//   · cron يومي 04:30 UTC (CRON_WEBHOOK_RENEW) + تشغيل يدوي من
//     /api/admin/cj-webhook-maintain
//   · قائمة التجديد = نفس الـ IDs المشتركين حالياً (subscribe/list) — ما كنزيدوش
//     منتجات جديدة هنا (التوسيع قرار منفصل حسب سقف مستوى الحساب)
// ═══════════════════════════════════════════════════════════════════════
import { cjFetch } from './cf-cj';
import { openRwSql, logSystemEvent } from './cron-db';

/** متجر الـ API (B512) — معرّف مش سرّ؛ قابل للـ override عبر CJ_SHOP_ID */
const CJ_SHOP_ID_FALLBACK = '2607302219413525200';
const LIST_PAGE_SIZE = 200; // سقف الوثيقة 200
const LIST_MAX_PAGES = 10;
const SUBSCRIBE_BATCH = 100; // سقف الوثيقة 100 منتج/نداء
// QPS الكتابة عند CJ = 1/ثانية (تحقق حي: envelope code 429 "Too Many Requests")
// → مهلة إجبارية بين الدفعات + الـ 429 يعاود بـ backoff بدل ما يتعدّ فشل نهائي.
const SUBSCRIBE_GAP_MS = 1200;
const LIST_GAP_MS = 400;
const QPS_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface SubsRenewResult {
  ok: boolean;
  collected: number;
  renewed: number;
  failed: number;
  batches: number;
  ms: number;
  error?: string;
}

function cjShopId(): string {
  const v = process.env.CJ_SHOP_ID;
  return typeof v === 'string' && v.trim() ? v.trim() : CJ_SHOP_ID_FALLBACK;
}

/** IDs المشتركين حالياً (بصفحات 200 — نفسهم قائمة التجديد) */
async function collectSubscribedIds(): Promise<string[]> {
  const ids: string[] = [];
  let total = -1;
  for (let page = 1; page <= LIST_MAX_PAGES; page++) {
    if (page > 1) await sleep(LIST_GAP_MS);
    const res = await cjFetch('/webhook/product/subscribe/list', {
      query: { shopId: cjShopId(), pageNum: page, pageSize: LIST_PAGE_SIZE },
      timeoutMs: 20000,
    });
    const envData = res.data;
    if (!envData || envData.code !== 200) {
      throw new Error(`subscribe/list p${page}: ${String(envData?.message || 'bad envelope')}`);
    }
    const d = (envData.data ?? {}) as { content?: { productId?: unknown }[]; totalRecords?: number };
    const content = Array.isArray(d.content) ? d.content : [];
    if (typeof d.totalRecords === 'number') total = d.totalRecords;
    for (const row of content) {
      const pid = String(row?.productId ?? '').trim();
      if (pid) ids.push(pid);
    }
    if (content.length === 0 || (total >= 0 && ids.length >= total)) break;
  }
  return ids;
}

/**
 * تجديد كل الاشتراكات الحالية — cron وroute اليدوي كيخدمو بنفس الدالة.
 * env اختياري: كيتعطى من cron/route باش اللوج يمشي لـ system_events (fail-open).
 */
export async function renewCjWebhookSubscriptions(
  env?: CfCronEnv,
): Promise<SubsRenewResult> {
  const t0 = Date.now();
  const base: SubsRenewResult = {
    ok: false, collected: 0, renewed: 0, failed: 0, batches: 0, ms: 0,
  };
  let sql: Awaited<ReturnType<typeof openRwSql>> = null;
  if (env) {
    try { sql = await openRwSql(env); } catch { sql = null; }
  }

  try {
    const ids = await collectSubscribedIds();
    base.collected = ids.length;
    if (ids.length === 0) {
      base.ok = true;
      base.ms = Date.now() - t0;
      if (sql) {
        await logSystemEvent(sql, 'WEBHOOK_SUBS_RENEWED', { note: 'no_subscriptions_found' }, 'warning');
      }
      return base;
    }

    for (let i = 0; i < ids.length; i += SUBSCRIBE_BATCH) {
      const batch = ids.slice(i, i + SUBSCRIBE_BATCH);
      base.batches += 1;
      if (base.batches > 1) await sleep(SUBSCRIBE_GAP_MS);

      let done = false;
      for (let attempt = 0; attempt <= QPS_RETRIES && !done; attempt++) {
        if (attempt > 0) await sleep(2000 * attempt);
        try {
          const res = await cjFetch('/webhook/product/subscribe', {
            method: 'POST',
            body: { productIds: batch, subscribeAll: false },
            timeoutMs: 30000,
          });
          const envData = res.data;
          if (envData?.code === 200) {
            const d = (envData.data ?? {}) as { successProductIds?: string[]; failProductIds?: string[] };
            base.renewed += Array.isArray(d.successProductIds) ? d.successProductIds.length : 0;
            base.failed += Array.isArray(d.failProductIds) ? d.failProductIds.length : 0;
            done = true;
          } else if (
            envData?.code === 429 ||
            String(envData?.message || '').includes('429') ||
            String(envData?.message || '').toLowerCase().includes('too many')
          ) {
            continue; // QPS — يعاود بـ backoff
          } else {
            base.failed += batch.length;
            base.error = String(envData?.message || `batch ${base.batches} bad envelope`);
            done = true;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (
            (msg.includes('429') || msg.toLowerCase().includes('too many')) &&
            attempt < QPS_RETRIES
          ) {
            continue; // QPS — يعاود بـ backoff
          }
          base.failed += batch.length;
          base.error = msg;
          done = true;
        }
      }
      if (!done) {
        base.failed += batch.length;
        base.error = `batch ${base.batches}: 429 retries exhausted`;
      }
    }

    base.ok = base.renewed > 0;
    base.ms = Date.now() - t0;
    if (sql) {
      await logSystemEvent(
        sql,
        'WEBHOOK_SUBS_RENEWED',
        {
          collected: base.collected,
          renewed: base.renewed,
          failed: base.failed,
          batches: base.batches,
          ms: base.ms,
          error: base.error || undefined,
        },
        base.failed > 0 ? 'warning' : 'info',
      );
    }
    return base;
  } catch (e) {
    base.ms = Date.now() - t0;
    base.error = e instanceof Error ? e.message : String(e);
    if (sql) {
      await logSystemEvent(sql, 'WEBHOOK_SUBS_RENEW_FAILED', { error: base.error }, 'error');
    }
    return base;
  } finally {
    if (sql) {
      try { await sql.end({ timeout: 3 }); } catch { /* backstop */ }
    }
  }
}
