'use client';

// ═══════════════════════════════════════════════════════════════
// app/auth/verify-email/page.tsx — F#87 (P0 FIX)
// الباك يبعث لينك التحقق لـ /auth/verify-email?token=... (server.js:1657)
// وهذي الصفحة كانت ناقصة → 404 → الحساب ما يتبوثش أبداً.
// نفس نمط app/auth/reset-password/page.tsx · هوية SERENE (F#84):
//   #5B7EA6 primary · #2E4057 ink · #B05C5C خطأ · #88C83C نجاح · radius 12px
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token. Please log in — you can request a new verification email from your account.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
        const res = await fetch(`${API}/api/verify-email?token=${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (res.ok) {
          setState('success');
        } else {
          setState('error');
          setMessage('This link is invalid or has expired. Try logging in — if anything is wrong, we are here to help.');
        }
      } catch {
        if (!cancelled) {
          setState('error');
          setMessage('Network error — please check your connection and try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-5 py-16"
      style={{ background: 'linear-gradient(180deg, #F4F8FB 0%, #E2EBF3 100%)' }}
    >
      <div className="w-full max-w-md rounded-xl border border-[#E2EBF3] bg-white/85 px-8 py-12 text-center shadow-sm backdrop-blur-sm">
        {state === 'loading' && (
          <>
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-[3px] border-[#5B7EA6] border-t-transparent" />
            <h1 className="text-lg font-semibold text-[#2E4057]">Verifying your email&hellip;</h1>
            <p className="mt-2 text-sm text-[#7A8CA0]">One moment please.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#88C83C]/15">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#7C9E85" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-[#2E4057]">Email verified successfully! 🎉</h1>
            <p className="mt-2 text-sm text-[#7A8CA0]">You can now log in to your account.</p>
            <a
              href="/auth"
              className="mt-7 inline-block rounded-xl bg-[#5B7EA6] px-8 py-3 text-[13px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#46648A]"
            >
              Go to Login
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#B05C5C]/12">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B05C5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-[#B05C5C]">Invalid or expired link</h1>
            <p className="mt-2 text-sm text-[#7A8CA0]">{message}</p>
            <a
              href="/auth"
              className="mt-7 inline-block rounded-xl bg-[#5B7EA6] px-8 py-3 text-[13px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#46648A]"
            >
              Go to Login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#F4F8FB' }} />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
