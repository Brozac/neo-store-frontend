'use client';
import { useState } from 'react';

export default function TrackPage() {
  const [trackNum, setTrackNum] = useState('');
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setInfo(null);
    try {
      const res = await fetch(`https://neo-store-backend.onrender.com/api/track/${trackNum}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data) && data.length > 0) setInfo(data[0]);
      else setError(data.error || 'Tracking number not found.');
    } catch { setError('Server error.'); }
    finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 flex items-center justify-center font-sans">
      <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light max-w-lg w-full shadow-sm">
        <h1 className="text-2xl font-extrabold text-temu-black mb-6 text-center flex items-center justify-center gap-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-temu-orange">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Track Your Order
        </h1>
        
        {/* ✨ تعديل الاستجابة: تتراص عمودياً على الهواتف الصغيرة جداً */}
        <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2 mb-6">
          <input 
            type="text" 
            value={trackNum} 
            onChange={(e) => setTrackNum(e.target.value)} 
            placeholder="Enter Tracking Number" 
            className="flex-1 bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" 
            required 
          />
          <button 
            type="submit" 
            disabled={loading} 
            className="bg-temu-orange text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-orange-bright transition disabled:opacity-50 active:scale-95 touch-manipulation cursor-pointer flex justify-center items-center gap-2 shadow-md"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : 'Track'}
          </button>
        </form>

        {error && (
          <p className="text-temu-error text-sm text-center bg-red-50 p-3 rounded-temu-sm font-medium">{error}</p>
        )}
        
        {info && (
          <div className="bg-temu-green-light/10 p-6 rounded-temu-sm border border-temu-green/20">
            <p className="text-lg font-bold text-temu-green mb-4 text-center">{info.trackingStatus}</p>
            <div className="grid grid-cols-2 gap-4 text-sm text-temu-black">
              <p>
                <span className="text-temu-gray-text text-xs block mb-1">Carrier</span> 
                {info.logisticName}
              </p>
              <p>
                <span className="text-temu-gray-text text-xs block mb-1">Tracking No.</span> 
                {info.trackingNumber}
              </p>
              <p className="col-span-2">
                <span className="text-temu-gray-text text-xs block mb-1">Estimated Delivery</span> 
                {info.deliveryTime || 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}