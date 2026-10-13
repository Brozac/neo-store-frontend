'use client';

import { useEffect } from 'react';

// 🆕 M#48 — Bridge: NextAuth session → localStorage token
// (النظام الحالي كيقرا من localStorage — هادا كيملاه بعد Google callback)
export default function SessionBridge() {
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) return;
        const session = await res.json();
        if (session?.laclarcToken && !localStorage.getItem('token')) {
          localStorage.setItem('token', session.laclarcToken);
          window.dispatchEvent(new Event('laclarc:token-synced')); // ✨ نبه المكونات
        }
      } catch {
        // silent — session optional
      }
    };
    checkSession();
  }, []);

  return null;
}