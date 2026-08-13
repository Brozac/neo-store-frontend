'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi'; // ✨ استيراد adminApi

interface Dispute {
  id: string;
  status: string;
  disputeReason: string;
  money: number;
  createDate: string;
}

interface TrackingInfo {
  trackingNumber: string;
  logisticName: string;
  trackingStatus: string;
  deliveryTime: string;
  lastMileCarrier: string;
}

export default function DisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  // حالات التتبع
  const [trackNumber, setTrackNumber] = useState('');
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  const [formData, setFormData] = useState({
    orderId: '', disputeReasonId: 1, expectType: 1, refundType: 1, messageText: '', lineItemId: '', quantity: 1,
  });

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      // ✨ استخدام adminApi
      const res = await adminApi.get('/admin/disputes');
      if (res.data?.data?.list) setDisputes(res.data.data.list);
    } catch (err) {
      console.error('Error fetching disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDisputes(); }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNumber) return;
    setTrackLoading(true);
    setTrackError('');
    setTrackingInfo(null);

    try {
      // ✨ استخدام adminApi
      const res = await adminApi.get(`/admin/track/${trackNumber}`);
      const data = res.data;
      
      if (Array.isArray(data) && data.length > 0) {
        setTrackingInfo(data[0]);
      } else {
        setTrackError(data.error || 'No tracking info found for this number.');
      }
    } catch (err: any) {
      setTrackError(err.response?.data?.error || 'Failed to connect to server.');
    } finally {
      setTrackLoading(false);
    }
  };

  const handleCreateDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage('');

    try {
      const payload = {
        orderId: formData.orderId,
        disputeReasonId: Number(formData.disputeReasonId),
        expectType: Number(formData.expectType),
        refundType: Number(formData.refundType),
        messageText: formData.messageText,
        productInfoList: [{ lineItemId: formData.lineItemId, quantity: Number(formData.quantity) }]
      };

      // ✨ استخدام adminApi
      const res = await adminApi.post('/admin/disputes/create', payload);
      
      setMessage('✅ Dispute created successfully!');
      setFormData({ orderId: '', disputeReasonId: 1, expectType: 1, refundType: 1, messageText: '', lineItemId: '', quantity: 1 });
      setTimeout(() => { setIsModalOpen(false); fetchDisputes(); }, 1500);
      
    } catch (err: any) {
      setMessage(`❌ Error: ${err.response?.data?.error || 'Server error.'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/admin')} className="text-temu-orange font-bold mb-6">
          ← Back to Dashboard
        </button>
        
        {/* صندوق تتبع الشحنات */}
        <div className="bg-white rounded-temu-sm p-6 border border-temu-gray-border-light mb-8">
          <h2 className="text-xl font-extrabold text-temu-black mb-4">Track Shipment</h2>
          <form onSubmit={handleTrack} className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={trackNumber} 
              onChange={(e) => setTrackNumber(e.target.value)}
              placeholder="Enter CJ Tracking Number (e.g., CJPKL...)"
              className="flex-1 bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange"
            />
            <button type="submit" disabled={trackLoading} className="bg-temu-orange text-white font-bold px-6 rounded-temu-sm hover:bg-temu-orange-bright transition disabled:opacity-50 cursor-pointer">
              {trackLoading ? 'Tracking...' : 'Track'}
            </button>
          </form>

          {trackError && <p className="text-temu-error text-sm font-medium bg-red-50 p-3 rounded-temu-sm">{trackError}</p>}
          
          {trackingInfo && (
            <div className="bg-temu-green-light p-4 rounded-temu-sm border border-temu-green">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-temu-gray-text text-xs">Status</p>
                  <p className="font-bold text-temu-green text-lg">{trackingInfo.trackingStatus}</p>
                </div>
                <div>
                  <p className="text-temu-gray-text text-xs">Carrier</p>
                  <p className="font-bold text-temu-black">{trackingInfo.logisticName}</p>
                </div>
                <div>
                  <p className="text-temu-gray-text text-xs">Tracking Number</p>
                  <p className="font-bold text-temu-black">{trackingInfo.trackingNumber}</p>
                </div>
                <div>
                  <p className="text-temu-gray-text text-xs">Last Mile Carrier</p>
                  <p className="font-bold text-temu-black">{trackingInfo.lastMileCarrier}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-temu-gray-text text-xs">Estimated Delivery</p>
                  <p className="font-bold text-temu-black">{trackingInfo.deliveryTime || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* قسم النزاعات */}
        <div className="bg-white rounded-temu-sm p-8 border border-temu-gray-border-light">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-extrabold text-temu-black">Disputes Management</h1>
            <button onClick={() => setIsModalOpen(true)} className="bg-temu-orange text-white font-bold px-4 py-2 rounded-temu-sm hover:bg-temu-orange-bright transition text-sm cursor-pointer">
              + Open New Dispute
            </button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-10"><p className="text-temu-orange font-bold animate-pulse">Loading...</p></div>
          ) : disputes.length === 0 ? (
            <p className="text-center text-temu-gray-light py-10">No disputes found.</p>
          ) : (
            <div className="space-y-4">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="p-4 bg-temu-offwhite rounded-temu-sm border border-temu-gray-border-light">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-temu-black text-sm">ID: {dispute.id}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${dispute.status === 'Processing' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {dispute.status}
                    </span>
                  </div>
                  <p className="text-sm text-temu-dark mb-1">Reason: {dispute.disputeReason}</p>
                  <p className="text-xs text-temu-gray-light">Refund Amount: ${dispute.money.toFixed(2)}</p>
                  <p className="text-[10px] text-temu-gray-light mt-1">Date: {dispute.createDate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal لفتح نزاع جديد */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-temu-sm p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Open New Dispute</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-temu-gray-light hover:text-temu-black">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {message && (
              <div className={`p-3 rounded-temu-sm mb-4 text-sm font-medium ${message.includes('✅') ? 'bg-temu-green-light text-temu-green' : 'bg-red-50 text-temu-error'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleCreateDispute} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">CJ Order ID *</label>
                <input type="text" required value={formData.orderId} onChange={(e) => setFormData({...formData, orderId: e.target.value})} placeholder="e.g., 210711100018043276" className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Line Item ID *</label>
                <input type="text" required value={formData.lineItemId} onChange={(e) => setFormData({...formData, lineItemId: e.target.value})} placeholder="Item ID from CJ order" className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-temu-black mb-2">Reason</label>
                  <select value={formData.disputeReasonId} onChange={(e) => setFormData({...formData, disputeReasonId: Number(e.target.value)})} className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange">
                    <option value="1">Unfulfilled Order Cancellation</option>
                    <option value="2">Item not received</option>
                    <option value="3">Item damaged</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-temu-black mb-2">Expect</label>
                  <select value={formData.expectType} onChange={(e) => setFormData({...formData, expectType: Number(e.target.value)})} className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange">
                    <option value="1">Refund</option>
                    <option value="2">Reissue</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Message to CJ *</label>
                <textarea required rows={3} value={formData.messageText} onChange={(e) => setFormData({...formData, messageText: e.target.value})} placeholder="Explain the issue..." className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange resize-none" />
              </div>
              <button type="submit" disabled={creating} className="w-full bg-temu-orange text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer disabled:opacity-50">
                {creating ? 'Submitting...' : 'Submit Dispute'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}