// ═══════════════════════════════════════════════════════════════════════
// types/cf-worker.d.ts — أنواع الـ runtime السحابية للـ cron/webhooks (phase-abc)
// ═══════════════════════════════════════════════════════════════════════
// ليش أنواع يدوية (بلا @cloudflare/workers-types)؟ نفس سياسة الريبو:
//   structural typing بلا dependency إضافية — الشكل المطلوب فقط، fail-safe.
// تُستعمل في: custom-worker.ts · lib/cron-* · lib/merchant-feed-r2 · lib/analytics.
//
// ملاحظة: الـ binding STORE_KV (إلا ما كاينش فالـ wrangler) كيتحلل وقت التشغيل
//   عبر resolver كيفضل STORE_KV ثم NEXT_INC_CACHE_KV — شوف lib/kv-store.ts.
// ═══════════════════════════════════════════════════════════════════════

/** جزء صغير من KVNamespace — الكافي للتوكن/النسخ/الأسعار */
interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

/** جزء صغير من R2Bucket — القراءة + الرفع المتعدد الأجزاء (feeds ~60MB) */
interface R2UploadedPartLike {
  partNumber: number;
  etag: string;
}

interface R2MultipartUploadLike {
  uploadPart(partNumber: number, value: Uint8Array): Promise<R2UploadedPartLike>;
  complete(parts: R2UploadedPartLike[]): Promise<unknown>;
  abort(): Promise<void>;
}

interface R2ObjectLike {
  body: ReadableStream;
  size?: number;
  httpEtag?: string;
  etag?: string;
  customMetadata?: Record<string, string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: string | Uint8Array | ReadableStream,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  createMultipartUpload(
    key: string,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    },
  ): Promise<R2MultipartUploadLike>;
}

/** Analytics Engine dataset — writeDataPoint fail-open دائماً */
interface AnalyticsDatasetLike {
  writeDataPoint(blobs?: unknown[], indexes?: unknown[]): void;
}

/** env المُمرر للـ scheduled handler (bindings + secrets كسلاسل) */
interface CfCronEnv {
  MEDIA_BUCKET?: R2BucketLike;
  STORE_KV?: KVNamespaceLike;
  NEXT_INC_CACHE_KV?: KVNamespaceLike;
  STORE_ANALYTICS?: AnalyticsDatasetLike;
  HYPERDRIVE?: { connectionString?: string };
  // السرّات كسلاسل على env — الاتحاد مع process.env في lib/cron-runner
  RW_DATABASE_URL?: string;
  CJ_WEBHOOK_SECRET?: string;
  [key: string]: unknown;
}

interface CronControllerLike {
  cron: string;
}

interface WorkerCtxLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// ─── .open-next/worker.js كيتولد وقت البيلد (opennextjs-cloudflare build) —
// هذا التصريح يخلي tsc يمرر حتى قبل أول build؛ عند وجود الملف الحقيقي
// TypeScript كيستعمل الملف نفسه (التصريح wildcard احتياط فقط).
declare module '*.open-next/worker.js' {
  const worker: {
    fetch: (req: Request, env: CfCronEnv, ctx: WorkerCtxLike) => Promise<Response>;
  };
  // DOQueueHandler — Durable Object طابور الـ revalidate (كيصدّر من الـ entry)
  export class DOQueueHandler {
    constructor(state: unknown, env: CfCronEnv);
    fetch(request: Request): Promise<Response>;
  }
  export default worker;
}
