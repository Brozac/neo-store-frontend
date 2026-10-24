import { ImageResponse } from 'next/og';

// ═══════════════════════════════════════════════════════════════════
// 🩹 AUDIT v2.0 — Task 13 (app/opengraph-image.tsx)
// DECISION-EDGE — runtime='edge' بقى كما هو: المحتوى ثابت، Next كيعطي URL
//                 مُهشّم + cache immutable → كلفة ≈ 0. البديل (توليد عند build)
//                 موثق فـ README-layout-og-fix.md #6 — ما تبدلش بلا سبب
// VERIFY-EMOJI  — 🌍🔒 next/og فيه دعم إيموجي مدمج، ولكن تأكد مرة وحدة (README #3)
//                 إلا خرجو مربعات خاوية → بدّل بلوك الشارات بالنسخة النصية
//                 الآمنة المحفوظة تحت كتعليق (التبديل = 30 ثانية)
// ═══════════════════════════════════════════════════════════════════

// 🆕 OG image ديناميكي — يولد عند أول طلب ويُخزن (بلا صيانة)
// يُستخدم تلقائياً من layout.tsx (يستبدل /hero-image.jpg الغائب)
export const runtime = 'edge';
export const alt = 'Laclarc — Global Curated Marketplace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #2E4057 0%, #33475C 50%, #5B7EA6 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* نص خلفي ضخم — نفس هوية الهوم */}
        <div
          style={{
            position: 'absolute',
            fontSize: 220,
            fontWeight: 900,
            color: 'rgba(255,255,255,0.05)',
            letterSpacing: '-0.05em',
            whiteSpace: 'nowrap',
          }}
        >
          LACLARC
        </div>

        {/* الشعار الدائري */}
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 9999,
            background: 'linear-gradient(135deg, #7FA1C4, #5B7EA6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 64,
            fontWeight: 900,
            border: '6px solid rgba(255,255,255,0.25)',
            marginBottom: 30,
          }}
        >
          L
        </div>

        {/* الاسم */}
        <div style={{ fontSize: 84, fontWeight: 900, letterSpacing: '0.05em', marginBottom: 16 }}>
          Laclarc
        </div>

        {/* الوصف */}
        <div style={{ fontSize: 32, color: 'rgba(255,255,255,0.85)', marginBottom: 40 }}>
          Curated Lifestyle · Electric Grooming · Trending Essentials
        </div>

        {/* شارات الثقة — 🩹 VERIFY-EMOJI: إلا 🌍🔒 خرجو مربعات، بدّل هاد البلوك باللي تحته */}
        <div style={{ display: 'flex', gap: 24, fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🌍 Free Worldwide Shipping
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🔒 Bank-Grade Secure
          </div>
        </div>

        {/* ── النسخة النصية الآمنة (بلا إيموجي — كتترسم 100% فأي بيئة) ──
        <div style={{ display: 'flex', gap: 24, fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Free Worldwide Shipping
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            ·
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Bank-Grade Secure
          </div>
        </div>
        */}

        {/* خط سفلي accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 12,
            background: 'linear-gradient(90deg, #7FA1C4, #5B7EA6, #7FA1C4)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}