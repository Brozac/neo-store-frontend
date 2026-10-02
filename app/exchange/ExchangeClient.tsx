'use client';

import { useCallback, useEffect, useState } from 'react';
import { getExchangeOptionsAction, pickExchangeAction } from '../actions/commerce';

interface Substitute {
  id: string | number;
  title: string;
  price: number | string;
  image_url?: string;
}

type Phase = 'loading' | 'pick' | 'exchanged' | 'refunded' | 'processing' | 'unavailable' | 'invalid' | 'net';

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
    else if (res.status === 'processing') setPhase('processing');
    else if (res.status === 'net') setPhase('net');
    else setPhase('invalid');
  }, [orderId, token]);

  useEffect(() => { load(); }, [load]);

  const handlePick = async (productId: string | number) => {
    setPhase('loading');
    const res = await pickExchangeAction(orderId, token, productId);
    if (res.success) setPhase('exchanged');
    else { setMsg(res.message); setPhase('net'); } // failed pick is retryable — never a refund promise
  };

  return (
    <div className="min-h-screen bg-[#F9F8FC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">

        {phase === 'loading' && (
          <><div className="animate-spin h-8 w-8 border-4 border-[#8B78C6] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p></>
        )}

        {phase === 'exchanged' && (
          <><div className="text-5xl mb-4">✅</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">Exchange completed!</h1>
            <p className="text-sm text-gray-600 mb-6">Your new item will be shipped right away — follow it from the tracking page.</p>
            <a href="/" className="inline-block bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-xl text-sm">Back to store</a></>
        )}

        {phase === 'pick' && (
          <>
            <div className="text-4xl mb-3">🔄</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">Your item can't ship to your country</h1>
            <p className="text-sm text-gray-600 mb-6">We're sorry! Pick a free replacement from the same category and we'll ship it right away — or get a full automatic refund after 72 hours.</p>
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
            <p className="text-[10px] text-gray-400 mt-6">🔒 No extra payment — the replacement matches your order value. Full automatic refund after 72 hours if you don't pick.</p>
          </>
        )}

        {phase === 'unavailable' && (
          <><div className="text-5xl mb-4">💰</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">You'll be refunded automatically</h1>
            <p className="text-sm text-gray-600 mb-6">No replacements are available for your item right now — your full refund runs automatically within 72 hours, no action needed.</p></>
        )}

        {phase === 'refunded' && (
          <><div className="text-5xl mb-4">💰</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">Your refund is done</h1>
            <p className="text-sm text-gray-600 mb-6">The pick window closed — your full refund was executed or is being processed now. It shows on your payment method within days.</p></>
        )}

        {phase === 'processing' && (
          <><div className="text-5xl mb-4">⏳</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">Your order is being processed</h1>
            <p className="text-sm text-gray-600 mb-6">Our team is handling it right now — you'll get an email update very soon.</p></>
        )}

        {phase === 'invalid' && (
          <><div className="text-5xl mb-4">🔗</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">Invalid or expired link</h1>
            <p className="text-sm text-gray-600 mb-6">If you're waiting for an exchange on your order, contact us at support@laclarc.com and we'll help right away.</p></>
        )}

        {phase === 'net' && (
          <><div className="text-5xl mb-4">📡</div>
            <h1 className="text-xl font-black text-[#1D1E3C] mb-2">Connection problem</h1>
            <p className="text-sm text-gray-600 mb-6">{msg || 'A temporary network issue — your order is safe.'}</p>
            <button onClick={load} className="bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-xl text-sm cursor-pointer active:scale-95">Retry</button></>
        )}
      </div>
    </div>
  );
}