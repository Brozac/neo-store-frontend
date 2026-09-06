'use client';
import { useState, useEffect } from 'react';
import adminApi from '../utils/adminApi';

export default function PaymentGatewaysSettings() {
  const [gateways, setGateways] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchGateways = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get('/admin/payment-gateways');
      setGateways(res.data);
      setError('');
    } catch (err: any) {
      console.error('Error fetching gateways:', err);
      setError('Impossible de charger les méthodes de paiement.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGateways();
  }, []);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    try {
      await adminApi.patch(`/admin/payment-gateways/${key}`, { enabled: !currentEnabled });
      fetchGateways(); // تحديث القائمة
    } catch (err: any) {
      alert('Failed to update gateway.');
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 p-4 text-center">Chargement des méthodes...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-500 p-4 text-center">{error}</div>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-4">Active ou désactive les méthodes visibles sur le checkout, sans toucher au code.</p>
      {gateways.map((g) => (
        <div key={g.gateway_key} className="flex items-center justify-between p-4 bg-temu-offwhite rounded-xl border border-gray-200">
          <span className="font-bold text-sm text-temu-black">{g.display_name}</span>
          <button
            onClick={() => handleToggle(g.gateway_key, g.enabled)}
            className={`w-12 h-6 rounded-full transition relative cursor-pointer ${g.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition transform ${g.enabled ? 'translate-x-6' : ''}`}></span>
          </button>
        </div>
      ))}
    </div>
  );
}