'use client';

import { useCallback, useEffect, useState } from 'react';
import { getExchangeOptionsAction, pickExchangeAction } from '../actions/commerce';

interface Substitute {
  id: string | number;
  title: string;
  price: number | string;
  image_url?: string;
}

type Phase = 'loading' | 'pick' | 'exchanged' | 'refunded' | 'unavailable' | 'invalid' | 'net';

export default function ExchangeClient({ orderId, token }: { orderId: number; token: string }) {
  const [options, setOptions] = useState<Substitute[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!orderId || !token) { setPhase('invalid'); return; }
    setPhase('loading');
    const res = await getExchangeOptionsAction(orderId, token);
    if (res.status === 'awaiting_exchange') {
      setOptions(res.options);
      setPhase(res.options.length ? 'pick' : 'unavailable');
    } else if (res.status === 'exchanged') setPhase('exchanged');
    else if (res.status === 'refunded') setPhase('refunded');
    else if (res.status === 'net') setPhase('net');
    else setPhase('invalid');
  }, [orderId, token]);

  useEffect(() => { load(); }, [load]);

  const handlePick = async (productId: string | number) => {
    setPhase('loading');
    const res = await pickExchangeAction(orderId, token, productId);
    if (res.success) setPhase('exchanged');
    else { setMsg(res.message); setPhase('net'); } // فشل pick قابل لإعادة المحاولة — ليس استرداداً
  };

  return (
    <div className="min-h-screen bg-[#F9F8FC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">

        {phase === 'loading' && (
          <><div className="animate-spin h-8 w-8 border-4 border-[#8B78C6] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-gray-500">جاري التحميل...</p></>
        )}

        {phase === 'exchanged' && (
          <><div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">تم التبديل بنجاح!</h1>
            <p className="text-sm text-gray-600 mb-6">سيتم شحن بديلك الجديد فوراً — تابع الطلب من صفحة التتبع.</p>
            <a href="/" className="inline-block bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-xl text-sm">العودة للمتجر</a></>
        )}

        {phase === 'pick' && (
          <>
            <div className="text-4xl mb-3">🔄</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">منتجك غير متوفر للشحن لبلدك</h1>
            <p className="text-sm text-gray-600 mb-6">نعتذر! اختر بديلاً مجانياً من نفس الفئة، وسيتم الشحن فوراً — أو استرداد كامل تلقائي بعد 72 ساعة.</p>
            <div className="space-y-3 text-right">
              {options.map((opt) => (
                <button key={opt.id} type="button" onClick={() => handlePick(opt.id)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[#8B78C6] transition text-left cursor-pointer active:scale-[0.98] flex items-center gap-3">
                  {opt.image_url && (
                    <img src={opt.image_url} alt={opt.title} className="w-14 h-14 rounded-lg object-cover bg-gray-50 shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#1D1E3C] line-clamp-2">{opt.title}</p>
                    <p className="text-sm font-black text-[#FF6B9D] mt-0.5">${Number(opt.price).toFixed(2)}</p>
                  </div>
                  <span className="text-[#8B78C6] font-black text-lg">→</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-6">🔒 لا دفع إضافي — البديل بنفس قيمة طلبك. الاسترداد الكامل تلقائي بعد 72 ساعة إن لم تختر.</p>
          </>
        )}

        {phase === 'unavailable' && (
          <><div className="text-5xl mb-4">💰</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">سيتم استرداد مبلغك تلقائياً</h1>
            <p className="text-sm text-gray-600 mb-6">لا توجد بدائل متاحة لمنتجك حالياً — استردادك الكامل يُنفّذ تلقائياً خلال 72 ساعة دون أي إجراء منك.</p></>
        )}

        {phase === 'refunded' && (
          <><div className="text-5xl mb-4">💰</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">تم استرداد مبلغك</h1>
            <p className="text-sm text-gray-600 mb-6">انتهت مهلة الاختيار — استردادك الكامل نُفّذ أو قيد التنفيذ الآن. المبلغ يظهر حسب جهة الدفع خلال أيام.</p></>
        )}

        {phase === 'invalid' && (
          <><div className="text-5xl mb-4">🔗</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">الرابط غير صالح أو منتهي</h1>
            <p className="text-sm text-gray-600 mb-6">إذا كنت تنتظر استبدالاً لطلبك، تواصل معنا على support@laclarc.com وسنساعدك فوراً.</p></>
        )}

        {phase === 'net' && (
          <><div className="text-5xl mb-4">📡</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">تعذر الاتصال</h1>
            <p className="text-sm text-gray-600 mb-6">{msg || 'مشكلة شبكة عابرة — طلبك في أمان.'}</p>
            <button onClick={load} className="bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-xl text-sm cursor-pointer active:scale-95">إعادة المحاولة</button></>
        )}
      </div>
    </div>
  );
}
