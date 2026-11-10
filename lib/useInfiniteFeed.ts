'use client';

// ═══════════════════════════════════════════════════════════════════════
// lib/useInfiniteFeed.ts — v1.0 — الكاتب الوحيد للـ Feed اللانهائي
// ═══════════════════════════════════════════════════════════════════════
// Tenet #31: وظيفة واحدة = باب واحد. كل صفحات الـ feed (home · category ·
// all-products) كتغذي من هنا — أي إصلاح مستقبلي كيتطبق مرة وحدة، وباغ التكرار
// ما عادو كيتطبعو في ملف ثالث.
//
// ── الباغات المكتشفة بالبرهان في الجولتين السابقتين — مغروزة هنا بالحرف ──
//   🩹 FIX-DUP (root)  : بعد نجاح أول جلب → next-to-fetch = 2. كان كيبقى 1
//                        → أول scroll/click كيجيب page=1 مرة ثانية ويزيدها
//                          بنفس ترتيب الـ shuffle = 24 منتج مكرر متجاورين.
//   🩹 FIX-DEAD        : `loading` في حارس الـ observer والـ deps — الـ sentinel
//                        كيتولد غير بعد ما loading=false، والـ deps ما كانتش
//                        كتتحرك → الـ observer عمرو كيتصاوب. (تشخيص M#58
//                        "حساس على بعض المتصفحات" كان غالط — كان الـ dep array).
//   🛡️ FIX-RACE (mutex): busyRef واحد للمسارين (observer + Load More). حراس
//                        منفصلين (ref vs state) = جلبان متوازيان لنفس الصفحة.
//   🛡️ FIX-RACE (gen)  : genRef في كل المسارات — لا إلحاق من سياق ميت عند
//                        تبديل الفئة في نص الطيران (Render cold start 5-15s
//                        = تلوث cross-category).
//   🛡️ FIX-DUP (net)   : dedup بالـ id في كل إلحاق — OFFSET-shift (massSync
//                        كيدخل منتجات بين صفحتين) · double-fire · retry: ماتو.
//   🩹 FIX-STALE       : نجاح بعد فشل مؤقت كيمسح الخطأ · retry() داخلي بلا
//                        window.location.reload (لا مسح للجلسة والسكرول).
//   🩹 FIX-RACE (count): العدّاد بـ AbortController + reset — لا عدّاد قديم
//                        تحت اسم فئة جديدة.
//
//   🔄 ROTATE-V1        : خيار mapPage اختياري — الصفحة الافتراضية كتمشي لصفحة
//                        حقيقية مدوّرة داخل K صفحات الكتالوج (بذرة عشوائية في
//                        كل زيارة) → المنتجات كيدخلو وكيخرجو كل مرة. القواعد:
//                        · fail-open: بلا عدّاد/فشل → identity (السلوك القديم)
//                        · كاش جلسة للعدّاد → الزيارات المتكررة بلا انتظار
//                        · overshoot guard: العدّاد قديم → رجوع آمن للصفحة 1
//                        · done = دورة كاملة (v ≥ K) — الصفحات الجزئية عادية
//                        · consumers بلا mapPage (الأقسام/all-products) = ما تغيّر والو

// ── عقد الاستعمال ──
//   · enabled=false كيجمد الـ feed (مثلاً وضع البحث) — المستهلك مسؤول ما يعرضش
//     حالة قديمة وهو مجمد (الهوم كيفرق بـ isBrowsing).
//   · done = وصلنا للنهاية (آخر صفحة < perPage).
//   · error = قاتل (أول صفحة فشلت) · moreError = غير قاتل (صفحة زيادة فشلت —
//     الـ grid كيبقى، والزر هو الـ retry).
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';

