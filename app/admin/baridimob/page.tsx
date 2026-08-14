'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';

interface Order {
  id: number;
  total_amount: number;
  status: string;
  receipt_url: string;
  created_at: string;
}

export default function BaridiMobOrdersAdmin() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await adminApi.get('/admin/manual-orders');
      setOrders(res.data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleApprove = async (id: number) => {
    if (!confirm('Are you sure you want to approve this order and send it to CJ?')) return;
    try {
      await adminApi.put(`/admin/manual-orders/approve/${id}`);
      alert('Order approved and sent to CJ!');
      fetchOrders(); 
    } catch (error) {
      console.error('Error approving order:', error);
      alert('Failed to approve order.');
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Are you sure you want to reject this order?')) return;
    try {
      await adminApi.put(`/admin/manual-orders/reject/${id}`);
      alert('Order rejected.');
      fetchOrders(); 
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-temu-offwhite p-8">
      <div className="max-w-6xl mx-auto">
        {/* ✨ زر الرجوع بأيقونة وتأثير الضغط */}
        <button 
          onClick={() => router.push('/admin')} 
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Dashboard
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-8">BaridiMob Orders Management</h1>

        {orders.length === 0 ? (
          <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light text-center shadow-sm">
            <p className="text-temu-gray-text font-semibold">No BaridiMob orders found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                
                {/* تفاصيل الطلب */}
                <div className="grow">
                  <h3 className="font-bold text-temu-black text-lg">Order #{order.id}</h3>
                  <p className="text-sm text-temu-gray-light">Date: {new Date(order.created_at).toLocaleDateString()}</p>
                  <p className="text-lg font-extrabold text-temu-error mt-2">
                    المبلغ المطلوب: {Math.round(Number(order.total_amount) * 255)} DZD
                    <span className="block text-sm text-temu-gray-light font-normal">
                      (ما يعادل ${Number(order.total_amount).toFixed(2)})
                    </span>
                  </p>                  
                  
                  {/* ✨ توحيد ألوان شارات الحالة */}
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === 'pending' ? 'bg-temu-yellow-soft text-temu-gold' :
                    order.status === 'paid' || order.status === 'fulfilled' ? 'bg-temu-green-light/20 text-temu-green' :
                    'bg-red-50 text-temu-error'
                  }`}>
                    {order.status === 'pending' ? 'Pending Review' : order.status}
                  </span>
                </div>

                {/* الإجراءات */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* ✨ زر عرض الإيصال مع تأثير الضغط */}
                  <button 
                    onClick={() => setSelectedReceipt(order.receipt_url)}
                    className="bg-temu-black text-white px-4 py-2.5 rounded-temu-sm font-bold hover:bg-temu-dark transition cursor-pointer active:scale-95 touch-manipulation shadow-sm"
                  >
                    View Receipt
                  </button>

                  {order.status === 'pending' && (
                    <>
                      {/* ✨ زر الموافقة مع تأثير الضغط */}
                      <button 
                        onClick={() => handleApprove(order.id)}
                        className="bg-temu-green text-white px-4 py-2.5 rounded-temu-sm font-bold hover:bg-temu-green/90 transition cursor-pointer active:scale-95 touch-manipulation shadow-sm"
                      >
                        Approve & Send to CJ
                      </button>
                      {/* ✨ زر الرفض مع تأثير الضغط */}
                      <button 
                        onClick={() => handleReject(order.id)}
                        className="bg-temu-error text-white px-4 py-2.5 rounded-temu-sm font-bold hover:bg-temu-error/90 transition cursor-pointer active:scale-95 touch-manipulation shadow-sm"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* نافذة عرض الإيصال */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedReceipt(null)}>
          <div className="bg-white p-4 rounded-temu-sm max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              {/* ✨ زر الإغلاق مع تأثير الضغط */}
              <button 
                onClick={() => setSelectedReceipt(null)} 
                className="text-temu-gray-light hover:text-temu-black cursor-pointer font-bold active:scale-90 transition touch-manipulation flex items-center gap-1"
              >
                Close
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <img src={selectedReceipt} alt="Payment Receipt" className="w-full h-auto rounded-temu-sm" />
          </div>
        </div>
      )}
    </div>
  );
}