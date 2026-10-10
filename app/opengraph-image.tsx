import { ImageResponse } from 'next/og';

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
          background: 'linear-gradient(135deg, #1D1E3C 0%, #2D2E5C 50%, #8B78C6 100%)',
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
            background: 'linear-gradient(135deg, #FF6B9D, #8B78C6)',
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

        {/* شارات الثقة */}
        <div style={{ display: 'flex', gap: 24, fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🌍 Free Worldwide Shipping
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            🔒 Bank-Grade Secure
          </div>
        </div>

        {/* خط سفلي accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 12,
            background: 'linear-gradient(90deg, #FF6B9D, #8B78C6, #FF6B9D)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}