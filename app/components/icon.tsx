import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 90, // ✨ تم تصغير حجم الخط ليتسع الاسم كاملاً
          background: '#22364A', // الكحلي
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '115px',
          letterSpacing: '-2px', // ✨ تقليل المسافة بين الحروف
          fontFamily: 'sans-serif',
          boxShadow: '0 0 50px rgba(91,126,166, 0.5)',
        }}
      >
        <span style={{ color: '#5B7EA6', fontWeight: 900 }}>L</span>
        <span style={{ color: '#E2836B', fontWeight: 900 }}>a</span>
        <span style={{ color: '#5B7EA6', fontWeight: 900 }}>c</span>
        <span style={{ color: '#E2836B', fontWeight: 900 }}>l</span>
        <span style={{ color: '#5B7EA6', fontWeight: 900 }}>a</span>
        <span style={{ color: '#E2836B', fontWeight: 900 }}>r</span>
        <span style={{ color: '#5B7EA6', fontWeight: 900 }}>c</span>
      </div>
    ),
    { ...size }
  );
}