// app/exchange/[orderId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Substitute {
  id: string | number;
  title: string;
  price: number | string;
  image_url?: string;
}

export default function ExchangePage() {
  const { orderId } = useParams();
  const [options, setOptions] = useState<Substitute[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'done' | 'error'>('loading');
  const [msg, setMsg] = useState('');

  // 🆕 جلب الخيارات — endpoint قراءة (زده في server.js تحت)
  useEffect(() => {
    if (!orderId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exchange/${orderId}/options`)
      .then(r => r.json())
      .then(data => {
        setOptions(data.options || []);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
        setMsg('تعذر تحميل الخيارات — حاول مجدداً');
      });
  }, [orderId]);

  const handlePick = async (productId: string | number) => {
    setStatus('loading');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/exchange/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick: productId }),
      });
      const data = await res.json();
      setMsg(data.message || (data.success ? 'تم التبديل بنجاح!' : 'فشل التبديل'));
      setStatus(data.success ? 'done' : 'error');
    } catch (e) {
      setStatus('error');
      setMsg('خطأ شبكة — حاول مجدداً');
    }
  };

  return (
    <div className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">

        {status === 'loading' && (
          <>
            <div className="animate-spin h-8 w-8 border-4 border-temu-orange border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-gray-500">جاري التحميل...</p>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-black text-temu-black mb-2">تم التبديل بنجاح!</h1>
            <p className="text-sm text-gray-600 mb-6">{msg}</p>
            <a href="/" className="inline-block bg-temu-orange text-white font-bold px-6 py-3 rounded-xl text-sm">
              العودة للمتجر
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-5xl mb-4">💰</div>
            <h1 className="text-xl font-black text-temu-black mb-2">سيتم استرداد مبلغك تلقائياً</h1>
            <p className="text-sm text-gray-600 mb-6">{msg}</p>
            <p className="text-xs text-gray-400">سيصلك تأكيد الاسترداد عبر البريد الإلكتروني خلال 5-10 أيام عمل.</p>
          </>
        )}

        {status === 'ready' && (
          <>
            <div className="text-4xl mb-3">🔄</div>
            <h1 className="text-xl font-black text-temu-black mb-2">
              منتجك غير متوفر للشحن لبلدك
            </h1>
            <p className="text-sm text-gray-600 mb-6">
              نعتذر! اختر بديلاً مجانياً من نفس الفئة، وسيتم الشحن فوراً — أو استرداد كامل تلقائي بعد 72 ساعة.
            </p>

            <div className="space-y-3 text-right">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePick(opt.id)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-temu-orange transition text-left cursor-pointer active:scale-[0.98] flex items-center gap-3"
                >
                  {opt.image_url && (
                    <img
                      src={opt.image_url}
                      alt={opt.title}
                      className="w-14 h-14 rounded-lg object-cover bg-gray-50 shrink-0"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-temu-black line-clamp-2">{opt.title}</p>
                    <p className="text-sm font-black text-temu-error mt-0.5">
                      ${Number(opt.price).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-temu-orange font-black text-lg">→</span>
                </button>
              ))}
            </div>

            <p className="text-[10px] text-gray-400 mt-6">
              🔒 لا دفع إضافي — البديل بنفس قيمة طلبك. الاسترداد الكامل تلقائي بعد 72 ساعة إن لم تختر.
            </p>
          </>
        )}
      </div>
    </div>
  );
}