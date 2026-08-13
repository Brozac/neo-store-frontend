'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Failed to reset password.');
      
      setSuccess(true);
      setTimeout(() => router.push('/auth'), 3000); // توجيه لصفحة الدخول بعد 3 ثواني
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-temu-offwhite p-6">
        <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light text-center">
          <h1 className="text-2xl font-bold text-temu-error mb-4">Invalid Link</h1>
          <p className="text-temu-gray-text">No reset token found. Please request a new reset link.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-temu-sm shadow-sm border border-temu-gray-border-light">
        {success ? (
          <div className="text-center">
            <svg className="mx-auto mb-4 h-16 w-16 text-temu-green" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <h1 className="text-2xl font-extrabold text-temu-black mb-2">Password Reset!</h1>
            <p className="text-temu-gray-text">Redirecting you to login...</p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-extrabold text-temu-black mb-2 text-center">Set New Password</h1>
            <p className="text-temu-gray-text text-sm text-center mb-8">Enter your new password below.</p>

            {error && <div className="bg-red-50 text-temu-error p-4 rounded-temu-sm mb-6 text-sm font-medium text-center">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-temu-black text-sm font-bold mb-2 ml-1">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••" className="w-full bg-temu-offwhite border border-temu-gray-border-light text-temu-black rounded-temu-sm px-4 py-4 focus:outline-none focus:border-temu-orange transition" />
              </div>
              <div>
                <label className="block text-temu-black text-sm font-bold mb-2 ml-1">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" className="w-full bg-temu-offwhite border border-temu-gray-border-light text-temu-black rounded-temu-sm px-4 py-4 focus:outline-none focus:border-temu-orange transition" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-temu-orange text-white font-extrabold rounded-temu-sm px-4 py-4 mt-4 hover:bg-temu-orange-bright transition disabled:opacity-70 flex justify-center items-center cursor-pointer">
                {loading ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

// ضروري في Next.js عند استخدام useSearchParams
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-temu-offwhite"><div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}