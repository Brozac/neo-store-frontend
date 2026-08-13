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

  // ✨ جلب بيانات العميل المسجل
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoadingUser(false);
      return;
    }

    fetch('https://neo-store-backend.onrender.com/api/user/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setUser(data);
        setLoadingUser(false);
      })
      .catch(() => setLoadingUser(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    
    if (!token) {
      setMessage('❌ Please log in to submit a review.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/reviews/add', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ product_id: productId, rating, content, country })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Review added successfully!');
        setContent('');
        setRating(5);
        onReviewAdded(); // تحديث القائمة
      } else {
        setMessage(`❌ ${data.error || 'Failed to add review.'}`);
      }
    } catch (err) {
      setMessage('❌ Server error.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingUser) {
    return <p className="text-center text-gray-500 py-4">Loading...</p>;
  }

  // إذا لم يكن العميل مسجلاً
  if (!user) {
    return (
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 text-center">
        <p className="text-gray-700 font-semibold mb-3">Please log in to write a review.</p>
        <button 
          onClick={() => router.push('/auth/login')}
          className="bg-temu-orange text-white font-bold py-2 px-6 rounded-full hover:bg-temu-orange-bright transition cursor-pointer"
        >
          Log In
        </button>
      </div>
    );
  }

  // إذا كان العميل مسجلاً، اعرض النموذج باسمه تلقائياً
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-extrabold text-gray-800 mb-4">Write a Review</h3>
      
      {message && (
        <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${message.includes('✅') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Rating</label>
          <StarRating onChange={(val) => setRating(val)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Name</label>
            <input 
              type="text" 
              value={user.name} 
              readOnly 
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-4 py-2 text-gray-600 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Country</label>
            <input 
              type="text" 
              value={country} 
              onChange={(e) => setCountry(e.target.value)} 
              className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:border-temu-orange"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Review Content *</label>
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            required 
            rows={4} 
            placeholder="Share your thoughts on this product..." 
            className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2 focus:outline-none focus:border-temu-orange resize-none"
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting} 
          className="w-full bg-[#8B78C6] text-white font-bold py-3 px-6 rounded-full hover:bg-[#7a68af] transition disabled:opacity-50 cursor-pointer mt-4"
        >
          {submitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}