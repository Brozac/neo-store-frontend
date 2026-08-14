'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // مهم لاستقبال الكوكي
      });

      if (res.ok) {
        router.push('/admin'); // الكوكي تم حفظه أمنياً في المتصفح
      } else {
        const data = await res.json();
        setError(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setError('Server error. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-4 font-sans">
      <div className="bg-white rounded-temu-sm shadow-sm p-8 max-w-md w-full border border-temu-gray-border-light">
        <h1 className="text-3xl font-extrabold text-temu-black text-center mb-2">Admin Panel</h1>
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
              placeholder="admin@neostore.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-temu-black mb-2">Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition touch-manipulation"
              placeholder="••••••••"
            />
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