'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';

export default function AdvancedDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'cogs' | 'merge' | 'makeup'>('cogs');
  
  // COGS states
  const [orderCode, setOrderCode] = useState('');
  const [cogsData, setCogsData] = useState<any>(null);
  const [cogsLoading, setCogsLoading] = useState(false);
  
  // Merging states
  const [mergeList, setMergeList] = useState<any[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [submittingMergeIdx, setSubmittingMergeIdx] = useState<number | null>(null);
  
  // Makeup states
  const [makeupList, setMakeupList] = useState<any[]>([]);
  const [makeupLoading, setMakeupLoading] = useState(false);

  // استعلام تكلفة البضاعة المباعة (COGS)
  const fetchCogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderCode.trim()) return;
    setCogsLoading(true);
    setCogsData(null);
    try {
      const res = await adminApi.post('/admin/cogs', { orderCodes: [orderCode.trim()] });
      if (res.data?.data && res.data.data.length > 0) {
        setCogsData(res.data.data[0]);
      } else {
        alert('No financial COGS data found for this CJ Order Code.');
      }
    } catch (err: any) { 
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
        return;
      }
      alert(`❌ Error fetching COGS: ${err.response?.data?.error || err.message}`); 
    } finally {
      setCogsLoading(false);
    }
  };

  // جلب الطلبات القابلة للدمج
  const fetchMergeList = async () => {
    setMergeLoading(true);
    try {
      const res = await adminApi.post('/admin/merge/match');
      const data = res.data;
      
      if (data && data.data && Array.isArray(data.data.result)) {
        setMergeList(data.data.result);
      } else if (data && data.data && Array.isArray(data.data)) {
        setMergeList(data.data);
      } else {
        setMergeList([]);
      }
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
        return;
      }
      setMergeList([]);
    } finally {
      setMergeLoading(false);
    }
  };

  // ✨ إرسال طلب الدمج الفعلي لـ CJ لتوفير تكلفة الشحن
  const handleSubmitMerge = async (group: any, idx: number) => {
    if (!confirm(`Submit Order Merge for Group #${idx + 1}? CJ will consolidate these items into a single shipment.`)) return;
    setSubmittingMergeIdx(idx);
    try {
      const payload = group.mergeShopOrderVOList || [group];
      const res = await adminApi.post('/admin/merge/submit', payload);
      if (res.data?.code === 200) {
        alert('✅ Orders merged successfully on CJ!');
        fetchMergeList();
      } else {
        alert(`⚠️ Merge notice: ${res.data?.message || 'Could not complete merge.'}`);
      }
    } catch (err: any) {
      alert(`❌ Merge failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSubmittingMergeIdx(null);
    }
  };

  // جلب فواتير فروق الشحن (Makeup Payments)
  const fetchMakeup = async () => {
    setMakeupLoading(true);
    try {
      const res = await adminApi.get('/admin/makeup/list');
      if (res.data?.data?.pageData?.content) {
        setMakeupList(res.data.data.pageData.content);
      } else if (Array.isArray(res.data?.data)) {
        setMakeupList(res.data.data);
      } else {
        setMakeupList([]);
      }
    } catch (err: any) { 
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
        return;
      }
      alert('Error fetching CJ makeup payments.'); 
    } finally {
      setMakeupLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0E1020] text-gray-200 p-6 pb-24 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation */}
        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
          <button 
            onClick={() => router.push('/admin')} 
            className="text-xs font-bold text-[#8B78C6] hover:text-[#9B88D6] transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            &larr; Back to Mission Control
          </button>
          
          <span className="text-xs font-mono text-gray-400">
            Deep Systems &bull; CJ Logistics & Accounting
          </span>
        </div>
        
        <div className="bg-[#181B34] rounded-2xl p-6 sm:p-8 border border-white/10 shadow-xl">
          <div className="mb-6">
            <h1 className="text-xl font-black text-white tracking-wide flex items-center gap-2.5">
              <span>🛠️</span> Advanced Engine Suite
            </h1>
            <p className="text-xs text-gray-400 mt-1">
              Direct telemetry for COGS margin analysis, parcel consolidation, and carrier makeup adjustments.
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-white/10 pb-3">
            {[
              { id: 'cogs', label: 'COGS Financials', icon: '📊' },
              { id: 'merge', label: 'Parcel Consolidation (Merge)', icon: '📦' },
              { id: 'makeup', label: 'Carrier Adjustments (Makeup)', icon: '🧾' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'merge') fetchMergeList();
                  if (tab.id === 'makeup') fetchMakeup();
                }}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                  activeTab === tab.id
                    ? 'bg-[#8B78C6] text-white shadow-lg shadow-[#8B78C6]/20'
                    : 'bg-[#0E1020] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          {/* 1. COGS Tab */}
          {activeTab === 'cogs' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">COGS (Cost of Goods Sold) Breakdown</h3>
                <p className="text-xs text-gray-400">Fetch real-time CJ supplier invoicing and logistics cost for any order code</p>
              </div>

              <form onSubmit={fetchCogs} className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  value={orderCode} 
                  onChange={(e) => setOrderCode(e.target.value)} 
                  placeholder="Enter CJ Order Code (e.g. CJ240901... or STORE-12)..." 
                  className="flex-1 bg-[#0E1020] border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#8B78C6] transition" 
                  required 
                />
                <button 
                  type="submit" 
                  disabled={cogsLoading}
                  className="bg-gradient-to-r from-[#8B78C6] to-[#7B68B6] hover:brightness-110 text-white font-extrabold px-6 py-3 rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#8B78C6]/20"
                >
                  {cogsLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Analyze Margins'
                  )}
                </button>
              </form>

              {cogsData && (
                <div className="bg-[#0E1020] p-6 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3 flex-wrap gap-2">
                    <h4 className="text-sm font-black text-white">Financial Statement &bull; {cogsData.orderCode || orderCode}</h4>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                      Verified Invoice
                    </span>
                  </div>

                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#181B34] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Product Cost</span>
                      <span className="text-base font-black text-white">${Number(cogsData.productAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#181B34] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Logistics Cost</span>
                      <span className="text-base font-black text-[#8B78C6]">${Number(cogsData.postageAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#181B34] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Service Fees</span>
                      <span className="text-base font-black text-gray-300">${Number(cogsData.serviceFee || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-[#181B34] p-3.5 rounded-xl border border-white/5">
                      <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Cost (COGS)</span>
                      <span className="text-base font-black text-[#FF6B9D]">${Number(cogsData.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Raw Data Accordion */}
                  <details className="mt-2 text-xs text-gray-400 bg-[#181B34] p-3 rounded-xl border border-white/5">
                    <summary className="cursor-pointer font-bold text-gray-300">View Raw API Payload</summary>
                    <pre className="mt-2 text-[11px] font-mono text-gray-400 overflow-x-auto p-2 bg-black/40 rounded-lg">
                      {JSON.stringify(cogsData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}

          {/* 2. Merge Tab */}
          {activeTab === 'merge' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5">Automated Parcel Consolidation</h3>
                  <p className="text-xs text-gray-400">Combine multiple orders from the same customer into a single shipment to save fees</p>
                </div>
                <button 
                  onClick={fetchMergeList} 
                  disabled={mergeLoading}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {mergeLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '🔄 Match Orders'}
                </button>
              </div>

              {mergeLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-3 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : Array.isArray(mergeList) && mergeList.length > 0 ? (
                mergeList.map((group: any, idx: number) => (
                  <div key={idx} className="bg-[#0E1020] p-5 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex justify-between items-center border-b border-white/10 pb-3 flex-wrap gap-2">
                      <div>
                        <span className="font-black text-white text-sm">Mergeable Cluster #{idx + 1}</span>
                        <span className="text-xs text-gray-400 block font-mono">Carrier: {group.logisticName || 'Standard'}</span>
                      </div>
                      
                      {/* ✨ زر تنفيذ الدمج المباشر */}
                      <button
                        onClick={() => handleSubmitMerge(group, idx)}
                        disabled={submittingMergeIdx === idx}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-md flex items-center gap-1.5"
                      >
                        {submittingMergeIdx === idx ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Submitting...
                          </>
                        ) : (
                          '⚡ Submit Merge to CJ'
                        )}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {group.mergeShopOrderVOList?.map((shop: any, i: number) => (
                        <div key={i} className="text-xs bg-[#181B34] p-3 rounded-xl border border-white/5 flex items-center justify-between">
                          <span className="font-mono text-gray-200">Shop Order: <strong className="text-white">{shop.shopOrderId}</strong></span>
                          <span className="text-[11px] text-gray-400">{shop.logisticName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-[#0E1020] rounded-2xl border border-dashed border-white/10">
                  <p className="text-xs text-gray-400">No mergeable orders found. (Auto-Merge runs hourly on the server).</p>
                </div>
              )}
            </div>
          )}

          {/* 3. Makeup Tab */}
          {activeTab === 'makeup' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white mb-0.5">CJ Carrier Makeup Bills</h3>
                  <p className="text-xs text-gray-400">Post-shipping weight and volume adjustments charged by logistics carriers</p>
                </div>
                <button 
                  onClick={fetchMakeup} 
                  disabled={makeupLoading}
                  className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {makeupLoading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '🔄 Refresh Bills'}
                </button>
              </div>

              {makeupLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-3 border-[#8B78C6] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : makeupList.length > 0 ? (
                makeupList.map((bill: any, idx: number) => (
                  <div key={idx} className="bg-[#0E1020] p-4 rounded-xl border border-amber-500/30 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h4 className="font-bold text-white text-sm font-mono">{bill.orderCode || 'N/A'}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{bill.reason || 'Logistics freight recalculation'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-amber-400">${Number(bill.amount || 0).toFixed(2)}</span>
                      <span className="block text-[10px] text-gray-500 uppercase">Adjustment Due</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-[#0E1020] rounded-2xl border border-dashed border-white/10">
                  <p className="text-xs text-gray-400">No pending carrier makeup invoices found. CJ account is fully settled.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}