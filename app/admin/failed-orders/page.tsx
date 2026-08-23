'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';

interface Order {
  id: number;
  total_amount: number;
  status: string;
  payment_method: string;
  customer_name: string;
  created_at: string;
}

export default function FailedOrdersAdmin() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  // ✨ حالة لمعرفة أي زر يتم تحميله الآن (لمنع الـ Double Click)
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await adminApi.get('/admin/failed-orders');
      setOrders(res.data);
    } catch (error) {
      console.error('Error fetching failed orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleApprove = async (id: number) => {
    if (!confirm('Retry sending this order to CJ?')) return;
    setActionLoading(id); // ✨ قفل الزر
    try {
      await adminApi.put(`/admin/manual-orders/approve/${id}`);
      alert('Order retry initiated! It will be sent to CJ in the background.');
      fetchOrders(); 
    } catch (error) {
      console.error('Error approving order:', error);
      alert('Failed to approve order.');
    } finally {
      setActionLoading(null); // ✨ فك قفل الزر
    }
  };

  const handleReject = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    setActionLoading(id); // ✨ قفل الزر
    try {
      await adminApi.put(`/admin/manual-orders/reject/${id}`);
      alert('Order cancelled successfully.');
      fetchOrders(); 
    } catch (error) {
      console.error('Error rejecting order:', error);
      alert('Failed to reject order.');
    } finally {
      setActionLoading(null); // ✨ فك قفل الزر
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
        <button 
          onClick={() => router.push('/admin')} 
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Back to Dashboard
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-8">Manual & Pending Orders</h1>

        {orders.length === 0 ? (
          <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light text-center shadow-sm">
            <p className="text-temu-gray-text font-semibold">No failed orders. Everything is automated!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                
                <div className="grow">
                  <h3 className="font-bold text-temu-black text-lg">Order #{order.id}</h3>
                  <p className="text-sm text-temu-gray-light">Date: {new Date(order.created_at).toLocaleDateString()}</p>
                  <p className="text-sm text-temu-gray-light">Customer: {order.customer_name || 'N/A'}</p>
                  <p className="text-lg font-extrabold text-temu-error mt-2">
                    Total: ${Number(order.total_amount).toFixed(2)}
                    <span className="block text-sm text-temu-gray-light font-normal">
                      Method: {order.payment_method}
                    </span>
                  </p>                  
                  <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-temu-error">
                    MANUAL (Needs Action)
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button 
                    onClick={() => handleApprove(order.id)}
                    disabled={actionLoading === order.id}
                    className="bg-temu-green text-white px-4 py-2.5 rounded-temu-sm font-bold hover:bg-temu-green/90 transition cursor-pointer active:scale-95 touch-manipulation shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {actionLoading === order.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      'Retry & Send to CJ'
                    )}
                  </button>
                  <button 
                    onClick={() => handleReject(order.id)}
                    disabled={actionLoading === order.id}
                    className="bg-temu-error text-white px-4 py-2.5 rounded-temu-sm font-bold hover:bg-temu-error/90 transition cursor-pointer active:scale-95 touch-manipulation shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}