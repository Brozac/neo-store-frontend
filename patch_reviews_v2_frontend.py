#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch_reviews_v2_frontend.py — كيت 36 [cj-reviews-v2] — هدف واحد:
app/products/[id]/ProductDetailsClient.tsx

واش كيزيد (9 هونكات جراحية — UI تاع قسم Customer Reviews فقط):
  1. فلتر النجوم: chips «All (17) · 5★ (14) · 4★ … 1★» بعدادات حية — باليت LaClarc
     (نشيط: تدرج #FF6B9D→rose-600 — نفس قرانيت زر الشراء الموثق لايف)
  2. «Load more reviews (N more)»: كيبدا بـ 6 (نفس v1) وكل ضغطة +6 — كيرجع للـ 6 كي تبدل الفلتر
  3. العدد الإجمالي الحقيقي: العنوان والملخص من meta.total (CJ) ماشي غير المحمّل
  4. حالة خاوية للفلتر + ملاحظة «Showing X of Y» إلا CJ عندها أكثر

🛡️ التوافق المزدوج (أهم قرارة فالكيت):
  applyReviewsPayload كيفهم الشكلين — array (backend قديم/فشل) ولا {reviews, meta} (v2)
  → التركيب آمن مهما كان ترتيب deploy الفرونت/الباك، والتراجع فأي جهة يبقى سليم.

المنهجية (نفس كيتات 34/33/32/31):
  · fail-closed: أنكور ≠ 1 → صفر كتابة + diag .txt · backup .bak-kit36 · idempotent
  · --check: RAW / PATCHED / UNKNOWN · CRLF محفوظ بالبايتات · pure-stdlib
"""
import sys
import os
import shutil

MARKER = "[cj-reviews v2]"

# ══════════════════════════════════════════════════════════════════
# الهونكات
# ══════════════════════════════════════════════════════════════════

HUNKS = [
    # ── F1: الواجهة — id تقبل سترينغ (صفوف CJ كنص cj-…) ──
    (
        "F1-review-id",
        """interface Review {
  id: number;""",
        """interface Review {
  id: number | string; // [cj-reviews v2] صفوف CJ بمعرفات نصية cj-…""",
    ),
    # ── F2: ثابت صفحة العرض ──
    (
        "F2-page-const",
        "type TabKey = (typeof TABS)[number]['key'];",
        """type TabKey = (typeof TABS)[number]['key'];

// ⭐ [cj-reviews v2] — «Load more» كيزيد بـ 6 كل ضغطة (نفس حجم الشبكة، نفس بداية v1)
const REVIEWS_PAGE = 6;""",
    ),
    # ── F3: الحالة + الاشتقاقات + المطبّع المزدوج ──
    (
        "F3-state",
        "  const [reviews, setReviews] = useState(initialReviews);",
        """  const [reviews, setReviews] = useState(initialReviews);
  // ⭐ [cj-reviews v2] — فلتر النجوم + Load more + الإجمالي الحقيقي (meta.total من CJ)
  const [starFilter, setStarFilter] = useState(0); // 0 = الكل · 1..5 فلتر نجمي
  const [visibleReviews, setVisibleReviews] = useState(REVIEWS_PAGE);
  const [reviewsMeta, setReviewsMeta] = useState<{ total: number; loaded: number; hasMore: boolean } | null>(null);

  // ⭐ [cj-reviews v2] — الإجمالي الحقيقي مع fallback للشكل القديم (array بلا meta)
  const realTotal = reviewsMeta?.total ?? reviews.length;

  const starCounts = useMemo(() => {
    const c: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const k = Math.round(r.rating);
      if (k >= 1 && k <= 5) c[k]++;
    }
    return c;
  }, [reviews]);

  const filteredReviews = useMemo(
    () => (starFilter === 0 ? reviews : reviews.filter(r => Math.round(r.rating) === starFilter)),
    [reviews, starFilter]
  );
  const shownReviews = filteredReviews.slice(0, visibleReviews);

  // 🛡️ [cj-reviews v2] — شكلين مقبولين: array (backend قديم) ولا {reviews, meta} (v2)
  //    → التركيب آمن مهما كان ترتيب deploy تاع الفرونت/الباك.
  const applyReviewsPayload = (data: unknown) => {
    if (Array.isArray(data)) {
      setReviews(data as Review[]);
      setReviewsMeta(null);
      return;
    }
    if (data && typeof data === 'object' && Array.isArray((data as { reviews?: unknown }).reviews)) {
      const payload = data as { reviews: Review[]; meta?: { total?: number; loaded?: number; hasMore?: boolean } };
      setReviews(payload.reviews);
      const m = payload.meta;
      const loaded = payload.reviews.length;
      setReviewsMeta(m
        ? { total: Number(m.total) || loaded, loaded: Number(m.loaded) || loaded, hasMore: Boolean(m.hasMore) }
        : null);
      return;
    }
    setReviews([]); // 🛡️ error shape غير-array كان يكسر الصفحة كاملة (نفس حماية v1)
    setReviewsMeta(null);
  };""",
    ),
    # ── F4: الفيتش الرئيسي — ?v2=1 + المطبّع ──
    (
        "F4-fetch",
        """    fetch(`${API_BASE_URL}/api/reviews/${product.id}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { setReviews(Array.isArray(data) ? data : []); }) // 🛡️ error shape غير-array كان يكسر الصفحة كاملة
      .catch((err) => { if (err?.name !== 'AbortError') console.warn('reviews: fetch failed', err); });""",
        """    fetch(`${API_BASE_URL}/api/reviews/${product.id}?v2=1`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { applyReviewsPayload(data); }) // 🛡️ [cj-reviews v2] شكلين مقبولين — array قديم ولا {reviews, meta}
      .catch((err) => { if (err?.name !== 'AbortError') console.warn('reviews: fetch failed', err); });""",
    ),
    # ── F5: ملخص النجوم فوق — العدد الحقيقي ──
    (
        "F5-summary-count",
        "                      ({reviews.length} verified rating{reviews.length > 1 ? 's' : ''})",
        "                      ({realTotal} verified rating{realTotal !== 1 ? 's' : ''})",
    ),
    # ── F6: refetch بعد إضافة ريفيوز — نفس المطبّع ──
    (
        "F6-refetch",
        """              fetch(`${API_BASE_URL}/api/reviews/${product.id}`)
                .then(r => r.json())
                .then(setReviews)
                .catch(() => {});""",
        """              fetch(`${API_BASE_URL}/api/reviews/${product.id}?v2=1`)
                .then(r => r.json())
                .then(data => applyReviewsPayload(data))
                .catch(() => {});""",
    ),
    # ── F7a: عنوان القسم — العدد الحقيقي ──
    (
        "F7a-header",
        '            <h2 className="text-lg font-black text-temu-black">Customer Reviews ({reviews.length})</h2>',
        '            <h2 className="text-lg font-black text-temu-black">Customer Reviews ({realTotal})</h2>',
    ),
    # ── F7b: chips الفلتر + الشبكة على shownReviews ──
    (
        "F7b-chips",
        """          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {reviews.slice(0, 6).map((rev) => (""",
        """          {/* ⭐ [cj-reviews v2] — فلتر النجوم بعدادات حية (الكل + 5★…1★) */}
          {reviews.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <button
                onClick={() => { setStarFilter(0); setVisibleReviews(REVIEWS_PAGE); }}
                className={starFilter === 0
                  ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#FF6B9D] to-rose-600 text-white shadow-sm transition-all duration-200'
                  : 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-gray-600 border border-gray-200 hover:border-[#FF6B9D]/50 hover:text-[#FF6B9D] transition-all duration-200'}
              >
                All ({realTotal})
              </button>
              {[5, 4, 3, 2, 1].map(s => (
                <button
                  key={s}
                  onClick={() => { setStarFilter(s); setVisibleReviews(REVIEWS_PAGE); }}
                  className={starFilter === s
                    ? 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-[#FF6B9D] to-rose-600 text-white shadow-sm transition-all duration-200'
                    : 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-white text-gray-600 border border-gray-200 hover:border-[#FF6B9D]/50 hover:text-[#FF6B9D] transition-all duration-200'}
                >
                  {s}★ ({starCounts[s]})
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {shownReviews.map((rev) => (""",
    ),
    # ── F7c: حالة خاوية + Load more قبل ReviewForm ──
    (
        "F7c-loadmore",
        """          </div>

          <ReviewForm
""",
        """          </div>

          {/* ⭐ [cj-reviews v2] — حالة خاوية للفلتر النشيط */}
          {reviews.length > 0 && filteredReviews.length === 0 && (
            <div className="text-center py-10 mb-8 border border-dashed border-gray-200 rounded-2xl text-sm text-gray-400">
              No reviews with this star rating yet.
            </div>
          )}

          {/* ⭐ [cj-reviews v2] — Load more + العدد المتبقي */}
          {filteredReviews.length > shownReviews.length && (
            <div className="flex flex-col items-center gap-2 mb-8">
              <button
                onClick={() => setVisibleReviews(c => c + REVIEWS_PAGE)}
                className="px-8 py-3 rounded-full text-sm font-black bg-gradient-to-r from-[#FF6B9D] to-rose-600 text-white hover:opacity-90 shadow-[0_4px_14px_rgba(255,107,157,0.3)] transition-all duration-300"
              >
                Load more reviews ({filteredReviews.length - shownReviews.length} more)
              </button>
              {reviewsMeta?.hasMore && (
                <span className="text-[11px] text-gray-400">
                  Showing {reviews.length} of {realTotal} reviews
                </span>
              )}
            </div>
          )}

          <ReviewForm
""",
    ),
]

TARGET_REL = os.path.join("app", "products", "[id]", "ProductDetailsClient.tsx")


# ══════════════════════════════════════════════════════════════════
# محرك الرقعة (نفس نمط كيت 34)
# ══════════════════════════════════════════════════════════════════

class Diag:
    def __init__(self, root):
        self.dir = os.path.join(root, "kit36-diag")
        self.lines = []
        self.root = root

    def note(self, msg):
        self.lines.append(msg)
        print(msg)

    def dump(self, relpath, content_bytes, why):
        try:
            os.makedirs(self.dir, exist_ok=True)
            base = os.path.basename(relpath).replace("[", "_").replace("]", "_").replace(".", "_")
            out = os.path.join(self.dir, base + ".kit36-diag.txt")
            with open(out, "wb") as f:
                f.write(content_bytes)
            self.note(f"  📋 diag: {os.path.relpath(out, self.root)} ({why})")
        except OSError as e:
            self.note(f"  ⚠️ diag write failed: {e}")

    def summary(self):
        try:
            os.makedirs(self.dir, exist_ok=True)
            out = os.path.join(self.dir, "REPORT.txt")
            with open(out, "w", encoding="utf-8") as f:
                f.write("\n".join(self.lines) + "\n")
        except OSError:
            pass


def detect_root():
    """لقاء جذر الفرونت: cwd + طلاعة للفوق + neo-store-frontend* / ./frontend"""
    cwd = os.getcwd()
    chain = [cwd, os.path.dirname(cwd), os.path.dirname(os.path.dirname(cwd))]
    cands = []
    for c in chain:
        cands.append(c)
        cands.append(os.path.join(c, "frontend"))
    try:
        for name in sorted(os.listdir(cwd)):
            low = name.lower()
            if ("frontend" in low or low.startswith("laclarc")) and os.path.isdir(os.path.join(cwd, name)):
                cands.append(os.path.join(cwd, name))
    except OSError:
        pass
    for c in cands:
        if os.path.isfile(os.path.join(c, TARGET_REL)):
            return c
    return None


def load(path):
    with open(path, "rb") as f:
        raw = f.read()
    text = raw.decode("utf-8")
    crlf = "\r\n" in text
    return raw, text, crlf


def adapt(s, crlf):
    return s.replace("\n", "\r\n") if crlf else s


def backup_once(path, rel):
    bak = path + ".bak-kit36"
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
        print(f"  💾 backup: {rel}.bak-kit36 (الأصل محفوظ — أول مرة)")
    else:
        print(f"  💾 backup موجود مسبقاً — ما تخطاش: {rel}.bak-kit36")


def count_occurrences(hay, needle):
    if not needle:
        return 0
    n = 0
    i = hay.find(needle)
    while i != -1:
        n += 1
        i = hay.find(needle, i + 1)
    return n


def main():
    args = [a for a in sys.argv[1:]]
    check_only = "--check" in args
    root_arg = None
    if "--root" in args:
        i = args.index("--root")
        if i + 1 < len(args):
            root_arg = args[i + 1]

    root = root_arg or detect_root()
    if not root:
        print("❌ ما لقيتش جذر الفرونت (app/products/[id]/ProductDetailsClient.tsx)")
        print("   حلّ الـ zip داخل جذر الفرونت ولا استعمل --root <path>")
        return 1

    target_path = os.path.join(root, TARGET_REL)

    print("═══════════════════════════════════════════════════")
    print("  كيت 36 [cj-reviews-v2] — فلتر + Load more + العدد الحقيقي (فرونت)")
    print(f"  root: {root}")
    print("═══════════════════════════════════════════════════")

    if not os.path.isfile(target_path):
        print(f"❌ MISSING: {TARGET_REL}")
        return 1

    diag = Diag(root)
    t_raw, t_text, t_crlf = load(target_path)

    # ── فحص الحالة ──
    t_patched = MARKER in t_text
    anchors_ok = all(count_occurrences(t_text, adapt(old, t_crlf)) == 1 for _n, old, _new in HUNKS)
    t_state = "PATCHED" if t_patched else ("RAW" if anchors_ok else "UNKNOWN")

    print(f"  tsx    : {t_state}{' (CRLF)' if t_crlf else ''} — {len(HUNKS)} hunks")

    if check_only:
        return 0

    if t_state == "UNKNOWN":
        print("❌ FAIL-CLOSED: أنكور مفقود أو مكرر — صفر كتابة.")
        missing = [
            (n, count_occurrences(t_text, old))
            for n, old, _new in HUNKS
            if count_occurrences(t_text, adapt(old, t_crlf)) != 1
        ]
        diag.note(f"tsx UNKNOWN — hunks mismatch: {missing}")
        diag.dump(TARGET_REL, t_raw, "anchors failed")
        diag.summary()
        print(f"   📨 صيفط مجلد {diag.dir} للمطوّر — رقعة مخصصة بلا تخمين.")
        return 1

    if t_state == "PATCHED":
        print("✅ NOTHING TO DO — [cj-reviews v2] مركب من قبل (idempotent)")
        return 0

    # ── تطبيق ──
    backup_once(target_path, TARGET_REL)
    new_t = t_text
    for name, old, new in HUNKS:
        old_a = adapt(old, t_crlf)
        new_a = adapt(new, t_crlf)
        if count_occurrences(new_t, old_a) != 1:
            print(f"❌ FAIL-CLOSED: هونك {name} ما لقاش الأنكور ديالو بالضبط — إلغاء كلي.")
            diag.note(f"hunk {name} failed — old×{count_occurrences(new_t, old_a)}")
            diag.dump(TARGET_REL, t_raw, f"hunk {name} failed")
            diag.summary()
            return 1
        new_t = new_t.replace(old_a, new_a, 1)

    if MARKER not in new_t:
        print("❌ حماية داخلية: الماركر ما دخلش للملف — إلغاء")
        return 1

    with open(target_path, "wb") as f:
        f.write(new_t.encode("utf-8"))
    print("  ✚ tsx: chips النجوم بعدادات + Load more (6/ضغطة) + حالة خاوية للفلتر")
    print("  ✚ tsx: realTotal من meta.total + applyReviewsPayload (شكلين — توافق مزدوج)")

    print("═══════════════════════════════════════════════════")
    print("✅ ركب [cj-reviews v2] فرونت بنجاح")
    print("   الخطوات: npm run build (تحقق TypeScript محلي)")
    print("            → deploy (نفس سير الفرونت المعتاد)")
    print("   التراجع: انسخ ProductDetailsClient.tsx.bak-kit36 فوق الأصل")
    return 0


if __name__ == "__main__":
    sys.exit(main())
