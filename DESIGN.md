# LACLARC — DESIGN.md · المصدر الرسمي للهوية البصرية

> v1.0 — 2026-11-16 · نشأت من **design-system audit** (منهجية knowledge-work-plugins/anthropics)
> + قواعد **taste-design** (anti-generic) + الـ SERENE V2 الحيّة (pd.css).
> هاد الوثيقة = العقد: أي كومبونونت/صفحة جديدة كتلتزم بها. أي استثناء = قرار موثق هنا.

---

## 1. الألوان (Design Tokens)

### 1.1 السلم الأساسي (Tailwind tokens فـ `app/globals.css` — `--color-*`)

| Token | Hex | الدور |
|---|---|---|
| `fog-50` | `#F4F8FB` | خلفيات ثانوية، أسطح مشاتلة (= `temu-offwhite`) |
| `fog-100` | `#DCE9F4` | halos، chips، خلفيات الأفاتار |
| `fog-400` | `#7FA1C4` | حدود ناعمة، حالات hover هادئة |
| `fog-500` | `#5B7EA6` | الـ primary الحيّ — بداية التدرج، hover text، الروابط |
| `fog-600` | `#46648A` | **الـ interactive الرئيسي** — حدود الاختيار، أزرار، تركيز (= القيمة الحيّة للـ token القديم `temu-orange` ⚠️ الاسم مخدّر، القيمة هي هي) |
| `fog-700` | `#3A5475` | hover deep، نص ثانوي قوي (= `temu-orange-bright`) |
| `fog-800` / `temu-black` / `ink` | `#2E4057` | **النص الأساسي** — عوض `#000000` (**ممنوع الأسود الخالص**) |
| `coral-400` | `#DFA5A5` | نهاية التدرج الوردي الناعم |
| `coral-500` | `#D98A8A` | الـ rose الأساسي — قلب المفضلة، بادجات |
| `coral-600` | `#B05C5C` | **accent** — أسعار، خصومات، أرقام مهمة، نهاية التدرج التوقيعي |
| `coral-700` | `#944848` | hover الوردي العميق |
| `maroccan-tea-600` | `#5D9600` | النجاح فقط — Added ✓، تأكيد الدفع، حالات التوصيل |
| `butter-up-400` | `#D0AC48` | **النجوم الذهبية فقط** — ممنوع استعماله فـ CTA أو بادجات |
| `temu-gray-border` | `#E2EBF3` | حدود البطاقات والحقول |

### 1.2 القواعد الدلالية (Semantic Rules)

1. **التدرج التوقيعي (Signature Gradient):** `from-fog-500 to-coral-600` — CTA الأساسي، النصوص المفعّلة. التدرج جوج لونين كحد أقصى.
2. **التفاعلية = fog-600:** أي حد/خلفية عنصر مختار (`selected/on`) — حدود 2px + `ring-2 ring-fog-600/30` كحد أقصى.
3. **النجاح = maroccan-tea-600 فقط:** ما تخلطش الأخضر مع حالات أخرى؛ الزر كيرجع للحالته الأصلية بعد ~2s.
4. **الخطأ/السعر = coral-600 فقط.** أحمر نقي ممنوع.

### 1.3 الممنوعات (Hard Bans) — قواعد taste-design

| ممنوع | عوضه |
|---|---|
| `#000000` الخالص | `#2E4057` (ink) أو `#2b2b2b` (off-black للسواتشات) |
| البنفسجي AI (`#6B3DB4`, `#7E56C4`, `#8B5CF6`...) | `fog-600` / `fog-500` — **تنقيح 2026-11-16: 13 موقع فـ PDC تحولو** |
| نيون / ساتوراسيون > 80% | ألوان معايرة من السلم الفوق |
| ألوان hardcoded جديدة فالكومبونونتات | tokens ديال globals.css أو قيمة موثقة هنا |
| أكثر من accent واحد فالشاشة | fog (تفاعل) + coral (accent) — حكاية وحدة |

