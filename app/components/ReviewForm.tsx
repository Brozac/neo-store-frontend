// components/ReviewForm.tsx - Laclarc Verified Photo Review Form
'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import StarRating from './StarRating';
import GlassIcon from '@/components/ui/GlassIcon';

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
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
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

  // ✨ رفع صور المنتج الحقيقية إلى Cloudinary
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (uploadedImages.length + files.length > 3) {
      alert('You can upload a maximum of 3 photos per review.');
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    setUploadingPhotos(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (res.ok && Array.isArray(data.urls)) {
        setUploadedImages(prev => [...prev, ...data.urls]);
      } else {
        alert(data.error || 'Failed to upload photo.');
      }
    } catch (err) {
      alert('Connection error while uploading images.');
    } finally {
      setUploadingPhotos(false);
      e.target.value = '';
    }
  };

  const removePhoto = (indexToRemove: number) => {
    setUploadedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

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
          country: country.trim() || 'United States',
          images: uploadedImages // ✨ إرسال مصفوفة روابط الصور
        })
      });

      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Review submitted with photos successfully!');
        setContent('');
        setRating(5);
        setUploadedImages([]);
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

  if (!user) {
    return (
      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center mt-6">
        <p className="text-gray-900 font-bold text-sm mb-1">Purchased this product recently?</p>
        <p className="text-xs text-gray-500 mb-4">Sign in to leave a verified review with real photos and earn reward points.</p>
        <button 
          onClick={() => router.push('/auth')}
          className="bg-[#17171A] hover:bg-[#26262B] text-white font-extrabold py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-md"
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
            placeholder="e.g. United States, France, Algeria..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 focus:outline-none focus:border-[#6B3DB4] transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">Your Feedback *</label>
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            required 
            rows={3} 
            placeholder="Share details regarding build quality, packaging, delivery speed..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-900 focus:outline-none focus:border-[#6B3DB4] transition resize-none"
          />
        </div>

        {/* ✨ قسم رفع ومعاينة صور المنتج الحقيقية */}
        <div>
          <label className="block text-xs font-bold uppercase text-gray-700 mb-1.5">
            Add Real Photos of Product (Max 3)
          </label>
          
          <div className="flex items-center gap-3 flex-wrap">
            {uploadedImages.map((imgUrl, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50">
                <Image src={imgUrl} alt="Review upload" fill sizes="64px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                >
                  <GlassIcon i="x" size="xs" />
                </button>
              </div>
            ))}

            {uploadedImages.length < 3 && (
              <label className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#6B3DB4] flex flex-col items-center justify-center cursor-pointer transition bg-gray-50 hover:bg-fog-50/50 active:scale-95">
                {uploadingPhotos ? (
                  <div className="w-4 h-4 border-2 border-[#6B3DB4] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span className="text-lg text-gray-400"><GlassIcon ch="📷" size="xs" /></span>
                    <span className="text-[9px] font-bold text-gray-500">Upload</span>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  onChange={handlePhotoUpload} 
                  disabled={uploadingPhotos} 
                  className="hidden" 
                />
              </label>
            )}
          </div>
        </div>

        <button 
          type="submit" 
          disabled={submitting || uploadingPhotos} 
          className="w-full bg-linear-to-r from-[#6B3DB4] to-[#5B2F9E] hover:brightness-110 text-white font-black py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50 active:scale-95 shadow-md flex items-center justify-center gap-2"
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