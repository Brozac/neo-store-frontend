'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getExchangeOptionsAction, pickExchangeAction } from '../actions/commerce';
import GlassIcon from '@/components/ui/GlassIcon';

interface Substitute {
  id: string | number;
  title: string;
  price: number | string;
  image_url?: string;
}

type Phase =
  | 'loading' | 'pick' | 'confirming' | 'exchanged' | 'refunded'
  | 'processing' | 'unavailable' | 'invalid' | 'net';

// The backend answers the pick instantly and books the replacement with the supplier in the
// background (can take a minute+). We poll the order's real state — never claim success early.
const POLL_MS = 4000;
const MAX_POLLS = 45;      // ~3 minutes of fast polling, then fall to slow-poll 'processing'
const SLOW_POLL_MS = 30000; // 🩹 E1 — 'processing' keeps watching quietly, forever if needed

export default function ExchangeClient({ orderId, token }: { orderId: number; token: string }) {
  const [options, setOptions] = useState<Substitute[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [msg, setMsg] = useState('');
  const [notice, setNotice] = useState('');
  const pickingRef = useRef(false); // hard guard against double-tap before the re-render lands

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

  // ── Fast poll while the backend books the replacement ──
  useEffect(() => {
    if (phase !== 'confirming') return;
    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      polls += 1;
      const res = await getExchangeOptionsAction(orderId, token);
      if (cancelled) return;

      if (res.status === 'exchanged') { setPhase('exchanged'); return; }
      if (res.status === 'refunded') { setPhase('refunded'); return; }
      if (res.status === 'invalid') { setPhase('invalid'); return; }
      if (res.status === 'awaiting_exchange') {
        // supplier rejected the replacement → backend re-offered new options (+ emailed them)
        setOptions(res.options);
        setNotice("Sorry — that replacement can't ship to your country either. Here are new options (we also emailed them to you).");
        setPhase(res.options.length ? 'pick' : 'unavailable');
        return;
      }
      // 🩹 E2 — backend says the booking HALTED (manual) → honest screen immediately,
      //         no 3-minute spinner pretending something is still moving
      if (res.status === 'processing' && res.detail === 'manual') { setPhase('processing'); return; }
      // 'processing' | 'net' → keep waiting (a transient network blip must not end the wait)
      if (polls >= MAX_POLLS) { setPhase('processing'); return; }
      timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, orderId, token]);

  // ── 🩹 E1 Slow poll while 'processing' — covers MAX_POLLS exhaustion, halt screens,
  //        and any retry-after-blip: the page keeps discovering the real outcome on its own,
  //        instead of leaving the customer on a static screen while the booking succeeds behind them.
  useEffect(() => {
    if (phase !== 'processing') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (cancelled) return;
      const res = await getExchangeOptionsAction(orderId, token);
      if (cancelled) return;

      if (res.status === 'exchanged') { setPhase('exchanged'); return; }
      if (res.status === 'refunded') { setPhase('refunded'); return; }
      if (res.status === 'awaiting_exchange') {
        setOptions(res.options);
        setPhase(res.options.length ? 'pick' : 'unavailable');
        return;
      }
      // 'processing' | 'net' | 'invalid'(transient shape) → keep slow-polling
      timer = setTimeout(tick, SLOW_POLL_MS);
    };

    timer = setTimeout(tick, SLOW_POLL_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phase, orderId, token]);

  const handlePick = async (productId: string | number) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setNotice('');
    setPhase('loading');
    try {
      const res = await pickExchangeAction(orderId, token, productId);
      if (res.success) { setPhase('confirming'); return; }

      switch (res.code) {
        case 'already_picked':   // double-click / second tab → the first pick is already running
          setPhase('confirming');
          break;
        case 'stale_option':     // outdated list → reload the current one
          setNotice('That option is no longer available — here is the updated list.');
          await load();
          break;
        case 'invalid_link':
          setPhase('invalid');
          break;
        default:                 // network / internal — retry re-reads the real state, never promises a refund
          setMsg(res.message);
          setPhase('net');
      }
    } finally {
      pickingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFC] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">

        {phase === 'loading' && (
          <><div className="animate-spin h-8 w-8 border-4 border-[#5B7EA6] border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-sm text-gray-500">Loading...</p></>
        )}

        {phase === 'confirming' && (
          <><div className="animate-spin h-10 w-10 border-4 border-[#5B7EA6] border-t-transparent rounded-full mx-auto mb-5" />
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Confirming your replacement…</h1>
            <p className="text-sm text-gray-600 mb-2">We're booking your new item with our supplier. This can take up to a minute.</p>
            <p className="text-xs text-gray-400">Please keep this page open — your order is safe.</p></>
        )}

        {phase === 'exchanged' && (
          <><div className="text-5xl mb-4"><GlassIcon ch="✅" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Exchange completed!</h1>
            <p className="text-sm text-gray-600 mb-6">Your new item will be shipped right away — follow it from the tracking page.</p>
            <a href="/" className="inline-block bg-[#5B7EA6] text-white font-bold px-6 py-3 rounded-xl text-sm">Back to store</a></>
        )}

        {phase === 'pick' && (
          <>
            <div className="text-4xl mb-3"><GlassIcon ch="🔄" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Your item can't ship to your country</h1>
            {notice && (
              <p role="status" className="text-xs font-bold text-[#5B7EA6] bg-[#EDF3F8] rounded-lg px-3 py-2 mb-4">{notice}</p>
            )}
            <p className="text-sm text-gray-600 mb-6">We're sorry! Pick a free replacement from the same category and we'll ship it right away — or get a full automatic refund after 72 hours.</p>
            <div className="space-y-3 text-right">
              {options.map((opt) => (
                <button key={opt.id} type="button" onClick={() => handlePick(opt.id)}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[#5B7EA6] transition text-left cursor-pointer active:scale-[0.98] flex items-center gap-3">
                  {opt.image_url && (
                    <img src={opt.image_url} alt={opt.title} className="w-14 h-14 rounded-lg object-cover bg-gray-50 shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-[#2E4057] line-clamp-2">{opt.title}</p>
                    <p className="text-sm font-black text-fog-600 mt-0.5">${Number(opt.price).toFixed(2)}</p>
                  </div>
                  <span className="text-[#5B7EA6] font-black text-lg"><GlassIcon i="arrowRight" size="xs" /></span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-6"><GlassIcon ch="🔒" size="xs" /> No extra payment — the replacement matches your order value. Full automatic refund after 72 hours if you don't pick.</p>
          </>
        )}

        {phase === 'unavailable' && (
          <><div className="text-5xl mb-4"><GlassIcon ch="💰" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">You'll be refunded automatically</h1>
            <p className="text-sm text-gray-600 mb-6">No replacements are available for your item right now — your full refund runs automatically within 72 hours, no action needed.</p></>
        )}

        {phase === 'refunded' && (
          <><div className="text-5xl mb-4"><GlassIcon ch="💰" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Your refund is done</h1>
            <p className="text-sm text-gray-600 mb-6">The pick window closed — your full refund was executed or is being processed now. It shows on your payment method within days.</p></>
        )}

        {phase === 'processing' && (
          <><div className="text-5xl mb-4"><GlassIcon ch="⏳" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Your order is being processed</h1>
            <p className="text-sm text-gray-600 mb-6">Our team is handling it right now — you'll get an email update very soon.</p>
            <button onClick={load} className="text-[#5B7EA6] font-bold text-sm cursor-pointer underline">Check status</button></>
        )}

        {phase === 'invalid' && (
          <><div className="text-5xl mb-4"><GlassIcon ch="🔗" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Invalid or expired link</h1>
            <p className="text-sm text-gray-600 mb-6">If you're waiting for an exchange on your order, contact us at support@laclarc.com and we'll help right away.</p></>
        )}

        {phase === 'net' && (
          <><div className="text-5xl mb-4"><GlassIcon ch="📡" size="xs" /></div>
            <h1 className="text-xl font-black text-[#2E4057] mb-2">Connection problem</h1>
            <p className="text-sm text-gray-600 mb-6">{msg || 'A temporary network issue — your order is safe.'}</p>
            <button onClick={load} className="bg-[#5B7EA6] text-white font-bold px-6 py-3 rounded-xl text-sm cursor-pointer active:scale-95">Retry</button></>
        )}
      </div>
    </div>
  );
}