// 🔄 ROTATE-V1 — كاش عدّاد الكتالوج للجلسة (url → count) — الزيارات المتكررة
// كتبدا فوراً بالصفحة المدوّرة بلا انتظار RTT ديال العدّاد (fail-open دائماً)
const COUNT_CACHE_KEY = 'laclarc_count_cache';
function readCountCache(): { u: string; c: number } | null {
  try {
    const raw = sessionStorage.getItem(COUNT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.u === 'string' && typeof parsed.c === 'number' ? parsed : null;
  } catch { return null; }
}
function writeCountCache(u: string, c: number) {
  try { sessionStorage.setItem(COUNT_CACHE_KEY, JSON.stringify({ u, c })); } catch {}
}

export interface FeedItem {
  id: string | number;
  [key: string]: any;
}

export interface UseInfiniteFeedOptions<T> {
  /** URL الصفحة N — الصفحة الأولى ديما buildPageUrl(1) */
  buildPageUrl: (page: number) => string;
  /** URL العدّاد (?count=1) — اختياري. رجّع '' لتعطيل مؤقت (مثلاً نستنى slug map) */
  buildCountUrl?: () => string;
  /** حجم الصفحة — default 24 (مطابق للسيرفر mosaic) */
  perPage?: number;
  /** سلحسالفة حتمية لكل صفحة (الهوم: seed + page) — اختياري */
  shuffle?: (items: T[], page: number) => T[];
  /** 🔄 ROTATE-V1 — تحويل الصفحة الافتراضية (1..K) لصفحة حقيقية — اختياري
   *  K = عدد الصفحات (من العدّاد، fail-open: بلا عدّاد ما كيتستعملش) */
  mapPage?: (virtualPage: number, totalPages: number) => number;
  /** تحويل الاستجابة — default: حرس Array.isArray (موحد على كل المسارات) */
  parse?: (data: any) => T[];
  /** rootMargin ديال الـ observer — default '600px' (الهوم كتمرر '800px') */
  rootMargin?: string;
  /** تعطيل الـ observer كلياً (زر فقط) — default true */
  useObserver?: boolean;
  /** رسائل الخطأ — defaults بالإنجليزية (لغة واجهة الموقع) */
  errorText?: string;
  moreErrorText?: string;
}

// القيد widened: الـ hook كيحتاج غير id (dedup) — أي interface فيها id كيخدم
export function useInfiniteFeed<T extends { id: string | number } = any>(
  resetKey: string,
  enabled: boolean,
  options: UseInfiniteFeedOptions<T>
) {
  const perPage = options.perPage ?? 24;
  const rootMargin = options.rootMargin ?? '600px';
  const useObserver = options.useObserver ?? true;

  // هوية الـ options كتبدل كل render — الـ observer ما خاصوش يتفكك ويتركب على
  // كل تغيير هوية: نقرا دائماً من أحدث نسخة عبر ref (نمط latest-ref).
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const [products, setProducts] = useState<T[]>([]);
  const [page, setPage] = useState(1);            // next page to fetch
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);   // أول صفحة في الطيران
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');         // قاتل (أول صفحة)
  const [moreError, setMoreError] = useState(''); // غير قاتل (صفحة زيادة)
  const [totalCount, setTotalCount] = useState(0);
  const [retryNonce, setRetryNonce] = useState(0);

  const genRef = useRef(0);
  const busyRef = useRef(false);                  // 🛡️ mutex واحد للمسارين
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 🔄 ROTATE-V1 — plumbing ديال التدوير (فما كاين mapPage غير)
  const totalPagesRef = useRef(0);                // K الحالية (من العدّاد أو الكاش)
  const countPromiseRef = useRef<Promise<number> | null>(null);
  const rotationOffRef = useRef(false);           // overshoot guard → identity للجولة

  // ═══ عدّاد الحقيقة — قبل الصفحة الأولى (mapPage كينتظر الوعد ديالو) ═══
  // abort + reset (لا عدّاد قديم) + ROTATE: كاشر الوعد لي كينتظرو التدوير
  useEffect(() => {
    if (!enabled) return;
    const buildCountUrl = optsRef.current.buildCountUrl;
    if (!buildCountUrl) { countPromiseRef.current = null; return; }
    const url = buildCountUrl();
    if (!url) { countPromiseRef.current = null; return; }  // بوابة اختيارية من المستهلك
    const controller = new AbortController();
    setTotalCount(0);
    // 🔄 ROTATE — كاش الجلسة: نفس الـ url → K فورية بلا انتظار
    const cached = readCountCache();
    totalPagesRef.current = cached && cached.u === url && cached.c > 0
      ? Math.ceil(cached.c / perPage)
      : 0;
    countPromiseRef.current = fetch(url, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then((d: any) => {
        const count = Number(d?.count) || 0;
        if (count > 0) {
          setTotalCount(count);
          totalPagesRef.current = Math.ceil(count / perPage);
          writeCountCache(url, count);
        }
        return count;
      })
      .catch(() => 0);                            // تجميلي — صمت مقصود وموثق
    return () => controller.abort();
  }, [resetKey, enabled, retryNonce, perPage]);

  // ═══ الصفحة الأولى — Reset كامل عند resetKey/enabled/retry ═══
  useEffect(() => {
    if (!enabled) return;
    const gen = ++genRef.current;
    const controller = new AbortController();
    setLoading(true); setError(''); setMoreError('');
    setProducts([]); setDone(false); setPage(1);

    (async () => {
      try {
        // 🔄 ROTATE-V1 — تحضير K (fail-open): الكاش = فوري · أول زيارة = انتظار واحد
        let rotateActive = false;
        if (optsRef.current.mapPage) {
          if (totalPagesRef.current > 0) {
            rotateActive = true;
          } else if (countPromiseRef.current) {
            const c = await countPromiseRef.current;
            if (gen !== genRef.current) return;     // 🛡️ سياق أقدم — تجاهل
            if (c > 0) { totalPagesRef.current = Math.ceil(c / perPage); rotateActive = true; }
          }
        }
        rotationOffRef.current = false;

        const mapPage = optsRef.current.mapPage;
        let realPage = 1;
        if (rotateActive && mapPage) realPage = mapPage(1, totalPagesRef.current);

        const fetchPage = (rp: number) =>
          fetch(optsRef.current.buildPageUrl(rp), {
            cache: 'no-store',
            signal: controller.signal,
          }).then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          });

        let data = await fetchPage(realPage);
        if (gen !== genRef.current) return;       // 🛡️ سياق أقدم — تجاهل
        const parse = optsRef.current.parse;
        let arr: T[] = parse ? parse(data) : (Array.isArray(data) ? data : []);

        // 🛡️ ROTATE overshoot guard — العدّاد قديم/غالط والصفحة المدوّرة برا النهاية
        // → رجوع آمن للسلوك القديم (identity) للجولة كاملة
        if (rotateActive && realPage > 1 && arr.length === 0) {
          rotationOffRef.current = true;
          rotateActive = false;
          data = await fetchPage(1);
          if (gen !== genRef.current) return;
          arr = parse ? parse(data) : (Array.isArray(data) ? data : []);
        }

        setProducts(optsRef.current.shuffle ? optsRef.current.shuffle(arr, 1) : arr);
        if (rotateActive) {
          if (arr.length === 0) setDone(true);
          else setPage(2);                        // 🩹 FIX-DUP (root) — مغروز في الكاتب
        } else {
          if (arr.length < perPage) setDone(true);
          else setPage(2);                        // 🩹 FIX-DUP (root) — مغروز في الكاتب
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('[feed:first]', err);
          setError(optsRef.current.errorText ?? 'Unable to load products right now. Please check your connection.');
        }
      } finally {
        if (gen === genRef.current && !controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [resetKey, enabled, retryNonce, perPage]);

  // ═══ loadMore — الكاتب الوحيد للإلحاق (الزر والـ observer كلاهما هنا) ═══
  const loadMore = useCallback(async () => {
    if (busyRef.current || done || loading || !enabled) return;
    busyRef.current = true;
    setLoadingMore(true);
    const myGen = genRef.current;
    try {
      // 🔄 ROTATE-V1 — الصفحة الافتراضية → الصفحة الحقيقية المدوّرة (fail-open)
      const mapPage = optsRef.current.mapPage;
      const rotateActive = !!mapPage && !rotationOffRef.current && totalPagesRef.current > 0;
      const realPage = rotateActive && mapPage ? mapPage(page, totalPagesRef.current) : page;
      const res = await fetch(optsRef.current.buildPageUrl(realPage), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (genRef.current !== myGen) return;       // 🛡️ السياق تبدل — لا إلحاق من ميت
      const parse = optsRef.current.parse;
      const arr: T[] = parse ? parse(data) : (Array.isArray(data) ? data : []);
      setProducts(prev => {
        // 🛡️ FIX-DUP (net) — صمام أمان في كل إلحاق
        const seen = new Set(prev.map(p => String(p.id)));
        const fresh = arr.filter(p => !seen.has(String(p.id)));
        const list = optsRef.current.shuffle ? optsRef.current.shuffle(fresh, page) : fresh;
        return [...prev, ...list];
      });
      setMoreError('');                           // 🩹 FIX-STALE — نجاح يمسح الخطأ
      if (rotateActive) {
        // دورة كاملة حول الكتالوج — الصفحات الجزئية في النص عادية (نهاية كتالوج حقيقية)
        if (page >= totalPagesRef.current || arr.length === 0) setDone(true);
        else setPage(p => p + 1);
      } else {
        if (arr.length < perPage) setDone(true);
        else setPage(p => p + 1);
      }
    } catch (err: any) {
      console.error('[feed:more]', err);
      setMoreError(optsRef.current.moreErrorText ?? 'Failed to load more products. Please try again.');
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  }, [page, done, loading, enabled, perPage]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  // ═══ Infinite scroll — المشغّل فقط (المنطق كامل في loadMore) ═══
  useEffect(() => {
    if (!enabled || !useObserver || done || error || loading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      void loadMoreRef.current();                 // الـ mutex داخل loadMore هو الحارس
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, useObserver, done, error, loading, rootMargin]);

  // ═══ retry داخلي — بلا window.location.reload (لا مسح للجلسة) ═══
  const retry = useCallback(() => setRetryNonce(n => n + 1), []);

  return {
    products,
    loading,
    loadingMore,
    error,
    moreError,
    done,
    totalCount,
    sentinelRef,
    loadMore,
    retry,
  };
}
