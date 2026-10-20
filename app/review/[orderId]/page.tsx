'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import GlassIcon from '@/components/ui/GlassIcon';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

export default function ReviewPage() {
  const { orderId } = useParams() as { orderId: string };
  const searchParams = useSearchParams();
  const token = searchParams.get('t') || '';
  const router = useRouter();

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId || !token) { setLoading(false); return; }
    fetch(`${API_BASE_URL}/api/review/verify/${orderId}?t=${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Invalid')))
      .then(data => { setOrder(data); setItems(data.items || []); setLoading(false); })
      .catch(() => { setError('Invalid or expired link.'); setLoading(false); });
  }, [orderId, token]);

  const handleImageUpload = async (files: FileList) => {
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('images', f));
    try {
      const res = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.urls) setImages(prev => [...prev, ...data.urls]);
    } catch { setError('Image upload failed.'); }
    finally { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!content.trim() || content.trim().length < 10) {
      setError('Review must be at least 10 characters.'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/review/invite/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, content: content.trim(), images })
      });
      const data = await res.json();
      if (data.success) { setSubmitted(true); }
      else { setError(data.error || 'Submission failed.'); }
    } catch { setError('Network error.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin" />
    </main>
  );

  if (error && !order) return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
        <span className="text-5xl mb-4 block"><GlassIcon ch="🔗" size="xs" /></span>
        <h1 className="text-xl font-black text-temu-black mb-2">Link Invalid</h1>
        <p className="text-sm text-gray-600">This review link is invalid or has already been used.</p>
      </div>
    </main>
  );

  if (submitted) return (
    <main className="min-h-screen bg-temu-offwhite flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center">
        <div className="text-5xl mb-4"><GlassIcon ch="🎉" size="xs" /></div>
        <h1 className="text-xl font-black text-temu-black mb-2">Thank You!</h1>
        <p className="text-sm text-gray-600 mb-4">Your verified review has been published.</p>
        <div className="bg-purple-50/60 border border-[#8B78C6]/25 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-temu-black mb-1"><GlassIcon ch="🎁" size="xs" /> Your Reward:</p>
          <p className="text-xs text-gray-600">Use code <strong className="text-temu-orange font-black">NEXT5</strong> for 5% off your next order!</p>
        </div>
        <button onClick={() => router.push('/')} className="bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-temu-sm text-sm">Continue Shopping</button>
      </div>
    </main>
  );

  if (!order) return null;

  return (
    <main className="min-h-screen bg-temu-offwhite p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <div className="text-center mb-6">
            <span className="text-4xl"><GlassIcon ch="⭐" size="xs" /></span>
            <h1 className="text-xl font-black text-temu-black mt-2">How was your experience?</h1>
            <p className="text-xs text-gray-500 mt-1">Order #{orderId} — Delivered <GlassIcon ch="✅" size="xs" /></p>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-3 bg-temu-offwhite p-3 rounded-xl mb-6">
              {items[0].image_url && <img src={items[0].image_url} className="w-14 h-14 rounded-lg object-cover" alt="" />}
              <div className="flex-1">
                <p className="text-xs font-bold text-temu-black line-clamp-1">{items[0].title}</p>
                <p className="text-[10px] text-gray-400">Qty: {items[0].quantity} · ${(items[0].price_at_purchase || 0).toFixed(2)}</p>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <label className="block text-xs uppercase font-black text-temu-black mb-3">Your Rating</label>
            <div className="flex justify-center gap-2">
              {[1,2,3,4,5].map(star => (
                <button key={star} onClick={() => setRating(star)} className="text-3xl transition hover:scale-125 active:scale-95">
                  <span className={star <= rating ? 'text-amber-400' : 'text-gray-300'}><GlassIcon i="star" size="xs" /></span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs uppercase font-black text-temu-black mb-2">Your Review</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4}
              placeholder="Tell us about the quality, shipping speed, packaging..."
              className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange" />
          </div>

          <div className="mb-4">
            <label className="block text-xs uppercase font-black text-temu-black mb-2">Add Photos (optional)</label>
            <input type="file" accept="image/*" multiple
              onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
              className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-temu-offwhite file:text-temu-black cursor-pointer" />
            {uploading && <p className="text-xs text-temu-orange mt-1">Uploading...</p>}
            {images.length > 0 && (
              <div className="flex gap-2 mt-2">
                {images.map((img, i) => <img key={i} src={img} className="w-12 h-12 rounded object-cover border" alt="" />)}
              </div>
            )}
          </div>

          {error && <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-xs font-bold text-center">{error}</div>}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-4 rounded-temu-sm transition flex items-center justify-center cursor-pointer disabled:opacity-50 active:scale-95 shadow-md">
            {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Submit Review & Get 5% OFF'}
          </button>

          <p className="text-[10px] text-gray-400 text-center mt-3">
            Your review will be marked as <strong>Verified Purchase</strong> <GlassIcon ch="✅" size="xs" />
          </p>
        </div>
      </div>
    </main>
  );
}
