'use client';

/**
 * ═══════════════════════════════════════════════════════════════════
 * ⚙️ LACLARC STORE SETTINGS — إعدادات المتجر (OpCenter v2)
 * ═══════════════════════════════════════════════════════════════════
 * لوحة سلوك المتجر + أدوات التكامل:
 *   1. show_reels — مفتاح عرض الريلز في الواجهة (PUT /admin/settings/show_reels)
 *   2. store_settings — عارض قيم الإعدادات الحية من GET /admin/settings
 *      (قراءة فقط — لا نكتب مفتاحاً ما يعرفش عقده الباك — fail-safe)
 *   3. CJ Webhooks — register + subscribe (الأدوات الربحية من الداشبورد)
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';
import AdminShell from '../_shell/AdminShell';

export default function StoreSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showReels, setShowReels] = useState<boolean | null>(null); // null = مجهول
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState('');

  // store_settings الحية من الباك (شكل دفاعي — الباك يرجع عدة أشكال)
  const [storeSettings, setStoreSettings] = useState<Record<string, any> | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await adminApi.get('/admin/settings');
      const d = res.data || {};
      // أشكال مقبولة: {show_reels: bool} | {value: {show_reels}} | {settings: {...}}
      const v = d.show_reels ?? d.value?.show_reels ?? d.settings?.show_reels;
      setShowReels(typeof v === 'boolean' ? v : null);

      const ss = d.store_settings ?? d.value?.store_settings ?? d.settings?.store_settings ?? null;
      setStoreSettings(ss && typeof ss === 'object' ? ss : null);
      setLoadError(false);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) { router.push('/admin/login'); return; }
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleToggleReels = async () => {
    if (showReels === null) {
      setMessage('⚠️ Current value unknown — reload settings first before toggling.');
      return;
    }
    const nextVal = !showReels;
    setToggling(true);
    setMessage('');
    // optimistic — السيرفر هو الحكم (نفس نمط payment-settings)
    setShowReels(nextVal);
    try {
      await adminApi.put('/admin/settings/show_reels', { value: nextVal });
      setMessage(`✅ Reels on homepage: ${nextVal ? 'SHOWN' : 'HIDDEN'} — live for all visitors instantly.`);
    } catch (err: any) {
      setShowReels(!nextVal);
      setMessage(`❌ Save failed: ${err.response?.data?.error || 'connection error'} — value reverted.`);
    } finally {
      setToggling(false);
    }
  };

  const runWebhook = async (kind: 'register' | 'subscribe') => {
    setMessage('');
    try {
      const res = await adminApi.post(kind === 'register' ? '/admin/webhook/register' : '/admin/webhook/subscribe');
      setMessage(`✅ ${kind === 'register' ? 'Register' : 'Subscribe'}: ${res.data?.message || 'Done'}`);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) { router.push('/admin/login'); return; }
      setMessage(`❌ ${kind} failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const settingsEntries = storeSettings ? Object.entries(storeSettings) : [];

  return (
    <AdminShell
      title="Store Settings — إعدادات المتجر"
      subtitle="Storefront behavior · integrations · webhooks"
    >
      <div className="max-w-4xl mx-auto space-y-6">

        {message && (
          <div className={`p-4 rounded-xl text-xs font-bold border ${
            message.includes('✅') ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-red-50 border-red-200 text-red-500'
          }`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-temu-gray-border-light p-12 flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#5F8271] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-gray-500">Loading store settings…</p>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-3">
            <p className="text-sm font-black text-red-500">⚠️ Settings fetch failed — current values UNKNOWN</p>
            <p className="text-xs text-gray-500">We do not guess and we do not show defaults as if they were real (fail-visible).</p>
            <button onClick={loadSettings} className="bg-temu-black hover:bg-temu-dark text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer">
              ↻ Retry
            </button>
          </div>
        ) : (
          <>
            {/* ═══ 1. Storefront Behavior ═══ */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
              <h2 className="text-base font-black text-temu-black mb-1">🏠 Storefront Behavior</h2>
              <p className="text-xs text-gray-500 mb-5">Instant switches that apply to every visitor of laclarc.com</p>

              <div className="bg-temu-offwhite p-5 rounded-2xl border border-temu-gray-border-light flex items-center justify-between gap-4">
                <div>
                  <h4 className="font-black text-sm text-temu-black">Display Reels on Homepage</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    show_reels &mdash; the Watch &amp; Shop video carousel on the storefront.
                  </p>
                  <p className={`text-[11px] font-black mt-1.5 ${showReels === null ? 'text-gray-400' : showReels ? 'text-emerald-600' : 'text-[#C86F4E]'}`}>
                    {showReels === null ? 'STATE UNKNOWN — toggling disabled' : showReels ? 'Currently: SHOWN ✓' : 'Currently: HIDDEN ✕'}
                  </p>
                </div>
                <button
                  onClick={handleToggleReels}
                  disabled={toggling || showReels === null}
                  aria-pressed={showReels === true}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer shrink-0 disabled:opacity-40 ${showReels ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  {toggling ? (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    </span>
                  ) : (
                    <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${showReels ? 'translate-x-7' : 'translate-x-0'}`} />
                  )}
                </button>
              </div>

              <p className="text-[10px] text-gray-400 mt-3">
                🔗 Reels content management (import/delete videos) lives in{' '}
                <button onClick={() => router.push('/admin')} className="underline font-bold text-[#5F8271] cursor-pointer">Operations Room → Watch &amp; Shop Reels</button>
              </p>
            </div>

            {/* ═══ 2. CJ Webhooks ═══ */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
              <h2 className="text-base font-black text-temu-black mb-1">🐺 CJ Webhook Integration</h2>
              <p className="text-xs text-gray-500 mb-5">
                Keep CJ Dropshipping pushing order &amp; logistics events to our backend. Run Register once after any backend URL change, then Subscribe the catalog.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => runWebhook('register')}
                  className="p-5 rounded-2xl bg-serene-mint border border-[#5F8271]/25 text-left hover:border-[#5F8271]/60 transition cursor-pointer active:scale-[0.98]"
                >
                  <span className="text-xl block mb-2">🐺</span>
                  <span className="text-sm font-black text-temu-black block">1. Register Webhooks</span>
                  <span className="text-xs text-gray-500 block mt-1">Point CJ event streams at our backend endpoint</span>
                </button>

                <button
                  onClick={() => runWebhook('subscribe')}
                  className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left hover:border-emerald-400 transition cursor-pointer active:scale-[0.98]"
                >
                  <span className="text-xl block mb-2">📌</span>
                  <span className="text-sm font-black text-temu-black block">2. Subscribe Products</span>
                  <span className="text-xs text-gray-500 block mt-1">Subscribe the catalog to stock &amp; price update events</span>
                </button>
              </div>
            </div>

            {/* ═══ 3. store_settings Viewer ═══ */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
                <div>
                  <h2 className="text-base font-black text-temu-black mb-1">🗄️ Live store_settings Snapshot</h2>
                  <p className="text-xs text-gray-500">Read-only truth from GET /admin/settings — no invented defaults</p>
                </div>
                <button onClick={loadSettings} className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-3 py-1.5 rounded-lg border border-temu-gray-border-light transition cursor-pointer">
                  ↻ Reload
                </button>
              </div>

              {!storeSettings ? (
                <div className="bg-temu-offwhite p-5 rounded-xl border border-dashed border-temu-gray-border-light text-xs text-gray-500 text-center">
                  No <span className="font-mono">store_settings</span> object returned by the backend — nothing to display (honest empty).
                </div>
              ) : settingsEntries.length === 0 ? (
                <div className="bg-temu-offwhite p-5 rounded-xl border border-dashed border-temu-gray-border-light text-xs text-gray-500 text-center">
                  store_settings is an empty object.
                </div>
              ) : (
                <div className="space-y-2">
                  {settingsEntries.map(([key, val]) => {
                    const display = typeof val === 'boolean'
                      ? (val ? 'true ✓' : 'false ✕')
                      : typeof val === 'object' && val !== null
                        ? JSON.stringify(val)
                        : String(val);
                    return (
                      <div key={key} className="p-3.5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light flex items-center justify-between gap-3 flex-wrap">
                        <span className="font-mono text-xs font-bold text-temu-black">{key}</span>
                        <span className={`font-mono text-xs px-2.5 py-1 rounded-lg border max-w-full break-all ${
                          typeof val === 'boolean'
                            ? (val ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-500 border-red-200')
                            : 'bg-white text-gray-600 border-temu-gray-border-light'
                        }`}>
                          {display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══ 4. Related Surfaces ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => router.push('/admin/payment-settings')}
                className="p-5 rounded-2xl bg-white border border-temu-gray-border-light text-left hover:border-[#5F8271]/60 transition cursor-pointer active:scale-[0.98]"
              >
                <span className="text-xl block mb-2">💳</span>
                <span className="text-sm font-black text-temu-black block">Payment Gateways</span>
                <span className="text-xs text-gray-500 block mt-1">Enable/disable BaridiMob, cards &amp; other checkout methods</span>
              </button>
              <button
                onClick={() => router.push('/admin/advanced')}
                className="p-5 rounded-2xl bg-white border border-temu-gray-border-light text-left hover:border-[#5F8271]/60 transition cursor-pointer active:scale-[0.98]"
              >
                <span className="text-xl block mb-2">🛠️</span>
                <span className="text-sm font-black text-temu-black block">CJ Financial Engine</span>
                <span className="text-xs text-gray-500 block mt-1">COGS, parcel merge &amp; carrier makeup bills</span>
              </button>
            </div>
          </>
        )}

      </div>
    </AdminShell>
  );
}