> ⚠️ سكيلات `purple-s-baby-sister` / `violet-heaven` المسجلة فـ globals.css = **legacy غير مستعملة** — ممنوع استعمالها فكود جديد؛ الحذف الكامل backlog (كيتطلب audit ديال الاستعمال).

---

## 2. الخطوط (Typography)

| الدور | الخط | ملاحظات |
|---|---|---|
| **البراند فقط** (brandtag · brandname) | `Marcellus` — `next/font` عبر `.font-brand` | `letter-spacing: 0.28em` — ممنوع فالنصوص الطويلة |
| **الجسم كامل** | `font-sans` (system stack) | `<body className="... font-sans antialiased">` |

السلّم الهرمي: العناوين `font-black` · العناوين الفرعية `font-extrabold` · النص `font-bold/semibold` · الثانوي `font-bold text-xs text-gray-*`. ممنوع إضافة خط ثالث.

---

## 3. المساحات والزوايا والظلال

- **الزوايا:** `--radius-temu-sm: 12px` (بطاقات، أزرار رئيسية) · `--radius-temu-pill: 9999px` (chips، بادجات) · دوائر السواتشات `rounded-full`.
- **المسافات:** سلّم Tailwind الافتراضي (4px base)؛ الهوامش بين أقسام صفحة المنتج `my-8` كحد أدنى.
- **الظلال:** ناعمة ومشتلة — `shadow-sm/md` أو قيم بـ fog منخفضة (`rgba(46,64,87,.12–.2)`)؛ ممنوع ظلال سوداء ثقيلة.

---

## 4. عقد الكومبونونتات (Component Contract)

### 4.1 سواتشات الألوان — F#101 [color-swatches]

| الخاصية | القيمة |
|---|---|
| الحجم | 34px دائرة (`.pd-swatch`) · desktop chip 44px (`w-11 h-11`) |
| اللون | **دائماً عبر `getColorHex()` من `lib/colorHex.ts`** — hex صالح كيدوز كما هو، الاسم كيتطابق بالخريطة (الأطول أولاً)، المجهول → `#888888` موثق |
| المختار | `.on` — حلقة `var(--primary)` + `scale(1.02)` · desktop: `border-2 ring-2/30 + scale-110` |
| a11y | `aria-pressed` إجباري + `aria-label="Color {name}"` + `title={name}` |
| الممنوع | render hex خام من الداتا، لون مزيف عند الاسم المجهول، سواتش بلا aria |

