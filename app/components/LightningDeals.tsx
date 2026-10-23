'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { IMG } from '@/lib/imageOptimizer';
import GlassIcon from '@/components/ui/GlassIcon';

interface Product {
  id: number;
  title: string;
  price: number;
  original_price: number;
  image_url: string;
}

// ══════════════════════════════════════════════════════════════════
// Flash Sale v3 — MERGE_MOCKUP (دمج ذكي — موكاب الصفحة الرئيسية)
//
// قبل: ثيم "البرق" الداكن (turbulence filters + glow layers) — بطولي
//      وبعيد على روح الموكاب.
// دابا: نفس القسم في الموكاب حرفياً — صف كروت أفقي نظيف:
//      صورة على خلفية fog-50 مدوّرة · عنوان سطرين · سعر وردي (قرار
//      المالك) + سعر قديم مشطوب + بادج خصم بنفسجي فاتح.
//
// ✅ محفوظ من v2: عدّاد 5 ساعات متجدد (نفس المنطق حرفياً) + البيانات
//    من /api/products/deals + روابط المنتجات.
// ✅ هوية Laclarc: fog للعدّاد والبادج، coral-600 للأسعار، GlassIcon.
// 🧹 محذوف: SVG turbulence (كان كيتحمل فالـ paint)، stockLeft شبه
//    العشوائي (عنصر مزيف بصرياً)، الطبقات الداكنة.
// ══════════════════════════════════════════════════════════════════

export default function LightningDeals({ products }: { products: Product[] }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 4, minutes: 48, seconds: 20 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // ضبط العداد ليدوم 5 ساعات متجددة تلقائياً (من v2 — بلا تغيير)
    const target = new Date();
    target.setHours(target.getHours() + 5);

    const timer = setInterval(() => {
      const now = new Date();
      const difference = target.getTime() - now.getTime();
      if (difference <= 0) target.setHours(target.getHours() + 5);

      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!products || products.length === 0) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section className="my-8">
      {/* الرأس — كيما الموكاب: العنوان + العدّاد + See All */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-black text-temu-black flex items-center gap-1.5">
          Flash Sale <span aria-hidden="true">⚡</span>
        </h2>

        <div className="flex items-center gap-2.5 shrink-0">
          <span
            className="font-mono text-xs font-black text-fog-700 bg-fog-50 border border-fog-200/70 px-2.5 py-1 rounded-lg tabular-nums"
            aria-label="Deal countdown"
          >
            {isMounted ? `${pad(timeLeft.hours)}:${pad(timeLeft.minutes)}:${pad(timeLeft.seconds)}` : '04:48:20'}
          </span>
          <Link
            href="/all-products"
            className="text-xs font-bold text-fog-600 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            See All <GlassIcon i="arrowRight" size="xs" />
          </Link>
        </div>
      </div>

      {/* صف الكروت الأفقي — سكرول لمسي ناعم */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide touch-pan-x pb-2 -mx-4 px-4">
        {products.map((p) => {
          const safePrice = Number(p.price) || 0;
          const safeOldPrice = Number(p.original_price) || 0;
          const discount = safeOldPrice > safePrice
            ? Math.round(((safeOldPrice - safePrice) / safeOldPrice) * 100)
            : 0;
          const img = IMG.card(p.image_url || '/icon-512.png');

          return (
            <Link
              href={`/products/${p.id}`}
              key={p.id}
              className="group w-36 sm:w-40 shrink-0 cursor-pointer active:scale-[.97] transition-transform touch-manipulation"
            >
              <div className="relative aspect-square rounded-2xl bg-fog-50 overflow-hidden ring-1 ring-fog-100">
                <img
                  src={img}
                  alt={p.title}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              <h3 className="text-xs font-bold text-temu-black line-clamp-2 mt-2 leading-snug">
                {p.title}
              </h3>

              {/* صف السعر — كيما الموكاب: سعر + قديم مشطوب + بادج خصم */}
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="text-sm font-black text-coral-600">${safePrice.toFixed(2)}</span>
                {safeOldPrice > safePrice && (
                  <>
                    <span className="text-[11px] text-temu-gray-light line-through font-semibold">
                      ${safeOldPrice.toFixed(2)}
                    </span>
                    <span className="bg-fog-100 text-fog-700 text-[10px] font-black px-1.5 py-0.5 rounded-md">
                      -{discount}%
                    </span>
                  </>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
