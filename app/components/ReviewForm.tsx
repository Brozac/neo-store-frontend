'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StarRating from './StarRating';

interface ReviewFormProps {
  productId: string | number;
  onReviewAdded: () => void;
}

export default function ReviewForm({ productId, onReviewAdded }: ReviewFormProps) {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [country, setCountry] = useState('United States');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setLoadingUser(false);
      return;
    }

    fetch(`${API_BASE_URL}/api/user/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then(data => {
        if (data) setUser(data);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, [API_BASE_URL]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (!token) {
      setMessage('❌ Please sign in to submit your product review.');
      return;
    }

    if (content.trim().length < 5) {
      setMessage('❌ Review must be at least 5 characters long.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/add`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          product_id: productId, 
          rating, 
          content: content.trim(), 
          country: country.trim() || 'United States' 
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Review submitted successfully!');
        setContent('');
        setRating(5);
        onReviewAdded();
      } else {
        setMessage(`❌ ${data.error || 'Failed to submit review.'}`);
      }
    } catch (err) {
      setMessage('❌ Network connection error.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return <div className="py-6 text-center text-xs text-gray-400 animate-pulse font-bold">Verifying buyer credentials...</div>;
  }

  // إذا لم يكن العميل مسجلاً
  if (!user) {
    return (
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center mt-6">
        <p className="text-gray-900 font-bold text-sm mb-1">Purchased this product recently?</p>
        <p className="text-xs text-gray-500 mb-4">Sign in to leave a verified review and earn reward points.</p>
        <button 
          onClick={() => router.push('/auth')}
          className="bg-[#1D1E3C] hover:bg-[#2D2E5C] text-white font-extrabold py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-md"
        >
          Sign In to Review &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm mt-8 space-y-4">
      <div>
        <h3 className="text-base font-black text-gray-900">Leave a Verified Review</h3>
        <p className="text-xs text-gray-500">Posting publicly as <strong className="text-gray-900">{user.name}</strong></p>
      </div>
      
      {message && (
        <div className={`p-3 rounded-xl text-xs font-bold ${
          message.includes('✅') 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-red-50 text-red-600 border border-red-200'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Rating</label>
          <StarRating onChange={(val) => setRating(val)} />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Country / Region</label>
          <input 
            type="text" 
            value={country} 
            onChange={(e) => setCountry(e.target.value)} 
            placeholder="e.g. United States, France..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#8B78C6] transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Your Feedback *</label>
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            required 
            rows={3} 
            placeholder="Share details regarding quality, sizing, or delivery experience..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-[#8B78C6] transition resize-none"
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting} 
          className="w-full bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-black py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50 active:scale-95 shadow-md flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Publish Verified Review'
          )}
        </button>
      </form>
    </div>
  );
}