**المصدر:** `lib/colorHex.ts` (مختبَر 21/21 — `scripts/verify-colorhex.ts` فالصندوق). المطابقة بالكلمات الكاملة (code-review F#102): "Bordered" ما كتوليش حمراء، والمركب بلا مسافات "SkyBlue" خدّام.

### 4.2 الأزرار

| النوع | الشكل |
|---|---|
| Primary CTA | تدرج التوقيع `from-fog-500 to-coral-600` + `rounded-temu-sm/pill` + `active:scale-95` |
| Success (بعد الإضافة) | `bg-maroccan-tea-600` + check — مؤقت ~2s ثم رجوع |
| ثانوي | أبيض + حد `gray-200` → hover حد `fog-500/50` + نص `fog-500` |

### 4.3 النصوص التسويقية (ux-copy)

1. **الصدق الرقمي:** أي ادعاء خصم كيبان بالدولار الحقيقي (`Save $X.XX`) — النسب المضللة ("Save 15%" على باندل خصمه جزئي) ممنوعة (درس phantom-15% فـ FBT).
2. **السلة كلمة وحدة:** "Cart" فكل الموقع — "Bag" محذوفة (توحيد 2026-11-16).
3. **الأفعال أولاً:** CTA كيبدا بفعل ("Add Both to Cart") — ماشي وصف.
4. **Empty state = 3 عناصر:** شنو وقع + علاش + كيفاش يصلح ("No products found matching these filters" + زر Clear).
5. **النجاح كيحترم الحالة:** "Both Added" غير إلا تزادو جوج عناصر فعلاً.

### 4.4 السكيلتات (Skeleton Loading) — F#104

**العقد:** `app/components/Skeleton.tsx` + كلاس `.sk` فـ `globals.css`.

1. **الستايل:** fog shimmer — بلوك `fog-100` + موجة `fog-200` كتجري 1.4s (`.sk::after` + `sk-sweep`). بلا بنفسجي، بلا ألوان خارج السلم.
2. **Reduced-motion إجباري:** `prefers-reduced-motion: reduce` → الموجة كتوقف والبلوك fog-200 ثابت (a11y).
3. **Geometry mirror:** السكيلت كيحاكي الشكل الحقيقي بنفس الأبعاد (aspect-square للصور، نفس الgrid `columns-2 md:columns-3 lg:columns-4` للهوم) — صفر layout shift ملي المحتوى يوصل.
4. **واحد المحتوى لكل بلاصة:** الهوم (loading + الفيد اللانهائي + Suspense) = `GridSkeleton` · PDP = `PdpSkeleton` فـ `loading.tsx` + `ReviewRowSkeleton` وقت fetch المراجعات · الكارت/الشيكاوت/الكاتيݣوري/الفوفوري/review = سكيلتات خاصة.
5. **a11y:** الجذر `role="status" aria-live="polite"` + `sr-only` نص — البلوكات الديكورية `aria-hidden`.
6. **Server-safe:** بلا hooks ولا state — يخدم فـ `loading.tsx` وclient components بجوج.
7. **ممنوع:** spinner كامل-صفحة كيحيد المحتوى الموجود (كان سبب CLS فالهوم) — السكيلت كيبدل غير البلاصة اللي كتستنى.

---

## 5. سجل الاستثناءات (Exceptions Log)

| الاستثناء | السبب | القرار |
|---|---|---|
| Token `temu-orange` قيمته fog-600 | اسم تاريخي من المرحلة الأولى — إعادة التسمية كتكسر PWA cache key | ⚠️ موثق — ما تبدلش القيمة، الاسم يتبنى backlog |
| `#888888` fallback للسواتش المجهول | الصدق قبل الجمال — بلا لون مزيف | ✅ معتمد (موثق فـ colorHex.ts) |
| `#2b2b2b` off-black فالسواتش | أسود المنتج الحقيقي بلا قسوة #000000 | ✅ معتمد |
| سكيلات ROSE DUO غير المستعملة (9 سكيلات) | مسجلة بطلب المالك — متاحة للمستقبل | ⚠️ محايدة — ممنوع استعمال البنفسجية منها |
| `#5F8271` sage قديم (75 بقعة باقية) | ثيم Sage القديم فـ admin + rings/footer/navbar — ماشي spinners | ⚠️ backlog: هجرة ثيم كاملة منفصلة (F#105-candidate) — spinners تصلحو فـ F#104 |

---

## 6. التغييرات الموثقة (Audit 2026-11-16)

- 🎨 **PDC ×13:** البنفسجي (`#6B3DB4`→`#46648A` fog-600 · `#7E56C4`→`#5B7EA6` fog-500 · ظل `rgba(126,86,196,.3)`→`rgba(91,126,166,.3)`) — صفر بنفسجي فالكومبونونتات (تحقق rg).
- 🎨 **F#101:** `lib/colorHex.ts` جديد — SWATCH_HEX/getColorHex القديمين (رمادي موحد) مربوطين بالخريطة المعايرة.
- 🩹 **FBT:** phantom-15% → وفر حقيقي بالدولار + رسالة نجاح شرطية + Bag→Cart.
- ♿ **a11y:** `aria-pressed` على المقاسات والسواتشات · `aria-label` على شيفرونات الريل (كاينين من colorrail) · roles فالدراورات (كاينين).
- 🦴 **F#104 skeleton:** `Skeleton.tsx` (8 سكيلتات) + `.sk` fog shimmer + reduced-motion · الهوم/PDP/كارت/فوفوري/كاتيݣوري/شيكاوت/review بدلوا spinners · spinners #5F8271 → fog-600.
