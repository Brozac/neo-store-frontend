'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // ✨ حالة لإظهار/إخفاء كلمة المرور
  const [showPassword, setShowPassword] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // ✨ استخدام متغير البيئة بدلاً من رابط NEO القديم
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // مهم لاستقبال الكوكي
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/admin'); // الكوكي تم حفظه أمنياً في المتصفح
      } else {
        // ✨ التقاط رسالة الخطأ القادمة من الـ Backend (مثل Too many attempts)
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Network error: Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-4 font-sans">
      <div className="bg-white rounded-temu-sm shadow-sm p-8 max-w-md w-full border border-temu-gray-border-light">
        <h1 className="text-3xl font-extrabold text-temu-black text-center mb-2">Laclarc Admin</h1>
        <p className="text-temu-gray-light text-center mb-8 text-sm">Sign in to manage your store</p>
        
        {error && (
          <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-sm font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleAdminLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-temu-black mb-2">Admin Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition touch-manipulation"
              placeholder="admin@laclarc.com"
            />
          </div>
          <div className="relative">
            <label className="block text-sm font-bold text-temu-black mb-2">Password</label>
            <input 
              type={showPassword ? 'text' : 'password'} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 pr-12 focus:outline-none focus:border-temu-orange transition touch-manipulation"
              placeholder="••••••••"
            />
            {/* ✨ زر إظهار/إخفاء كلمة المرور */}
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-temu-gray-light hover:text-temu-orange transition cursor-pointer active:scale-90"
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-temu-orange text-white font-extrabold py-4 rounded-temu-sm hover:bg-temu-orange-bright transition disabled:opacity-50 flex justify-center items-center cursor-pointer active:scale-95 touch-manipulation shadow-md gap-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}