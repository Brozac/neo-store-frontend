import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 360, // حجم الخط ليتسع للحرف في كامل الأيقونة
          background: '#1D1E3C', // الكحلي الأساسي للمتجر
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '115px', // لإعطاء شكل دائري لطيف للأيقونة
          fontFamily: 'sans-serif',
          boxShadow: '0 0 50px rgba(139, 120, 198, 0.5)',
        }}
      >
        <span style={{ color: '#8B78C6', fontWeight: 900 }}>L</span>
      </div>
    ),
    { ...size }
  );
}