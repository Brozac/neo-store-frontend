'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi'; // ✨ استيراد adminApi

export default function AdvancedDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('cogs');
  
  // COGS states
  const [orderCode, setOrderCode] = useState('');
  const [cogsData, setCogsData] = useState<any>(null);
  
  // Merging states
  const [mergeList, setMergeList] = useState<any[]>([]);
  
  // Makeup states
  const [makeupList, setMakeupList] = useState<any[]>([]);

  const fetchCogs = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // ✨ استخدام adminApi
      const res = await adminApi.post('/admin/cogs', { orderCodes: [orderCode] });
      if (res.data?.data) setCogsData(res.data.data[0]);
    } catch (err) { 
      alert('Error fetching COGS.'); 
    }
  };

  const fetchMergeList = async () => {
    try {
      // ✨ استخدام adminApi
      const res = await adminApi.post('/admin/merge/match');
      const data = res.data;
      
      if (data && data.data && Array.isArray(data.data.result)) {
        setMergeList(data.data.result);
      } else if (data && data.data && Array.isArray(data.data)) {
        setMergeList(data.data);
      } else {
        setMergeList([]);
      }
    } catch (err) {
      console.error('Error fetching merge list:', err);
      setMergeList([]);
    }
  };

  const fetchMakeup = async () => {
    try {
      // ✨ استخدام adminApi
      const res = await adminApi.get('/admin/makeup/list');
      if (res.data?.data?.pageData?.content) setMakeupList(res.data.data.pageData.content);
    } catch (err) { 
      alert('Error fetching makeup list.'); 
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/admin')} className="text-temu-orange font-bold mb-6">← Back to Admin</button>
        
        <div className="bg-white rounded-temu-sm p-8 border border-temu-gray-border-light">
          <h1 className="text-2xl font-extrabold text-temu-black mb-6">Advanced Dashboard</h1>
          
          {/* Tabs */}
          <div className="flex gap-4 mb-8 border-b border-temu-gray-border-light">
            <button onClick={() => setActiveTab('cogs')} className={`pb-2 font-bold text-sm ${activeTab === 'cogs' ? 'text-temu-orange border-b-2 border-temu-orange' : 'text-temu-gray-light'}`}>COGS Analysis</button>
            <button onClick={() => { setActiveTab('merge'); fetchMergeList(); }} className={`pb-2 font-bold text-sm ${activeTab === 'merge' ? 'text-temu-orange border-b-2 border-temu-orange' : 'text-temu-gray-light'}`}>Merge Orders</button>
            <button onClick={() => { setActiveTab('makeup'); fetchMakeup(); }} className={`pb-2 font-bold text-sm ${activeTab === 'makeup' ? 'text-temu-orange border-b-2 border-temu-orange' : 'text-temu-gray-light'}`}>Makeup Payments</button>
          </div>

          {/* COGS Tab */}
          {activeTab === 'cogs' && (
            <div>
              <form onSubmit={fetchCogs} className="flex gap-2 mb-4">
                <input type="text" value={orderCode} onChange={(e) => setOrderCode(e.target.value)} placeholder="Enter CJ Order Code (e.g. DP...)" className="flex-1 bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-2" required />
                <button type="submit" className="bg-temu-orange text-white font-bold px-4 rounded-temu-sm">Analyze</button>
              </form>
              {cogsData && (
                <div className="bg-temu-offwhite p-4 rounded-temu-sm border border-temu-gray-border-light">
                  <pre className="text-xs overflow-auto">{JSON.stringify(cogsData, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          {/* Merge Tab */}
          {activeTab === 'merge' && (
            <div>
              <button onClick={fetchMergeList} className="bg-temu-black text-white font-bold px-4 py-2 rounded-temu-sm mb-4">Refresh Matchable Orders</button>
              {Array.isArray(mergeList) && mergeList.length > 0 ? (
                mergeList.map((group: any, idx: number) => (
                  <div key={idx} className="bg-temu-offwhite p-4 rounded-temu-sm mb-4 border border-temu-gray-border-light">
                    <p className="font-bold text-temu-black mb-2">Group {idx + 1}</p>
                    {group.mergeShopOrderVOList?.map((shop: any, i: number) => (
                      <div key={i} className="text-sm text-temu-gray-text mb-1">
                        Order: {shop.shopOrderId} - {shop.logisticName}
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="text-sm text-temu-gray-light text-center py-4">No mergeable orders found. Click the button above to fetch.</p>
              )}
            </div>
          )}

          {/* Makeup Tab */}
          {activeTab === 'makeup' && (
            <div>
              <button onClick={fetchMakeup} className="bg-temu-black text-white font-bold px-4 py-2 rounded-temu-sm mb-4">Refresh Makeup Bills</button>
              {makeupList.map((bill: any) => (
                <div key={bill.orderCode} className="bg-temu-offwhite p-4 rounded-temu-sm mb-4 border border-temu-gray-border-light">
                  <p className="font-bold text-temu-black">Bill: {bill.orderCode}</p>
                  <p className="text-sm text-temu-error">Amount Due: ${bill.amount}</p>
                  <p className="text-xs text-temu-gray-light">Reason: {bill.reason}</p>
                </div>
              ))}
              {makeupList.length === 0 && <p className="text-temu-gray-light text-center">No pending makeup payments.</p>}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}