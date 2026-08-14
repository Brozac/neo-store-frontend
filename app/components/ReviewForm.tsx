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
    return <p className="text-center text-temu-gray-light py-4 animate-pulse">Loading...</p>;
  }

  // إذا لم يكن العميل مسجلاً
  if (!user) {
    return (
      <div className="bg-temu-offwhite p-6 rounded-temu-sm border border-temu-gray-border-light text-center mt-8">
        <p className="text-temu-black font-semibold mb-4">Please log in to write a review.</p>
        <button 
          onClick={() => router.push('/auth')}
          className="bg-temu-orange text-white font-bold py-3 px-8 rounded-full hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 shadow-md"
        >
          Log In / Register
        </button>
      </div>
    );
  }

  // إذا كان العميل مسجلاً، اعرض النموذج باسمه تلقائياً
  return (
    <div className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light shadow-sm mt-8">
      <h3 className="text-lg font-extrabold text-temu-black mb-4">Write a Review</h3>
      
      {message && (
        <div className={`p-3 rounded-temu-sm mb-4 text-sm font-medium ${message.includes('✅') ? 'bg-temu-green-light/10 text-temu-green' : 'bg-red-50 text-temu-error'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-temu-black mb-2">Rating</label>
          <StarRating onChange={(val) => setRating(val)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-temu-black mb-2">Name</label>
            <input 
              type="text" 
              value={user.name} 
              readOnly 
              className="w-full bg-gray-100 border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-temu-gray-text cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-temu-black mb-2">Country</label>
            <input 
              type="text" 
              value={country} 
              onChange={(e) => setCountry(e.target.value)} 
              className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-temu-black mb-2">Review Content *</label>
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            required 
            rows={4} 
            placeholder="Share your thoughts on this product..." 
            className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition resize-none"
          />
        </div>

        <button 
          type="submit" 
          disabled={submitting} 
          className="w-full bg-temu-orange text-white font-extrabold py-3 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition disabled:opacity-50 cursor-pointer mt-2 active:scale-95 flex justify-center items-center gap-2"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}