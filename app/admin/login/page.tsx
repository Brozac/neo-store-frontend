'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setServerWaking(false);

    // تنبيه المستخدم إذا كان السيرفر على Render يستغرق وقتاً للاستيقاظ (Cold Start)
    const wakeTimer = setTimeout(() => {
      setServerWaking(true);
    }, 4000);

    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include', // ضروري لاستقبال كوكي admin_token
      });

      clearTimeout(wakeTimer);

      // 🩹 v1.1 — HTML-error-page guard (Render 502 etc.) — res.json() alone crashes on '<'
      const raw = await res.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON error page */ }

      if (res.ok) {
        router.push('/admin');
      } else {
        setError(data.message || data.error || 'Invalid administrative credentials');
      }
    } catch (err: any) {
      clearTimeout(wakeTimer);
      setError('Network Connection Error: Unable to reach backend server.');
    } finally {
      setLoading(false);
      setServerWaking(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-4 font-sans text-temu-black relative">
      {/* خلفية زخرفية مضيئة */}
      <div className="absolute top-1/4 w-96 h-96 bg-temu-orange/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 w-96 h-96 bg-temu-error/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-white border border-temu-gray-border-light rounded-2xl shadow-xl p-8 max-w-md w-full relative z-10 backdrop-blur-sm">

        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-linear-to-tr from-temu-orange to-temu-error rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">🛡️</span>
          </div>
        </div>

        <h1 className="text-2xl font-black text-center tracking-wide mb-1 text-temu-black">Laclarc Operations</h1>
        <p className="text-gray-500 text-center mb-6 text-xs uppercase tracking-widest font-semibold">Mission Control Gateway</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-500 p-3.5 rounded-xl mb-5 text-sm font-medium text-center flex items-center justify-center gap-2" role="alert">
            <span>⚠️</span> {error}
          </div>
        )}

        {serverWaking && (
          <div className="bg-amber-50 border border-amber-200 text-amber-600 p-3.5 rounded-xl mb-5 text-xs font-medium text-center animate-pulse">
            ⏳ Waking up secure cloud server on Render... Please hold.
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider" htmlFor="admin-email">Admin Identifier</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange transition"
              placeholder="admin@laclarc.com"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider" htmlFor="admin-password">Master Password</label>
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 pr-12 text-sm text-temu-black focus:outline-none focus:border-temu-orange transition"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3.5 top-[34px] text-gray-400 hover:text-temu-orange transition cursor-pointer"
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-linear-to-r from-temu-orange to-temu-orange-bright hover:brightness-110 text-white font-bold py-3.5 rounded-xl transition duration-200 disabled:opacity-50 flex justify-center items-center cursor-pointer shadow-lg shadow-temu-orange/20 active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Authenticate & Access Command'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-temu-gray-border-light text-center text-[11px] text-gray-400">
          Encrypted Zero-Trust Session &bull; Laclarc HQ
        </div>
      </div>
    </main>
  );
}