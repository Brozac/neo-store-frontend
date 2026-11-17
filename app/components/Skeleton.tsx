// ══════════════════════════════════════════════════════════════
// F#104 [skeleton] — placeholders بنفس geometry ديال المحتوى الحقيقي (zero CLS)
// العقد (DESIGN.md §6): fog shimmer بلا بنفسجي · reduced-motion إجباري (globals.css)
// بلا hooks ولا state — server-safe: loading.tsx وclient components بجوج يقدرو يستعملوه
// ══════════════════════════════════════════════════════════════

/** بلوك السكيلت الأساسي — ديكور: aria-hidden (القراءة كتدار من role=status فالجذر) */
export function Sk({ className = '' }: { className?: string }) {
  return (
    <div
      className={`bg-slate-200/70 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/** صف كارت منتج — يحاكي ProductCard: صورة مربعة بحقيبة Laclarc + سطرين عنوان + ثمن/شارة */
export function ProductCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className="break-inside-avoid mb-3 sm:mb-4 bg-white rounded-temu-sm overflow-hidden border border-temu-gray-border-light"
      aria-hidden="true"
    >
      <div
        className={`relative w-full ${
          tall ? 'aspect-[4/5]' : 'aspect-square'
        } bg-[#F4F7FA] flex items-center justify-center overflow-hidden`}
      >
        <img
          src="/error-bag.png"
          alt=""
          className="w-28 h-28 object-contain opacity-60 animate-pulse"
          style={{ mixBlendMode: 'multiply' }}
        />
      </div>
      <div className="p-2.5 space-y-2">
        <div className="h-3 w-11/12 bg-slate-200/70 rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-slate-200/70 rounded animate-pulse" />
        <div className="flex items-center justify-between pt-1">
          <div className="h-4 w-16 bg-slate-200/80 rounded animate-pulse" />
          <div className="h-4 w-10 bg-slate-200/60 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * شبكة كارتات — نفس columns ديال الهوم (masonry) · tall متبادل باش يعطي إيحاء الوترفول
 * count=10 للتحميل الأول · count=4 للفيد اللانهائي (الصف الجاي)
 */
export function GridSkeleton({
  count = 10,
  className = 'columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-live="polite">
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} tall={i % 3 === 1} />
      ))}
    </div>
  );
}

/** صفحة المنتج — معرض مربع بحقيبة Laclarc + مصغرات + عمود المعلومات */
export function PdpSkeleton() {
  return (
    <div className="min-h-screen bg-temu-offwhite font-sans" role="status" aria-live="polite">
      <span className="sr-only">Loading product…</span>
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-16 grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="w-full aspect-square rounded-2xl bg-[#F4F7FA] border border-temu-gray-border-light flex items-center justify-center">
            <img
              src="/error-bag.png"
              alt=""
              className="w-40 h-40 object-contain opacity-60 animate-pulse"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="w-16 sm:w-20 aspect-square rounded-xl bg-[#F4F7FA] border border-temu-gray-border-light flex items-center justify-center"
              >
                <img
                  src="/error-bag.png"
                  alt=""
                  className="w-8 h-8 object-contain opacity-45 animate-pulse"
                  style={{ mixBlendMode: 'multiply' }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4 pt-2">
          <Sk className="h-5 w-3/4" />
          <Sk className="h-4 w-1/3" />
          <Sk className="h-8 w-28" />
          <div className="flex gap-2 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <Sk key={i} className="w-11 h-11 rounded-full" />
            ))}
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Sk key={i} className="w-14 h-11 rounded-lg" />
            ))}
          </div>
          <Sk className="h-12 w-full rounded-full" />
          <Sk className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** صف مراجعة واحد — كيتحط داخل نفس grid المراجعات الحقيقي (PDC يستعملو مباشرة) */
export function ReviewRowSkeleton() {
  return (
    <div
      className="flex gap-3 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm mb-4 md:mb-0"
      aria-hidden="true"
    >
      <Sk className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Sk className="h-3 w-1/3" />
        <Sk className="h-3 w-20" />
        <Sk className="h-3 w-full" />
        <Sk className="h-3 w-5/6" />
      </div>
    </div>
  );
}

/** صفوف المراجعات — أفاتار + اسم + نجوم + نص، نفس بطاقة المراجعة الحقيقية */
export function ReviewsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="md:grid md:grid-cols-2 md:gap-4 mb-8" role="status" aria-live="polite">
      <span className="sr-only">Loading reviews…</span>
      {Array.from({ length: rows }, (_, i) => (
        <ReviewRowSkeleton key={i} />
      ))}
    </div>
  );
}

/** الكارت — صفوف منتوجات (مصغرة بحقيبة Laclarc + أشرطة) + بلوك المجموع */
export function CartSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" role="status" aria-live="polite">
      <span className="sr-only">Loading cart…</span>
      <Sk className="h-7 w-40 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex gap-3 items-center p-3 bg-white rounded-2xl border border-gray-200">
            <div className="w-20 h-20 rounded-xl shrink-0 bg-[#F4F7FA] flex items-center justify-center">
              <img
                src="/error-bag.png"
                alt=""
                className="w-11 h-11 object-contain opacity-55 animate-pulse"
                style={{ mixBlendMode: 'multiply' }}
              />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <Sk className="h-3 w-full" />
              <Sk className="h-3 w-1/2" />
              <Sk className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-white rounded-2xl border border-gray-200 space-y-3">
        <Sk className="h-3 w-2/3" />
        <Sk className="h-3 w-1/2" />
        <Sk className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}

/** الشيكاوت — عمود الفورم (حقول) + بطاقة الملخص */
export function CheckoutSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-6" role="status" aria-live="polite">
      <span className="sr-only">Loading checkout…</span>
      <div className="lg:col-span-2 space-y-4">
        <Sk className="h-6 w-48" />
        {Array.from({ length: 6 }, (_, i) => (
          <Sk key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        <Sk className="h-40 w-full rounded-2xl" />
        <Sk className="h-12 w-full rounded-full" />
      </div>
    </div>
  );
}

/** الكاتيݣوريات — بلاطات مربعة بحقيبة Laclarc */
export function TilesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading categories…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden="true" className="space-y-2">
          <div className="w-full aspect-square rounded-2xl bg-[#F4F7FA] border border-temu-gray-border-light flex items-center justify-center">
            <img
              src="/error-bag.png"
              alt=""
              className="w-24 h-24 object-contain opacity-60 animate-pulse"
              style={{ mixBlendMode: 'multiply' }}
            />
          </div>
          <Sk className="h-3 w-2/3 mx-auto" />
        </div>
      ))}
    </div>
  );
}

/** صفحة review الطلب — كارت فورم مصغر */
export function FormCardSkeleton() {
  return (
    <div className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-3">
        <Sk className="h-5 w-2/3" />
        <Sk className="h-11 w-full rounded-lg" />
        <Sk className="h-24 w-full rounded-lg" />
        <Sk className="h-11 w-full rounded-full" />
      </div>
    </div>
  );
}
