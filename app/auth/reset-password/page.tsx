'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GlassIcon from '@/components/ui/GlassIcon';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or expired password reset link.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update password.');

      setSuccess(true);
      setTimeout(() => router.push('/auth'), 2500);
    } catch (err: any) {
      setError(err.message || 'Connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-xl border border-gray-200 text-center">
        
        <div className="w-14 h-14 bg-purple-100 text-[#8B78C6] rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">
          <GlassIcon ch="🔒" size="xs" />
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-1">Set New Password</h1>
        <p className="text-gray-500 text-xs mb-6">Enter and confirm your new secure master password.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-xs font-bold text-center">
            <GlassIcon ch="⚠️" size="xs" /> {error}
          </div>
        )}

        {success ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-bold space-y-2">
            <p><GlassIcon i="check" size="xs" /> Password updated successfully!</p>
            <p className="text-[11px] font-normal text-gray-500">Redirecting to sign in screen...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4 text-left">
            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">New Password *</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Minimum 6 characters..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B78C6] transition"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-xs font-bold uppercase mb-1">Confirm Password *</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat password..."
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B78C6] transition"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold rounded-xl py-3.5 transition disabled:opacity-70 flex justify-center items-center cursor-pointer active:scale-95 shadow-md text-xs uppercase tracking-wider"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Password & Sign In'}
            </button>
          </form>
        )}

      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}