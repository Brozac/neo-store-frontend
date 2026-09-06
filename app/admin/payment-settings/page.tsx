'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';
interface Gateway {
  gateway_key: string;
  display_name: string;
  enabled: boolean;
}

export default function PaymentSettingsPage() {
  const router = useRouter();
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
      setGateways(res.data);
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
    return <div className="p-6 text-sm text-gray-500">Chargement...</div>;
  }

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-2xl mx-auto">
        
        {/* زر العودة للوحة التحكم */}
        <button 
          onClick={() => router.push('/admin')} 
          className="flex items-center gap-2 text-temu-orange font-bold mb-6 active:scale-95 transition touch-manipulation w-fit text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          Back to Dashboard
        </button>

        <div className="bg-white p-6 rounded-2xl border border-temu-gray-border-light shadow-sm">
          <h1 className="text-xl font-black text-temu-black mb-1">Méthodes de paiement</h1>
          <p className="text-xs text-gray-500 mb-6">Active ou désactive les méthodes visibles sur le checkout, sans toucher au code.</p>

          {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-xs font-bold">{error}</div>}

          <div className="space-y-3">
            {gateways.map((g) => (
              <div key={g.gateway_key} className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-xl">
                <div>
                  <span className="font-extrabold text-temu-black text-sm block">{g.display_name}</span>
                  <span className="text-[11px] text-gray-400 uppercase">{g.gateway_key}</span>
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
      </div>
    </main>
  );
}