'use client';

import { useState, useEffect } from 'react';
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
        credentials: 'include' // ضروري لاستقبال كوكي admin_token
      });

      clearTimeout(wakeTimer);
      const data = await res.json();

      if (res.ok) {
        router.push('/admin');
      } else {
        setError(data.message || 'Invalid administrative credentials');
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
    <main className="min-h-screen bg-[#0F1021] flex flex-col justify-center items-center p-4 font-sans text-white">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 w-96 h-96 bg-[#8B78C6]/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="bg-[#1D1E3C] border border-white/10 rounded-2xl shadow-2xl p-8 max-w-md w-full relative z-10 backdrop-blur-sm">
        
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#8B78C6] to-[#FF6B9D] rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-2xl">🛡️</span>
          </div>
        </div>

        <h1 className="text-2xl font-black text-center tracking-wide mb-1 text-white">Laclarc Operations</h1>
        <p className="text-gray-400 text-center mb-6 text-xs uppercase tracking-widest font-semibold">Mission Control Gateway</p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3.5 rounded-xl mb-5 text-sm font-medium text-center flex items-center justify-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {serverWaking && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 p-3.5 rounded-xl mb-5 text-xs font-medium text-center animate-pulse">
            ⏳ Waking up secure cloud server on Render... Please hold.
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">Admin Identifier</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              autoComplete="email"
              className="w-full bg-[#0F1021] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#8B78C6] transition"
              placeholder="admin@laclarc.com"
            />
          </div>

          <div className="relative">
            <label className="block text-xs font-bold text-gray-300 mb-1.5 uppercase tracking-wider">Master Password</label>
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              autoComplete="current-password"
              className="w-full bg-[#0F1021] border border-white/10 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:outline-none focus:border-[#8B78C6] transition"
              placeholder="••••••••••••"
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-[34px] text-gray-400 hover:text-white transition cursor-pointer"
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full mt-2 bg-gradient-to-r from-[#8B78C6] to-[#7B68B6] hover:brightness-110 text-white font-bold py-3.5 rounded-xl transition duration-200 disabled:opacity-50 flex justify-center items-center cursor-pointer shadow-lg shadow-[#8B78C6]/20 active:scale-[0.98]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              'Authenticate & Access Command'
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-white/5 text-center text-[11px] text-gray-500">
          Encrypted Zero-Trust Session &bull; Laclarc HQ
        </div>
      </div>
    </main>
  );
}