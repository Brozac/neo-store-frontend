'use client';

import { useEffect, useState } from 'react';

/**
 * 💱 LocalPrice — يعرض السعر بعملة الزبون المحلية تلقائيًا
 * USD = أساس الدفع الفعلي • العملة المحلية = تقدير واضح
 * يُخزن مرة/جلسة — صفر استعلامات متكررة
 */
export default function LocalPrice({
  usd,
  size = 'sm',
  showBoth = true,
}: {
  usd: number;
  size?: 'sm' | 'lg';
  showBoth?: boolean;
}) {
  const [fx, setFx] = useState<{ currency: string; symbol: string; rate: number } | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  useEffect(() => {
    const cached = sessionStorage.getItem('laclarc_fx');
    if (cached) {
      setFx(JSON.parse(cached));
      return;
    }
    fetch(`${API_URL}/api/currency/detect?usd=${usd}`)
      .then(r => r.json())
      .then(data => {
        const payload = { currency: data.currency, symbol: data.symbol, rate: data.rate };
        setFx(payload);
        sessionStorage.setItem('laclarc_fx', JSON.stringify(payload));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fx || fx.currency === 'USD') {
    return <span>${usd.toFixed(2)}</span>;
  }

  const local = (usd * fx.rate).toFixed(2);

  if (size === 'lg') {
    return (
      <span>
        <span className="text-3xl font-black text-temu-error">${usd.toFixed(2)}</span>
        <span className="text-base text-gray-500 font-bold ml-2">
          ≈ {fx.symbol}{local} {fx.currency}
        </span>
      </span>
    );
  }

  return (
    <span>
      ${usd.toFixed(2)}
      {showBoth && (
        <span className="text-gray-400 font-semibold"> ≈ {fx.symbol}{local}</span>
      )}
    </span>
  );
}