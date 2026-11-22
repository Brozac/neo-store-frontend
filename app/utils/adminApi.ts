// utils/adminApi.ts — Phase I: جدول توجيه (routing table)
// ═══════════════════════════════════════════════════════════════════════
// الافتراضي: same-origin (/api/... على laclarc.com) — الجار Next + دوال phasei_*
// RPC_PREFIXES: الباقية على rpc.laclarc.com (Express) — اللي مازال ما انتقلش:
//   · /admin/settings (GET + PUT subkeys — كوكيز rpc)
//   · /admin/system-events (SELECT system_events)
//   · /admin/webhook (register/subscribe — مفاتيح CJ عند rpc)
// كوكي الجلسة: admin_token (rpc) + admin_token_next (Next) — جوج كوكيز وضوح
// الفصل، كلاهما Domain=.laclarc.com — كيتصيفطو أوتوماتيكياً مع withCredentials.
// ═══════════════════════════════════════════════════════════════════════
import axios from 'axios';

const rpcBase = (process.env.NEXT_PUBLIC_API_URL || 'https://rpc.laclarc.com').replace(/\/+$/, '');

const RPC_PREFIXES = ['/admin/settings', '/admin/system-events', '/admin/webhook'];

function resolveUrl(url: string): string {
  if (RPC_PREFIXES.some((p) => url === p || url.startsWith(`${p}?`) || url.startsWith(`${p}/`))) {
    return `${rpcBase}/api${url}`;
  }
  return `/api${url}`;
}

const adminApi = axios.create({
  timeout: 60000,
  withCredentials: true, // ضروري لإرسال واستقبال كوكيز الجلسة (admin_token + admin_token_next)
});

// توجيه كل طلب — before: config.url كان relative، بعد: كامل
adminApi.interceptors.request.use((config) => {
  if (typeof config.url === 'string' && config.url.startsWith('/')) {
    config.url = resolveUrl(config.url);
  }
  return config;
});

// ✨ Phase H v2 — بعد كل تعديل ناجح على الكاطالوگ → purge فوري للكاش الحافي.
// fire-and-forget: الpurge best-effort — الـ TTL (60-600s) هو شبكة الأمان.
const CATALOG_MUTATION_RE =
  /\/admin\/(update-product|delete-product|toggle-deal|videos|add-product|sync-single-product|update-category|sync-categories|backfill-categories|auto-categorize|scrape-product|merge)\b/;

function triggerEdgeCachePurge(response: { config?: { method?: string; url?: string; data?: unknown } }) {
  try {
    if (typeof window === 'undefined') return;
    const cfg = response.config || {};
    const method = (cfg.method || '').toLowerCase();
    const url = typeof cfg.url === 'string' ? cfg.url : '';
    if (method === 'get' || !CATALOG_MUTATION_RE.test(url)) return;
    // sync-single-product كيمرر المعرف فالbody — نستخرجو باش الpurge يخاص المنتج بالضبط
    let productId: number | undefined;
    try {
      const body = typeof cfg.data === 'string' ? JSON.parse(cfg.data) : cfg.data;
      const cand = (body as { productId?: unknown; id?: unknown; product_id?: unknown })
        ?.productId ?? (body as { id?: unknown })?.id ?? (body as { product_id?: unknown })?.product_id;
      if (Number.isInteger(cand) && Number(cand) > 0) productId = Number(cand);
    } catch { /* body ماشي JSON — عادي */ }
    void fetch('/api/edge-cache-purge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: url, productId }),
      keepalive: true,
    }).catch(() => undefined);
  } catch { /* الpurge ما يقدرش يكسر الاستجابة أبداً */ }
}

// ✨ اعتراض الاستجابات والتعامل مع انتهاء الجلسة (401 & 403) بأمان تام
adminApi.interceptors.response.use(
  (response) => {
    triggerEdgeCachePurge(response);
    return response;
  },
  (error) => {
    const status = error.response?.status;

    // فحص انتهاء الجلسة أو غياب الصلاحيات
    if (status === 401 || status === 403) {
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;

        // ✨ منع الـ Infinite Loop إذا كان الأدمن بالفعل في صفحة الدخول
        if (!currentPath.startsWith('/admin/login')) {
          console.warn('🔒 Admin session expired. Redirecting to security gateway...');
          window.location.href = '/admin/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default adminApi;
