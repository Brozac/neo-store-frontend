'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MultiStepRegister from '../components/MultiStepRegister';

export default function AuthPage() {
  const router = useRouter();
  
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Something went wrong');
      
      localStorage.setItem('token', data.token);
      router.push('/profile');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);

    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setInfoMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // واجهة إنشاء حساب
  if (mode === 'register') {
    return (
      <main className="min-h-screen bg-temu-offwhite py-10">
        <div className="max-w-3xl mx-auto px-4">
          {/* ✨ زر الرجوع مع تأثير الضغط */}
          <button 
            onClick={() => setMode('login')} 
            className="mb-6 text-temu-gray-light hover:text-temu-black font-medium text-sm transition cursor-pointer flex items-center gap-2 active:scale-95 w-fit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back to Login
          </button>
          <MultiStepRegister />
        </div>
      </main>
    );
  }

  // واجهة نسيت كلمة المرور
  if (mode === 'forgot') {
    return (
      <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white p-8 rounded-temu-sm shadow-sm border border-temu-gray-border-light">
          <h1 className="text-3xl font-extrabold text-temu-black mb-2 text-center">Forgot Password?</h1>
          <p className="text-temu-gray-text text-sm text-center mb-8">Enter your email to receive a reset link.</p>

          {error && <div className="bg-red-50 text-temu-error p-4 rounded-temu-sm mb-6 text-sm font-medium text-center">{error}</div>}
          {/* ✨ توحيد لون رسالة النجاح */}
          {infoMessage && <div className="bg-temu-green-light/10 text-temu-green p-4 rounded-temu-sm mb-6 text-sm font-medium text-center">{infoMessage}</div>}

          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div>
              <label className="block text-temu-black text-sm font-bold mb-2 ml-1">Email Address</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                required 
                placeholder="user@example.com" 
                className="w-full bg-temu-offwhite border border-temu-gray-border-light text-temu-black rounded-temu-sm px-4 py-4 focus:outline-none focus:border-temu-orange transition touch-manipulation" 
              />
            </div>
            {/* ✨ زر الإرسال مع تأثير الضغط */}
            <button 
              type="submit" 
              disabled={loading} 
              className="w-full bg-temu-orange text-white font-extrabold rounded-temu-sm px-4 py-4 mt-4 hover:bg-temu-orange-bright transition disabled:opacity-70 flex justify-center items-center cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm">
            {/* ✨ زر العودة مع تأثير الضغط */}
            <button 
              onClick={() => { setMode('login'); setInfoMessage(''); }} 
              className="text-temu-orange font-bold hover:underline cursor-pointer active:scale-95 transition"
            >
              Back to Login
            </button>
          </div>
        </div>
      </main>
    );
  }

  // واجهة تسجيل الدخول العادية
  return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-temu-sm shadow-sm border border-temu-gray-border-light">
        <h1 className="text-3xl font-extrabold text-temu-black mb-2 text-center">Welcome Back!</h1>
        <p className="text-temu-gray-text text-sm text-center mb-8">Please enter your details to sign in.</p>

        {error && <div className="bg-red-50 text-temu-error p-4 rounded-temu-sm mb-6 text-sm font-medium text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-temu-black text-sm font-bold mb-2 ml-1">Email Address</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
              placeholder="user@example.com" 
              className="w-full bg-temu-offwhite border border-temu-gray-border-light text-temu-black rounded-temu-sm px-4 py-4 focus:outline-none focus:border-temu-orange transition touch-manipulation" 
            />
          </div>
          <div>
            <label className="block text-temu-black text-sm font-bold mb-2 ml-1">Password</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleChange} 
              required 
              placeholder="••••••••" 
              className="w-full bg-temu-offwhite border border-temu-gray-border-light text-temu-black rounded-temu-sm px-4 py-4 focus:outline-none focus:border-temu-orange transition touch-manipulation" 
            />
          </div>

          <div className="text-right -mt-3">
            {/* ✨ زر نسيت كلمة المرور مع تأثير الضغط */}
            <button 
              type="button" 
              onClick={() => { setMode('forgot'); setError(''); }} 
              className="text-xs text-temu-gray-text hover:text-temu-orange font-medium cursor-pointer active:scale-95 transition"
            >
              Forgot password?
            </button>
          </div>

          {/* ✨ زر تسجيل الدخول مع تأثير الضغط */}
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-temu-orange text-white font-extrabold rounded-temu-sm px-4 py-4 mt-4 hover:bg-temu-orange-bright transition disabled:opacity-70 flex justify-center items-center cursor-pointer active:scale-95 touch-manipulation shadow-md"
          >
            {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className="text-temu-gray-text">Don't have an account? </span>
          {/* ✨ زر إنشاء حساب مع تأثير الضغط */}
          <button 
            onClick={() => setMode('register')} 
            className="text-temu-orange font-bold hover:underline cursor-pointer active:scale-95 transition"
          >
            Sign up now
          </button>
        </div>
      </div>
    </main>
  );
}