'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MultiStepRegister from '../components/MultiStepRegister';
import Image from 'next/image';
import GlassIcon from '@/components/ui/GlassIcon';
function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/profile';
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverWaking, setServerWaking] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setServerWaking(false);

    const wakeTimer = setTimeout(() => setServerWaking(true), 3500);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: formData.email.trim().toLowerCase(), 
          password: formData.password 
        }),
      });

      clearTimeout(wakeTimer);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Invalid email or password.');
      }
      
      if (data.token) {
        localStorage.setItem('token', data.token);
        if (data.user) {
          localStorage.setItem('user_data', JSON.stringify(data.user));
        }
        router.push(redirectPath);
      }
    } catch (err: any) {
      clearTimeout(wakeTimer);
      setError(err.message || 'Connection error. Please try again.');
    } finally {
      setLoading(false);
      setServerWaking(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send reset link.');
      setInfoMessage(data.message || 'Password reset link has been dispatched to your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // واجهة إنشاء حساب جديد (MultiStep)
  if (mode === 'register') {
    return (
      <main className="min-h-screen bg-temu-offwhite py-8 sm:py-12 font-sans">
        <div className="max-w-2xl mx-auto px-4">
          <button 
            onClick={() => setMode('login')} 
            className="mb-6 text-gray-500 hover:text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 active:scale-95 w-fit"
          >
            &larr; Return to Sign In
          </button>
          <MultiStepRegister />
        </div>
      </main>
    );
  }

  // واجهة استرجاع كلمة المرور (Forgot Password)
  if (mode === 'forgot') {
    return (
      <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-4 sm:p-6 font-sans">
        <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-200">
          
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-purple-50 text-[#8B78C6] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
              <GlassIcon ch="🔑" size="xs" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Reset Password</h1>
            <p className="text-gray-500 text-xs mt-1">Enter your account email to receive an instant recovery link.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl mb-4 text-xs font-bold text-center">
              <GlassIcon ch="⚠️" size="xs" /> {error}
            </div>
          )}

          {infoMessage && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3.5 rounded-xl mb-4 text-xs font-bold text-center">
              <GlassIcon i="check" size="xs" /> {infoMessage}
            </div>
          )}

          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1.5">Registered Email</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                placeholder="name@example.com" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B78C6] transition" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold rounded-xl py-3.5 transition disabled:opacity-70 flex justify-center items-center cursor-pointer active:scale-95 shadow-md text-xs uppercase tracking-wider"
            >
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Dispatch Reset Email'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setMode('login'); setInfoMessage(''); setError(''); }} 
              className="text-[#8B78C6] font-bold text-xs hover:underline cursor-pointer active:scale-95 transition"
            >
              &larr; Back to Sign In
            </button>
          </div>
        </div>
      </main>
    );
  }

  // واجهة تسجيل الدخول الأساسية (Login)
  return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-200">
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 relative mx-auto mb-3">
            <Image 
              src="/icon-512.png" 
              alt="Laclarc Logo" 
              width={64} 
              height={64} 
              className="w-16 h-16 rounded-2xl object-contain shadow-md hover:scale-105 transition-transform" 
              priority 
            />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Welcome to Laclarc</h1>
          <p className="text-gray-500 text-xs mt-1">Sign in to manage orders, wishlist, and rewards</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-xl mb-4 text-xs font-bold text-center">
            <GlassIcon ch="⚠️" size="xs" /> {error}
          </div>
        )}

        {serverWaking && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl mb-4 text-xs font-medium text-center animate-pulse">
            <GlassIcon ch="⏳" size="xs" /> Connecting to secure cloud authentication... Please wait.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-xs font-bold uppercase mb-1.5">Email Address</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
              autoComplete="email"
              placeholder="name@example.com" 
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B78C6] transition" 
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-gray-700 text-xs font-bold uppercase">Password</label>
              <button 
                type="button" 
                onClick={() => { setMode('forgot'); setError(''); }} 
                className="text-[11px] text-[#8B78C6] hover:underline font-bold cursor-pointer"
              >
                Forgot?
              </button>
            </div>

            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                name="password" 
                value={formData.password} 
                onChange={handleChange} 
                required 
                autoComplete="current-password"
                placeholder="••••••••••••" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-[#8B78C6] transition" 
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold rounded-xl py-3.5 transition disabled:opacity-70 flex justify-center items-center cursor-pointer active:scale-95 shadow-lg shadow-[#8B78C6]/20 text-xs uppercase tracking-wider"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Sign In & Access Account'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Don&apos;t have an account yet?{' '}
            <button 
              onClick={() => setMode('register')} 
              className="text-[#FF6B9D] font-bold hover:underline cursor-pointer"
            >
              Sign up now &rarr;
            </button>
          </p>
        </div>

      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}