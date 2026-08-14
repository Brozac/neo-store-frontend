import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 220,
          background: '#1D1E3C', // الكحلي
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '115px',
          letterSpacing: '-10px',
          fontFamily: 'sans-serif',
          boxShadow: '0 0 50px rgba(139, 120, 198, 0.5)',
        }}
      >
        <span style={{ color: '#8B78C6', fontWeight: 900 }}>N</span>
        <span style={{ color: '#FF6B9D', fontWeight: 900 }}>E</span>
        <span style={{ color: '#8B78C6', fontWeight: 900 }}>O</span>
      </div>
    ),
    { ...size }
  );
}