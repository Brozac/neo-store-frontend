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

  // ✨ v1.1 — إرسال طلب الدمج بتأكيد حي كامل (نفس منهج BaridiMob verification)
  const handleSubmitMerge = async (group: any, idx: number) => {
    const shopOrders = group.mergeShopOrderVOList || [];
    const shopCount = shopOrders.length;

    const confirmMessage =
      `⚡ SUBMIT MERGE TO CJ — Group #${idx + 1}\n\n` +
      `Orders to consolidate: ${shopCount}\n` +
      `Carrier: ${group.logisticName || 'Standard'}\n\n` +
      `Shop Order IDs:\n` +
      shopOrders.map((s: any) => `  • ${s.shopOrderId}`).join('\n') +
      `\n\n⚠️ This action is submitted to CJ arbitration and cannot be reversed from this panel.\n\nProceed?`;

    if (!window.confirm(confirmMessage)) return;

    setSubmittingMergeIdx(idx);
    try {
      const payload = shopOrders.length > 0 ? shopOrders : [group];
      const res = await adminApi.post('/admin/merge/submit', payload);
      if (res.data?.code === 200 || res.data?.code === 0) {
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
            Deep Systems &bull; CJ Logistics & Accounting
          </span>
        </div>
        
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          <div className="mb-6">
            <h1 className="text-xl font-black text-temu-black tracking-wide flex items-center gap-2.5">
              <span>🛠️</span> Advanced Engine Suite
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Direct telemetry for COGS margin analysis, parcel consolidation, and carrier makeup adjustments.
            </p>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mb-8 border-b border-gray-200 pb-3 overflow-x-auto scrollbar-hide">
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
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-temu-orange text-white shadow-md shadow-temu-orange/20'
                    : 'bg-temu-offwhite text-gray-500 hover:text-temu-black border border-gray-200'
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
                <h3 className="text-sm font-bold text-temu-black mb-1">COGS (Cost of Goods Sold) Breakdown</h3>
                <p className="text-xs text-gray-500">Fetch real-time CJ supplier invoicing and logistics cost for any order code</p>
              </div>

              <form onSubmit={fetchCogs} className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  value={orderCode} 
                  onChange={(e) => setOrderCode(e.target.value)} 
                  placeholder="Enter CJ Order Code (e.g. CJ240901... or STORE-12)..." 
                  className="flex-1 bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-temu-orange transition" 
                  required 
                />
                <button 
                  type="submit" 
                  disabled={cogsLoading}
                  className="bg-linear-to-r from-temu-orange to-temu-orange-bright hover:brightness-110 text-white font-extrabold px-6 py-3 rounded-xl transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                >
                  {cogsLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Analyze Margins'
                  )}
                </button>
              </form>

              {cogsData && (
                <div className="bg-temu-offwhite p-6 rounded-2xl border border-gray-200 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-3 flex-wrap gap-2">
                    <h4 className="text-sm font-black text-temu-black">Financial Statement &bull; {cogsData.orderCode || orderCode}</h4>
                    <span className="text-[10px] font-mono bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-200">
                      Verified Invoice
                    </span>
                  </div>

                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-100">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Product Cost</span>
                      <span className="text-base font-black text-temu-black">${Number(cogsData.productAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-100">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Logistics Cost</span>
                      <span className="text-base font-black text-temu-orange">${Number(cogsData.postageAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-100">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Service Fees</span>
                      <span className="text-base font-black text-gray-700">${Number(cogsData.serviceFee || 0).toFixed(2)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-gray-100">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Cost (COGS)</span>
                      <span className="text-base font-black text-temu-error">${Number(cogsData.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Raw Data Accordion */}
                  <details className="mt-2 text-xs text-gray-500 bg-white p-3 rounded-xl border border-gray-100">
                    <summary className="cursor-pointer font-bold text-gray-700">View Raw API Payload</summary>
                    <pre className="mt-2 text-[11px] font-mono text-gray-500 overflow-x-auto p-2 bg-gray-50 rounded-lg">
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
                  <h3 className="text-sm font-bold text-temu-black mb-0.5">Automated Parcel Consolidation</h3>
                  <p className="text-xs text-gray-500">Combine multiple orders from the same customer into a single shipment to save fees</p>
                </div>
                <button 
                  onClick={fetchMergeList} 
                  disabled={mergeLoading}
                  className="bg-temu-offwhite hover:bg-gray-100 text-temu-black font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5 border border-gray-200"
                >
                  {mergeLoading ? <div className="w-3.5 h-3.5 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div> : '🔄 Match Orders'}
                </button>
              </div>

              {mergeLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : Array.isArray(mergeList) && mergeList.length > 0 ? (
                mergeList.map((group: any, idx: number) => (
                  <div key={idx} className="bg-temu-offwhite p-5 rounded-2xl border border-gray-200 space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-200 pb-3 flex-wrap gap-2">
                      <div>
                        <span className="font-black text-temu-black text-sm">Mergeable Cluster #{idx + 1}</span>
                        <span className="text-xs text-gray-500 block font-mono">Carrier: {group.logisticName || 'Standard'}</span>
                      </div>
                      
                      {/* ✨ v1.1 — Submit Merge بتأكيد حي كامل */}
                      <button
                        onClick={() => handleSubmitMerge(group, idx)}
                        disabled={submittingMergeIdx === idx}
                        className="bg-linear-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-white px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-md flex items-center gap-1.5"
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
                        <div key={i} className="text-xs bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between">
                          <span className="font-mono text-gray-700">Shop Order: <strong className="text-temu-black">{shop.shopOrderId}</strong></span>
                          <span className="text-[11px] text-gray-400">{shop.logisticName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-temu-offwhite rounded-2xl border border-dashed border-gray-200">
                  <p className="text-xs text-gray-500">No mergeable orders found. (Auto-Merge runs hourly on the server).</p>
                </div>
              )}
            </div>
          )}

          {/* 3. Makeup Tab */}
          {activeTab === 'makeup' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-bold text-temu-black mb-0.5">CJ Carrier Makeup Bills</h3>
                  <p className="text-xs text-gray-500">Post-shipping weight and volume adjustments charged by logistics carriers</p>
                </div>
                <button 
                  onClick={fetchMakeup} 
                  disabled={makeupLoading}
                  className="bg-temu-offwhite hover:bg-gray-100 text-temu-black font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5 border border-gray-200"
                >
                  {makeupLoading ? <div className="w-3.5 h-3.5 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div> : '🔄 Refresh Bills'}
                </button>
              </div>

              {makeupLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-7 h-7 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : makeupList.length > 0 ? (
                makeupList.map((bill: any, idx: number) => (
                  <div key={idx} className="bg-white p-4 rounded-xl border border-amber-200 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h4 className="font-bold text-temu-black text-sm font-mono">{bill.orderCode || 'N/A'}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{bill.reason || 'Logistics freight recalculation'}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-amber-600">${Number(bill.amount || 0).toFixed(2)}</span>
                      <span className="block text-[10px] text-gray-400 uppercase">Adjustment Due</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-temu-offwhite rounded-2xl border border-dashed border-gray-200">
                  <p className="text-xs text-gray-500">No pending carrier makeup invoices found. CJ account is fully settled.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}