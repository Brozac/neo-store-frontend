'use client';

// ═══════════════════════════════════════════════════════════════════
// all-products v2.0 — مهاجر للكاتب الوحيد (Tenet #31) — الباب الثالث والأخير
// ═══════════════════════════════════════════════════════════════════
// تقييم صادق: هذا كان أنظف النسخ الثلاثة — أول دفعة كانت كتمر عبر loadMore(1)
// نفسها = تقدم الصفحة صحيح (ماكانش عندو باغ تكرار page=1) + حرس واحد لكل
// المسارات. ولكن كان النسخة الثالثة من نفس المنطق.
//
// اللي عطاه الـ hook مجاناً:
//   🛡️ dedup بالـ id — OFFSET-shift (massSync كيدخل منتجات بين صفحتين) مات
//   🛡️ حرس Array.isArray موحد (كان spread بلا حارس)
//   🩹 error/moreError منفصلين — فشل أول صفحة ≠ فشل صفحة زيادة
//      · moreError: الـ grid كيبقى كامل + auto-recovery بالسكرول أو الزر
//   🩹 retry داخلي بلا تجميد الحالة
//   🆕 🆕 العدّاد totalCount ولّى معروض فعلاً — الباكلوج الموثق "سطران" تسدّ
//      (كان كيتجاب من السيرفر وعمرو ما كيتعرض — dead code)
//   ✨ spinner من أول paint (كان loading=false = أول جلب بلا مؤشر)
//
// اللي تحافظ عليه: retry UX (Tenet #14) · prefetch 600px · end states · كل الـ JSX
//
// 🩹 v2.1 — Task 11 (تطبيق قرار eager + توحيد قواعد الثقة مع ProductCard):
//   FIX-EAGER — loading كان lazy على الكل حتى أول 4 كروت. هذه الصفحة بلا hero:
//               أول كارت هنا هو مرشح LCP رقم واحد → loading={i < 4 ? 'eager' : 'lazy'}
//               (i مطلق في المصفوفة المتراكمة — دفعات السكرول المضافة تلقائياً lazy)
//   FIX-TRUST — strikethrough كان بلا سقف: original_price مزيف من CJ (anchor pricing)
//               كان يعرض خصومات 9x% — الآن نفس قاعدة ProductCard بالحرف: يظهر فقط 1–89%
//   FIX-ZERO  — $0.00 على سعر مفقود كان قاتل ثقة — الصف يختفي (نفس ProductCard)
//   ملاحظة موثقة: مع unoptimized:true لا يوجد srcset → sizes معطلة اليوم، وتخدم يوم الـ flip
// ═══════════════════════════════════════════════════════════════════

import Image from 'next/image';
import Link from 'next/link';
import { IMG } from '@/lib/imageOptimizer';
import { useInfiniteFeed } from '@/lib/useInfiniteFeed';
import GlassIcon from '@/components/ui/GlassIcon';

interface P {
  id: number;
  title: string;
  price: number;
  original_price?: number | null;
  image_url: string;
  category: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
const PER_PAGE = 24;

export default function AllProducts() {
  // ═══ الكاتب الوحيد — التوصيل فقط ═══
  const feed = useInfiniteFeed<P>('all-products', true, {
    buildPageUrl: (page) => `${API}/api/products?page=${page}`,
    buildCountUrl: () => `${API}/api/products?count=1`,
    perPage: PER_PAGE,
  });

  const {
    products: items,   // alias — الـ JSX كيبقى كما هو
    loading,
    error,
    moreError,
    done,
    totalCount,
    sentinelRef,
    loadMore,
    retry,
  } = feed;

  return (
    <main className="min-h-screen bg-temu-offwhite">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-black text-temu-black tracking-tight"><GlassIcon ch="🛍️" size="xs" /> All Products</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Browse the full catalog — {items.length}
              {done
                ? ' products'
                : (totalCount > 0 ? ` of ${totalCount.toLocaleString()}` : '+')}
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-bold text-[#5B7EA6] hover:underline"
          >
            <GlassIcon i="arrowLeft" size="xs" /> Home
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {items.map((p, i) => {
            // 🩹 FIX-TRUST + FIX-ZERO — نفس قواعد ProductCard بالحرف (قاعدة واحدة في الموقع كله)
            const price = Number(p.price) || 0;
            const orig = Number(p.original_price) || 0;
            const disc = orig > price ? Math.round(((orig - price) / orig) * 100) : 0;
            const showOrig = disc > 0 && disc < 90;
            return (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="group bg-white rounded-2xl overflow-hidden border border-temu-gray-border-light hover:shadow-lg transition active:scale-[0.98]"
            >
              <div className="relative aspect-square bg-white">
                <Image
                  src={IMG.card(p.image_url)}
                  alt={p.title}
                  fill
                  // مع unoptimized:true لا srcset — sizes معطلة اليوم وتخدم يوم الـ flip
                  sizes="(max-width:640px) 50vw, 20vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  loading={i < 4 ? 'eager' : 'lazy'}
                />
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-temu-black line-clamp-2 leading-tight">
                  {p.title}
                </p>
                {/* 🩹 FIX-ZERO + FIX-TRUST — بلا سعر = بلا صف · بلا سقف 90% = بلا anchor مزيف */}
                {price > 0 && (
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <span className="text-sm font-black text-coral-600">
                      ${price.toFixed(2)}
                    </span>
                    {showOrig && (
                      <span className="text-[10px] text-gray-400 line-through">
                        ${orig.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
            );
          })}
        </div>

        {/* Sentinel + states */}
        <div ref={sentinelRef} className="h-10" />

        {loading && (
          <div className="text-center py-6">
            <div className="w-6 h-6 border-2 border-[#5B7EA6] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* 🩹 v2.0 — فشل أول صفحة (قاتل) — retry داخلي */}
        {error && !loading && (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs font-bold text-temu-black"><GlassIcon ch="⚠️" size="xs" /> {error}</p>
            <button
              onClick={retry}
              className="text-xs font-bold bg-[#5B7EA6] text-white px-5 py-2.5 rounded-xl active:scale-95 cursor-pointer"
            >
              <GlassIcon i="refresh" size="xs" /> Retry
            </button>
          </div>
        )}

        {/* 🩹 v2.0 — فشل صفحة زيادة (غير قاتل): الـ grid كامل قدامك —
            الـ retry بالزر أو غير كمّل سكرول (الـ observer حي وكيأكد أوتوماتيك) */}
        {moreError && !loading && !error && (
          <div className="text-center py-6 space-y-3">
            <p className="text-xs font-bold text-temu-black"><GlassIcon ch="⚠️" size="xs" /> {moreError}</p>
            <button
              onClick={loadMore}
              className="text-xs font-bold bg-[#5B7EA6] text-white px-5 py-2.5 rounded-xl active:scale-95 cursor-pointer"
            >
              <GlassIcon i="refresh" size="xs" /> Retry
            </button>
          </div>
        )}

        {done && items.length > 0 && (
          <p className="text-center text-xs text-gray-400 py-8">
            <GlassIcon ch="🏁" size="xs" /> You&apos;ve reached the end — {items.length} products
          </p>
        )}
        {done && items.length === 0 && !error && (
          <p className="text-center text-sm text-gray-500 py-16">
            No products available right now.
          </p>
        )}
      </div>
    </main>
  );
}