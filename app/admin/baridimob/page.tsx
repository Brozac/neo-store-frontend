'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi'; // ✨ استيراد adminApi

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
      // ✨ استخدام adminApi
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
      // ✨ استخدام adminApi
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
      // ✨ استخدام adminApi
      await adminApi.put(`/admin/manual-orders/reject/${id}`);
      alert('Order rejected.');
      fetchOrders(); 
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order.');
    }
  };

  if (loading) return <div className="p-8 text-center text-temu-black">Loading orders...</div>;

  return (
    <div className="min-h-screen bg-temu-offwhite p-8">
      <div className="max-w-6xl mx-auto">
        <button onClick={() => router.push('/admin')} className="text-temu-orange font-bold mb-6 inline-block">
          ← Back to Dashboard
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-8">BaridiMob Orders Management</h1>

        {orders.length === 0 ? (
          <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light text-center">
            <p className="text-temu-gray-text font-semibold">No BaridiMob orders found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                
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
                  {/* حالة الطلب */}
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                    order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    order.status === 'paid' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {order.status === 'pending' ? 'Pending Review' : order.status}
                  </span>
                </div>

                {/* الإجراءات */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button 
                    onClick={() => setSelectedReceipt(order.receipt_url)}
                    className="bg-temu-black text-white px-4 py-2 rounded-temu-sm font-bold hover:bg-temu-dark transition cursor-pointer"
                  >
                    View Receipt
                  </button>

                  {order.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleApprove(order.id)}
                        className="bg-temu-green text-white px-4 py-2 rounded-temu-sm font-bold hover:bg-green-600 transition cursor-pointer"
                      >
                        Approve & Send to CJ
                      </button>
                      <button 
                        onClick={() => handleReject(order.id)}
                        className="bg-temu-error text-white px-4 py-2 rounded-temu-sm font-bold hover:bg-red-600 transition cursor-pointer"
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
              <button onClick={() => setSelectedReceipt(null)} className="text-temu-gray-light hover:text-temu-black cursor-pointer font-bold">Close X</button>
            </div>
            <img src={selectedReceipt} alt="Payment Receipt" className="w-full h-auto rounded-temu-sm" />
          </div>
        </div>
      )}
    </div>
  );
}