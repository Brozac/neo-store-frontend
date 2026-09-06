'use client';

import { useEffect, useState } from 'react';
import adminApi from '../../utils/adminApi';

interface Gateway {
  gateway_key: string;
  display_name: string;
  enabled: boolean;
}

export default function PaymentGatewaySettingsPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.get('/api/admin/payment-gateways');
      setGateways(res.data.gateways);
    } catch {
      setError('Impossible de charger les méthodes de paiement.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    setTogglingKey(key);
    setError('');
    setGateways(prev => prev.map(g => g.gateway_key === key ? { ...g, enabled: !currentEnabled } : g));

    try {
      await adminApi.patch(`/api/admin/payment-gateways/${key}`, { enabled: !currentEnabled });
    } catch {
      setError(`Échec de la mise à jour de ${key}.`);
      setGateways(prev => prev.map(g => g.gateway_key === key ? { ...g, enabled: currentEnabled } : g));
    } finally {
      setTogglingKey(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-temu-gray-light">Chargement...</div>;
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-black text-temu-black mb-1">Méthodes de paiement</h1>
      <p className="text-xs text-temu-gray-light mb-6">Active ou désactive les méthodes visibles sur le checkout, sans toucher au code.</p>

      {error && <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-xs font-bold">{error}</div>}

      <div className="space-y-3">
        {gateways.map((g) => (
          <div key={g.gateway_key} className="flex items-center justify-between p-4 border-2 border-temu-gray-border-light rounded-temu-sm">
            <div>
              <span className="font-extrabold text-temu-black text-sm block">{g.display_name}</span>
              <span className="text-[11px] text-temu-gray-light uppercase">{g.gateway_key}</span>
            </div>
            <button
              onClick={() => handleToggle(g.gateway_key, g.enabled)}
              disabled={togglingKey === g.gateway_key}
              className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 ${g.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${g.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}