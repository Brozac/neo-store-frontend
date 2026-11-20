'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * F108 — GlobalImgFallback — الحارس الكلي ديال الصور (حماية 1 من 3)
 * ═══════════════════════════════════════════════════════════════════════
 * الصور hotlinked من CJ (cf.cjdropshipping.com…) — CJ كيقدر يمسح صورة فأي
 * لحظة (منتج ميت / sync / حقوق) → <img> مكسور قدام الزبون.
 *
 * الحارس: مستمع واحد عالمي بمرحلة capture (خطأ تحميل الصور ما كيبلغش
 * window بالـ bubbling) كيلقط أي <img> فشل فـ **كل** الصفحات — بلا تعديل
 * ولا component وحدة — وكيبدل الصورة الميتة بـ placeholder محلي
 * (/placeholder.jpg — public asset، بلا كوتا، بلا CJ).
 *
 * طبقات منع الحلقة اللانهائية (fallback ديال fallback):
 *   1) skip إلا الـ src أصلاً placeholder/icon محلي/data:/blob:
 *   2) data-imgfb="1" مرة وحدة على كل عنصر
 *   3) onErr كيتنفد مرة وحدة لكل عنصر (المسح بعد التبديل آمن)
 *
 * البلاغ (حماية 3): تجميع الـ URLs الميتة فالذاكرة + flush كل 30s أو
 * hidden → POST /api/img-report (sendBeacon → fetch keepalive).
 * الحارس fail-safe: كلشي فـ try/catch، ما يقدر يكسر الصفحة أبداً.
 *
 * الحدود المعروفة: صور background-image فالـ CSS ما كيتلقطوش (ما عندهمش
 * error event) — الـ <img> هوما 100% من الصور التجارية فالمشروع.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react';

const FALLBACK = '/placeholder.jpg';
const LOCAL_PREFIXES = [FALLBACK, '/icon-512.png', '/icon-192.png', 'data:', 'blob:'];

// ─── singleton خارج الـ component (حيا بـ HMR/Stray re-mounts) ───
const deadBuffer = new Map<string, number>();
let timersInstalled = false;
let flushing = false;

const BUFFER_CAP = 200;   // سقف الذاكرة — إلا الـ endpoint مات، ما نبلويوش
const FLUSH_MS = 30_000;
const FLUSH_BATCH = 50;

function isLocal(url: string): boolean {
  if (!url) return true;
  return (
    LOCAL_PREFIXES.some((p) => url.startsWith(p)) ||
    url.startsWith(`${window.location.origin}${FALLBACK}`)
  );
}

function flush() {
  if (flushing || deadBuffer.size === 0) return;
  flushing = true;
  const reports = Array.from(deadBuffer.entries())
    .slice(0, FLUSH_BATCH)
    .map(([url, n]) => ({ url, n }));
  const body = JSON.stringify({
    reports,
    page: typeof location !== 'undefined' ? location.pathname.slice(0, 300) : '',
    ts: Date.now(),
  });
  const fire = () => {
    flushing = false;
    if (deadBuffer.size > 0 && typeof window !== 'undefined') {
      window.setTimeout(flush, 1_000); // بقا خرد — flush آخر
    }
  };
  try {
    // sendBeacon = fire-and-forget — ما كيتبلوكيش hidden tab
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const ok = navigator.sendBeacon('/api/img-report', new Blob([body], { type: 'application/json' }));
      if (ok) {
        reports.forEach(({ url, n }) => {
          const cur = deadBuffer.get(url) || 0;
          if (cur - n <= 0) deadBuffer.delete(url);
          else deadBuffer.set(url, cur - n);
        });
        fire();
        return;
      }
    }
  } catch { /* ignore — نجاوب بـ fetch */ }
  try {
    fetch('/api/img-report', {
      method: 'POST',
      body,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    })
      .then(fire)
      .catch(fire);
  } catch {
    flushing = false;
  }
}

function handleBroken(el: HTMLImageElement) {
  try {
    const src = (el.currentSrc || el.src || '').slice(0, 2048);
    if (el.dataset.imgfb === '1' || isLocal(src)) return;

    // 1) خبّي المكسور — placeholder محلي
    el.dataset.imgfb = '1';
    el.dataset.imgOrig = src; // التتبع: شنو كانت الصورة الأصلية
    el.removeAttribute('srcset'); // 🩹 srcset قديم غادي يعاود يجيب الميت
    el.removeAttribute('sizes');
    el.loading = 'lazy';
    el.src = FALLBACK;

    // 2) سجّل للبلاغ (حماية 3)
    if (deadBuffer.size < BUFFER_CAP) {
      deadBuffer.set(src, (deadBuffer.get(src) || 0) + 1);
    } else if (deadBuffer.size === BUFFER_CAP && !deadBuffer.has(src)) {
      // سقف — نطيح الأقدم (أول مفتاح) ونزيد الجديد
      const oldest = deadBuffer.keys().next().value;
      if (oldest !== undefined) deadBuffer.delete(oldest);
      deadBuffer.set(src, 1);
    }
    if (deadBuffer.size >= FLUSH_BATCH) flush();
  } catch {
    /* الحارس ما يكسر والو */
  }
}

export default function GlobalImgFallback() {
  useEffect(() => {
    const onErr = (e: Event) => {
      const el = e.target as HTMLImageElement | null;
      if (el && el.tagName === 'IMG') handleBroken(el);
    };

    // 🩹 error على <img> ما كيطلعش بالـ bubbling — capture-phase فقط
    document.addEventListener('error', onErr, true);

    // 🩹 sweep أولي: صور تكسرات قبل ما يركب الحارس (SSR سريع / cache)
    const sweep = () => {
      try {
        document.querySelectorAll('img').forEach((im) => {
          if (im.complete && im.naturalWidth === 0) handleBroken(im);
        });
      } catch { /* ignore */ }
    };
    sweep();
    const t1 = window.setTimeout(sweep, 2_500); // بعد hydration
    const t2 = window.setTimeout(sweep, 8_000); // بعد الـ lazy images الأولى

    // timers ديال البلاغ — مرة وحدة فحياة الصفحة (singleton)
    if (!timersInstalled) {
      timersInstalled = true;
      window.setInterval(flush, FLUSH_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
    }

    return () => {
      document.removeEventListener('error', onErr, true);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return null;
}
