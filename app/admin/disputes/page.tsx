'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';

interface Dispute {
  id: string;
  status: string;
  disputeReason: string;
  money?: number | string;
  createDate: string;
}

interface TrackingInfo {
  trackingNumber: string;
  logisticName: string;
  trackingStatus: string;
  deliveryTime?: string;
  lastMileCarrier?: string;
}

export default function DisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  const [trackNumber, setTrackNumber] = useState('');
  const [trackingInfo, setTrackingInfo] = useState<TrackingInfo | null>(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState('');

  const [formData, setFormData] = useState({
    orderId: '',
    disputeReasonId: 1,
    expectType: 1,
    refundType: 1,
    messageText: '',
    lineItemId: '',
    quantity: 1,
  });

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/disputes');
      if (res.data?.data?.list) {
        setDisputes(res.data.data.list);
      } else if (Array.isArray(res.data?.data)) {
        setDisputes(res.data.data);
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchDisputes(); 
  }, []);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackNumber.trim()) return;
    setTrackLoading(true);
    setTrackError('');
    setTrackingInfo(null);

    try {
      const res = await adminApi.get(`/admin/track/${encodeURIComponent(trackNumber.trim())}`);
      const data = res.data;
      
      if (Array.isArray(data) && data.length > 0) {
        setTrackingInfo(data[0]);
      } else if (data && typeof data === 'object' && data.trackingNumber) {
        setTrackingInfo(data);
      } else {
        setTrackError(data.error || 'No active tracking milestones returned for this carrier identifier.');
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
        return;
      }
      setTrackError(err.response?.data?.error || 'Failed to query CJ logistics network.');
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
        orderId: formData.orderId.trim(),
        disputeReasonId: Number(formData.disputeReasonId),
        expectType: Number(formData.expectType),
        refundType: Number(formData.refundType),
        messageText: formData.messageText.trim(),
        productInfoList: [{ 
          lineItemId: formData.lineItemId.trim(), 
          quantity: Number(formData.quantity) || 1 
        }]
      };

      const res = await adminApi.post('/admin/disputes/create', payload);
      setMessage('✅ Dispute transmitted successfully to CJ arbitration team!');
      setFormData({ orderId: '', disputeReasonId: 1, expectType: 1, refundType: 1, messageText: '', lineItemId: '', quantity: 1 });
      setTimeout(() => { 
        setIsModalOpen(false); 
        fetchDisputes(); 
      }, 1400);
      
    } catch (err: any) {
      setMessage(`❌ Error: ${err.response?.data?.error || 'Failed to file dispute.'}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite text-temu-black p-6 pb-24 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation */}
        <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
          <button 
            onClick={() => router.push('/admin')} 
            className="text-xs font-bold text-temu-orange hover:brightness-110 transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            &larr; Back to Mission Control
          </button>
          
          <span className="text-xs font-mono text-gray-500">
            CJ Disputes & Carrier Tracking Terminal
          </span>
        </div>
        
        {/* 1. Real-time Shipment Radar (Live Tracking) */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 mb-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-lg">📡</span>
            <h2 className="text-base font-black text-temu-black">Global Logistics Radar</h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">Direct tracking query against CJ Packet, YunExpress, 4PX, and USPS networks</p>
          
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-2 mb-4">
            <input 
              type="text" 
              value={trackNumber} 
              onChange={(e) => setTrackNumber(e.target.value)}
              placeholder="Enter CJ or Carrier Tracking Number (e.g. CJPKL24090123...)"
              className="flex-1 bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-temu-orange transition"
            />
            <button 
              type="submit" 
              disabled={trackLoading} 
              className="bg-linear-to-r from-temu-orange to-temu-orange-bright hover:brightness-110 text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 cursor-pointer active:scale-95 shadow-md flex justify-center items-center gap-2 text-xs uppercase tracking-wider"
            >
              {trackLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Track Parcel'}
            </button>
          </form>

          {trackError && (
            <div className="bg-red-50 border border-red-200 text-red-500 p-3.5 rounded-xl text-xs font-medium">
              {trackError}
            </div>
          )}
          
          {trackingInfo && (
            <div className="bg-temu-offwhite p-5 rounded-xl border border-emerald-200 mt-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Status</span>
                  <span className="font-black text-emerald-600 text-sm bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block">
                    {trackingInfo.trackingStatus || 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Primary Carrier</span>
                  <span className="font-bold text-temu-black text-sm">{trackingInfo.logisticName || 'CJ Packet'}</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Waybill Number</span>
                  <span className="font-mono text-gray-700 font-bold">{trackingInfo.trackingNumber}</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-bold text-[10px] block mb-1">Last-Mile Agent</span>
                  <span className="font-bold text-temu-black text-sm">{trackingInfo.lastMileCarrier || 'Local Postal Partner'}</span>
                </div>
              </div>
              {trackingInfo.deliveryTime && (
                <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                  <span className="text-gray-400 font-bold uppercase text-[10px]">Estimated Delivery: </span>
                  <span className="text-temu-black font-mono">{trackingInfo.deliveryTime}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 2. Disputes Management Console */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b border-gray-200 pb-4">
            <div>
              <h1 className="text-xl font-black text-temu-black tracking-wide flex items-center gap-2">
                <span>⚖️</span> CJ Arbitration & Claims
              </h1>
              <p className="text-xs text-gray-500">File refund claims for undelivered, broken, or lost parcels</p>
            </div>

            <button 
              onClick={() => setIsModalOpen(true)} 
              className="bg-linear-to-r from-temu-error to-coral-600 hover:brightness-110 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition cursor-pointer active:scale-95 shadow-md"
            >
              + File New Dispute
            </button>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-gray-500">Loading dispute records...</p>
            </div>
          ) : disputes.length === 0 ? (
            <div className="text-center py-12 bg-temu-offwhite rounded-2xl border border-dashed border-gray-200">
              <p className="text-xs text-gray-500">No active disputes on file with CJ Dropshipping.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {disputes.map((dispute) => {
                // ✨ حماية ضد انهيار toFixed في حال كان المبلغ غير معرّف
                const safeAmount = Number(dispute.money || 0);

                return (
                  <div key={dispute.id} className="p-4 bg-temu-offwhite rounded-xl border border-gray-100 hover:border-gray-300 transition space-y-1.5">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <span className="font-mono font-bold text-temu-black text-xs">Claim ID: {dispute.id}</span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                        dispute.status === 'Processing' || dispute.status === 'Pending' 
                          ? 'bg-amber-50 text-amber-600 border-amber-200' 
                          : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }`}>
                        {dispute.status}
                      </span>
                    </div>
                    
                    <p className="text-xs text-gray-700">
                      <span className="text-gray-400 font-bold uppercase text-[10px]">Reason: </span>
                      {dispute.disputeReason || 'Unfulfilled order issue'}
                    </p>

                    <div className="flex justify-between items-center text-xs pt-1 border-t border-gray-200">
                      <span className="text-gray-500">Claim Amount: <strong className="text-temu-error">${safeAmount.toFixed(2)}</strong></span>
                      <span className="text-[10px] text-gray-400 font-mono">{dispute.createDate}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Dispute Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50" 
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5 border-b border-gray-200 pb-3">
              <h2 className="text-base font-black text-temu-black">Initiate CJ Dispute Claim</h2>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-temu-black p-1 text-sm"
              >
                ✕
              </button>
            </div>

            {message && (
              <div className={`p-3.5 rounded-xl mb-4 text-xs font-bold ${
                message.includes('✅') 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                  : 'bg-red-50 text-red-500 border border-red-200'
              }`}>
                {message}
              </div>
            )}

            <form onSubmit={handleCreateDispute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CJ Order ID *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.orderId} 
                  onChange={(e) => setFormData({...formData, orderId: e.target.value})} 
                  placeholder="e.g. 210711100018043276" 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Order Line Item ID *</label>
                <input 
                  type="text" 
                  required 
                  value={formData.lineItemId} 
                  onChange={(e) => setFormData({...formData, lineItemId: e.target.value})} 
                  placeholder="Product Line ID from CJ Order" 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Claim Reason</label>
                  <select 
                    value={formData.disputeReasonId} 
                    onChange={(e) => setFormData({...formData, disputeReasonId: Number(e.target.value)})} 
                    className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-3 py-3 text-xs text-temu-black focus:outline-none focus:border-temu-orange"
                  >
                    <option value="1">Order Cancellation</option>
                    <option value="2">Item Not Received / Lost</option>
                    <option value="3">Damaged / Broken Product</option>
                    <option value="4">Wrong Product Shipped</option>
                    <option value="5">Tracking Not Updating</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Expected Resolution</label>
                  <select 
                    value={formData.expectType} 
                    onChange={(e) => setFormData({...formData, expectType: Number(e.target.value)})} 
                    className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-3 py-3 text-xs text-temu-black focus:outline-none focus:border-temu-orange"
                  >
                    <option value="1">Direct Refund ($)</option>
                    <option value="2">Free Reissue Package</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Statement to CJ Arbitration Team *</label>
                <textarea 
                  required 
                  rows={3} 
                  value={formData.messageText} 
                  onChange={(e) => setFormData({...formData, messageText: e.target.value})} 
                  placeholder="Detailed description of parcel issue and evidence..." 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange resize-none" 
                />
              </div>

              <button 
                type="submit" 
                disabled={creating} 
                className="w-full bg-linear-to-r from-temu-error to-coral-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer disabled:opacity-50 active:scale-95 shadow-md flex justify-center items-center gap-2 text-xs uppercase"
              >
                {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'File Dispute Claim with CJ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}