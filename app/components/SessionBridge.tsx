'use client';

import { useEffect } from 'react';

// 🆕 M#48 — Bridge: NextAuth session → جلسة الخادم
// 🩹 SECURITY-FIX (audit 2026-11-18 F-H1/M8): كان كيكتب التوكن في localStorage
//   (أي XSS = سرقة الجلسة). توّا: الجلسة عبر كوكي httpOnly session_token على
//   نطاق الـ API — التوكن يمر في الذاكرة فقط ولا يتخزن في JS-accessible storage.
export default function SessionBridge() {
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/session');
        if (!res.ok) return;
        const session = await res.json();
        if (session?.laclarcToken) {
          // تحويل التوكن الصالح إلى كوكي httpOnly على نطاق الـ API (الخادم يضبطه)
          const API = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';
          await fetch(`${API}/api/auth/cookie-session`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.laclarcToken}` },
            credentials: 'include',
          }).catch(() => {});
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
