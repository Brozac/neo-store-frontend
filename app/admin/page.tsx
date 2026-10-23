'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../utils/adminApi';

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

interface TelemetryState {
  backendStatus: 'healthy' | 'checking' | 'offline';
  backendPing: number;
  pendingBaridiCount: number | null;   // null = مجهول — لا نكذب بـ 0
  failedOrdersCount: number | null;
  lastChecked: string;
}

function flattenCategories(nodes: CategoryNode[], parentPath = ''): { value: string; label: string }[] {
  let flat: { value: string; label: string }[] = [];
  for (const node of nodes) {
    const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;
    flat.push({ value: currentPath, label: `${parentPath ? parentPath + ' / ' : ''}${node.name}` });
    if (node.children && node.children.length > 0) {
      flat = flat.concat(flattenCategories(node.children, currentPath));
    }
  }
  return flat;
}

// ═══ 📋 System Events Panel — Automated Decision Audit Trail (Mission #9) ═══
function SystemEventsPanel() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const load = async (t?: string) => {
    setLoading(true);
    try {
      const res = await adminApi.get(`/admin/system-events?limit=50${t ? `&type=${t}` : ''}`);
      setEvents(res.data.events || []);
      setFetchError(false);
    } catch (e) {
      console.error('system-events fetch failed', e);
      setFetchError(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(filter); }, [filter]);

  const sevStyle: Record<string, string> = {
    critical: 'text-red-600 border-red-200 bg-red-50',
    warning:  'text-butter-up-600 border-butter-up-200 bg-butter-up-50',
    info:     'text-maroccan-tea-600 border-maroccan-tea-200 bg-maroccan-tea-50',
  };

  const EVENT_TYPES = [
    '', 'FINANCIAL_GATE_DENY', 'FINANCIAL_GATE_ERROR', 'SELFHEAL_DELETE',
    'SELFHEAL_PAYBALANCE', 'SELFHEAL_MANUALIZED', 'DISPUTE_FOUND', 'WALLET_EMPTY',
  ];

  // الموثقة في system_events (DRS §5) — عين M#31 كتخدم هنا
  const EVENT_TYPES_V2 = ['CJ_ORDER_HALTED', 'WEBHOOK_SPOOF_REJECTED', 'CJ_NUMBER_BURNED',
    'SHIPPING_BLOCKED_FLAG', 'CRYPTO_NO_ADDRESS', 'PAYSERA_AMOUNT_MISMATCH',
    'CJ_INTERCEPT_REASON', 'VERIFIED_REVIEW_SUBMITTED', 'TOPSELLERS_IMPORT'];
  // دمج بلا تكرار — القديمة + الجديدة
  for (const t of EVENT_TYPES_V2) if (!EVENT_TYPES.includes(t)) EVENT_TYPES.push(t);
  return (
    <div className="bg-white text-temu-black rounded-2xl p-5 border border-temu-gray-border-light space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider text-[#5B7EA6] flex items-center gap-2">
          📋 System Events — Automated Decisions
        </h3>
        <button onClick={() => load(filter)} className="text-xs text-gray-400 hover:text-[#5B7EA6] transition cursor-pointer">↻ Refresh</button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {EVENT_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
              filter === t ? 'bg-[#5B7EA6] text-white border-[#5B7EA6]' : 'border-temu-gray-border-light text-gray-500 hover:text-temu-black'
            }`}>
            {t || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs text-gray-400 py-6 text-center">⏳ Loading...</div>
      ) : fetchError ? (
        <div className="text-xs text-red-500 py-6 text-center border border-red-200 bg-red-50 rounded-xl">
          ⚠️ Fetch failed — status unknown, NOT quiet.{' '}
          <button onClick={() => load(filter)} className="underline font-bold cursor-pointer">Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="text-xs text-gray-500 py-6 text-center">🟢 No events — system quiet and fully operational</div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {events.map(ev => (
            <div key={ev.id} className={`p-3 rounded-xl border text-xs ${sevStyle[ev.severity] || sevStyle.info}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-black">{ev.event_type}</span>
                <span className="text-gray-400 text-[10px]">
                  {ev.order_id ? `#${ev.order_id} • ` : ''}{new Date(ev.created_at).toLocaleString()}
                </span>
              </div>
              {Object.keys(ev.details || {}).length > 0 && (
                <pre className="mt-1.5 text-[10px] text-gray-600 whitespace-pre-wrap break-all">
                  {JSON.stringify(ev.details, null, 0)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const tabsRef = useRef<HTMLDivElement>(null);

  // 🖱️ عجلة الموس → سكرول أفقي (listener أصلي — passive:false يسمح بـ preventDefault)
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        el.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [syncCategory, setSyncCategory] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // ✨ حالات الفيديوهات والريلز
  const [syncingVideos, setSyncingVideos] = useState(false);
  const [showReels, setShowReels] = useState(true);
  const [videoProducts, setVideoProducts] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const [adminSearch, setAdminSearch] = useState('');
  const [availableCategories, setAvailableCategories] = useState<{ value: string; label: string }[]>([]);
  const [syncingCats, setSyncingCats] = useState(false);
  const [backfillingCats, setBackfillingCats] = useState(false);

  const [singlePid, setSinglePid] = useState('');
  const [syncingSingle, setSyncingSingle] = useState(false);
  const [singleMessage, setSingleMessage] = useState('');
  const [massSyncing, setMassSyncing] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryState>({
    backendStatus: 'checking',
    backendPing: 0,
    pendingBaridiCount: null,
    failedOrdersCount: null,
    lastChecked: '--',
  });

  const [formData, setFormData] = useState({
    title: '', price: '', original_price: '', image_url: '', images: '',
    description: '', material: '', colors: '', sizes: '', category: 'other'
  });

  const runDiagnostics = async () => {
    const startTime = Date.now();
    try {
      setTelemetry(prev => ({ ...prev, backendStatus: 'checking' }));

      // null = مجهول — الفشل ما يترجمش لصفر كاذب
      const [manualOrdersRes, failedOrdersRes] = await Promise.all([
        adminApi.get('/admin/manual-orders').then(r => r.data).catch(() => null),
        adminApi.get('/admin/failed-orders').then(r => r.data).catch(() => null),
      ]);

      setTelemetry({
        backendStatus: 'healthy',
        backendPing: Date.now() - startTime,
        pendingBaridiCount: Array.isArray(manualOrdersRes)
          ? manualOrdersRes.filter((o: any) => o.status === 'pending').length
          : null,
        failedOrdersCount: Array.isArray(failedOrdersRes) ? failedOrdersRes.length : null,
        lastChecked: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
        return;
      }
      setTelemetry(prev => ({ ...prev, backendStatus: 'offline', lastChecked: new Date().toLocaleTimeString() }));
    }
  };

  // ✨ جلب الفيديوهات
  const fetchVideoProducts = async () => {
    setLoadingVideos(true);
    try {
      adminApi.get('/admin/settings')
        .then(res => {
          const v = res.data?.show_reels ?? res.data?.value?.show_reels;
          if (typeof v === 'boolean') setShowReels(v);
        })
        .catch(e => console.error('[admin] settings load failed:', e.message));

      // P1-1: server-side filter — لا ننزل الكاتالوغ كاملاً للبراوزر
      const productsRes = await adminApi.get('/admin/videos');
      if (Array.isArray(productsRes.data)) setVideoProducts(productsRes.data);
    } catch (err) {
      console.error('Error fetching reels data:', err);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    runDiagnostics();
    fetchVideoProducts();
    adminApi.get('/categories')
      .then(res => setAvailableCategories(flattenCategories(res.data)))
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) router.push('/admin/login');
      });
  }, [router]);

  const handleAdminSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminSearch.trim()) router.push(`/admin/manage?search=${encodeURIComponent(adminSearch.trim())}`);
  };

  const handleLogout = async () => {
    try { await adminApi.post('/admin/logout'); } finally { router.push('/admin/login'); }
  };

  const handleSyncCategories = async () => {
    setSyncingCats(true);
    try {
      const res = await adminApi.post('/admin/sync-categories');
      alert(`✅ ${res.data.message}`);
    } catch (err: any) { alert(`❌ Error: ${err.response?.data?.error || 'Network Error'}`); }
    finally { setSyncingCats(false); }
  };

  const handleBackfillCategories = async () => {
    if (!confirm('This will update categories for all existing products in background. Continue?')) return;
    setBackfillingCats(true);
    try {
      const res = await adminApi.post('/admin/backfill-categories');
      alert(`✅ ${res.data.message}`);
    } catch (err: any) { alert(`❌ Error: ${err.response?.data?.error || 'Server error'}`); }
    finally { setBackfillingCats(false); }
  };

  const handleSyncCJ = async () => {
    setSyncing(true);
    setSyncMessage('⏳ Sync started in background. Check server logs.');
    try {
      const url = syncCategory ? `/sync-cj-products?keyword=${encodeURIComponent(syncCategory)}` : '/sync-cj-products';
      const res = await adminApi.get(url);
      setSyncMessage(`✅ ${res.data.message}`);
    } catch (err: any) { setSyncMessage(`❌ Error: ${err.response?.data?.error || 'Failed to connect.'}`); }
    finally { setSyncing(false); }
  };

  const handleSyncSingle = async () => {
    if (!singlePid.trim()) return;
    setSyncingSingle(true);
    setSingleMessage('⏳ Sourcing product by PID from CJ...');
    try {
      const res = await adminApi.post('/admin/sync-single-product', { pid: singlePid.trim() });
      setSingleMessage(`✅ ${res.data.message}`);
      setSinglePid('');
    } catch (err: any) { setSingleMessage(`❌ Error: ${err.response?.data?.error || 'Failed to sync.'}`); }
    finally { setSyncingSingle(false); }
  };

  const handleMassSync = async () => {
    if (!confirm('⚠️ This will fetch up to 1200 products from CJ. It will run in the background. Continue?')) return;
    setMassSyncing(true);
    setSyncMessage('🚀 Mass Sync Engine started in background! Check server logs.');
    try {
      await adminApi.get('/sync-cj-products');
    } catch (err: any) {
      setSyncMessage(`❌ Error: ${err.response?.data?.error || 'Failed to start mass sync.'}`);
    } finally {
      setTimeout(() => setMassSyncing(false), 3000);
    }
  };

  const handleSyncVideos = async () => {
    setSyncingVideos(true);
    setSyncMessage('🎬 Multi-keyword video hunt started in background (~15 min)...');
    try {
      await adminApi.post('/admin/sync-videos');
      alert('🎬 Video Sync v2 triggered! Check server logs in ~15 minutes for results.');
    } catch (err: any) {
      setSyncMessage(`❌ Error: ${err.response?.data?.error || 'Failed to start video sync.'}`);
    } finally {
      setSyncingVideos(false);
    }
  };

  const handleDeleteVideo = async (productId: number | string) => {
    if (!confirm('Remove video from this product? The item will remain in the store without video.')) return;
    try {
      const res = await adminApi.delete(`/admin/videos/${productId}`);
      if (res.data?.success) {
        setVideoProducts(prev => prev.filter(p => p.id !== productId));
        alert('✅ Video removed successfully. Product remains in store.');
      } else {
        alert(`❌ ${res.data?.error || 'Failed to delete video.'}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.error || 'Failed to delete video.'}`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage('📤 Uploading images to Cloudinary...');
    const uploadData = new FormData();
    for (let i = 0; i < files.length; i++) uploadData.append('images', files[i]);
    try {
      const res = await adminApi.post('/admin/upload', uploadData);
      const urls = res.data.urls;
      setFormData(prev => ({
        ...prev,
        image_url: prev.image_url || urls[0],
        images: prev.images ? `${prev.images}, ${urls.join(', ')}` : urls.join(', ')
      }));
      setMessage('✅ Images uploaded successfully!');
    } catch (err: any) { setMessage(`❌ Upload Error: ${err.response?.data?.error || 'Unknown error'}`); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) return;
    setScraping(true);
    setMessage('');
    try {
      const res = await adminApi.post('/admin/scrape-product', { url: scrapeUrl.trim() });
      const data = res.data;
      const galleryImages = Array.isArray(data.images) && data.images.length > 0 ? data.images.join(', ') : (data.image_url || '');
      setFormData(prev => ({
        ...prev,
        title: data.title || '',
        price: data.price || '',
        image_url: data.images?.[0] || data.image_url || '',
        images: galleryImages,
        description: data.description || ''
      }));
      setMessage('✅ Scraped product data & images fetched successfully!');
    } catch (err: any) { setMessage(`❌ Scrape Error: ${err.response?.data?.error || 'Failed to fetch product details.'}`); }
    finally { setScraping(false); }
  };

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 🛡️ v1.1 — نفس حراس manage (السيرفر هو الحكم — هادو UX)
    const parsedPrice = Number(formData.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 9.99) {
      setLoading(false);
      return setMessage('❌ Price floor is $9.99 (v3.1) — cannot publish below this.');
    }
    if (!formData.title.trim()) { setLoading(false); return setMessage('❌ Title is required.'); }
    const parsedOriginal = formData.original_price ? Number(formData.original_price) : null;
    if (parsedOriginal !== null && (!Number.isFinite(parsedOriginal) || parsedOriginal <= parsedPrice)) {
      setLoading(false);
      return setMessage('❌ Original price must be higher than the selling price (or leave empty).');
    }

    try {
      const payload = {
        title: formData.title.trim(),
        price: parsedPrice,
        original_price: parsedOriginal,          // 🩹 null — قرار 1 (بلا 0)
        image_url: formData.image_url,
        images: formData.images.split(',').map(img => img.trim()).filter(Boolean),
        description: formData.description,
        material: formData.material || '',       // 🩹 قرار 2 — بلا شعار مجاني
        colors: formData.colors.split(',').map(col => col.trim()).filter(Boolean),
        sizes: formData.sizes.split(',').map(sz => sz.trim()).filter(Boolean),
        category: formData.category
      };
      await adminApi.post('/admin/add-product', payload);
      setMessage('✅ Product published successfully!');
      setFormData({ title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other' });
      setScrapeUrl('');
    } catch (err: any) { setMessage(`❌ Error: ${err.response?.data?.error || 'Failed to save product.'}`); }
    finally { setLoading(false); }
  };

  const imagePreviews = formData.images.split(',').map(img => img.trim()).filter(Boolean);

  const tabs = [
    { id: 'overview', label: 'Operations Command', icon: '⚡' },
    { id: 'reels', label: 'Watch & Shop Reels', icon: '🎬' },
    { id: 'add', label: 'Add Product', icon: '➕' },
    { id: 'sync', label: 'CJ Sync & Sourcing', icon: '🔄' },
    { id: 'sourcing', label: '1688 Sourcing', icon: '🏭' },
    { id: 'coupons', label: 'Coupons & Promos', icon: '🎟️' },
    { id: 'events', label: 'System Events', icon: '📋' },
  ];

  return (
    <main className="min-h-screen bg-temu-offwhite text-temu-black p-6 pb-24 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Top Header & Fast Nav */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b border-temu-gray-border-light pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-tr from-[#5B7EA6] to-[#7FA1C4] rounded-xl flex items-center justify-center font-black text-white shadow-lg">
              L
            </div>
            <div>
              <h1 className="text-xl font-black text-temu-black tracking-wide">Laclarc Mission Control</h1>
              <p className="text-[11px] text-gray-500">Enterprise Operations &bull; Global Dropshipping</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* 🐺 مؤقت: تسجيل Webhooks CJ — تحيدو من بعد الاستعمال */}
            <button
              onClick={async () => {
                try {
                  const res = await adminApi.post('/admin/webhook/register');
                  alert(`1️⃣ Register:\n${res.data?.message || 'Done'}`);
                } catch (err: any) {
                  alert(`❌ Register failed:\n${err.response?.data?.error || err.message}`);
                }
              }}
              className="px-3.5 py-2 bg-fog-50 hover:bg-fog-100 border border-fog-200 rounded-xl text-xs font-bold text-fog-600 transition cursor-pointer"
            >
              🐺 Register Webhooks
            </button>

            <button
              onClick={async () => {
                try {
                  const res = await adminApi.post('/admin/webhook/subscribe');
                  alert(`2️⃣ Subscribe:\n${res.data?.message || 'Done'}`);
                } catch (err: any) {
                  alert(`❌ Subscribe failed:\n${err.response?.data?.error || err.message}`);
                }
              }}
              className="px-3.5 py-2 bg-maroccan-tea-50 hover:bg-maroccan-tea-100 border border-maroccan-tea-200 rounded-xl text-xs font-bold text-maroccan-tea-600 transition cursor-pointer"
            >
              📌 Subscribe Products
            </button>

            <button
              onClick={() => router.push('/')}
              className="px-3.5 py-2 bg-white hover:bg-temu-offwhite border border-temu-gray-border-light rounded-xl text-xs font-bold text-temu-black transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              🌐 Storefront
            </button>
            <button
              onClick={handleLogout}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-500 transition flex items-center gap-1.5 cursor-pointer"
            >
              🔒 Logout
            </button>
          </div>
        </div>

        {/* 🛰️ Live Infrastructure Pulse */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-temu-gray-border-light rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${telemetry.backendStatus === 'healthy' ? 'bg-maroccan-tea-500 animate-pulse' : 'bg-red-500'}`}></span>
              Render Backend
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">
                {telemetry.backendStatus === 'healthy' ? 'Operational' : 'Checking'}
              </span>
              <span suppressHydrationWarning className="text-[11px] font-mono text-gray-500">{telemetry.backendPing}ms</span>
            </div>
          </div>

          <div className="bg-white border border-temu-gray-border-light rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#5B7EA6]"></span>
              Neon DB
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">{telemetry.backendStatus === 'healthy' ? 'Connected' : telemetry.backendStatus === 'checking' ? 'Checking…' : 'Unreachable'}</span>
              <span className="text-[11px] font-mono text-maroccan-tea-500">{telemetry.backendStatus === 'healthy' ? 'Pool Active' : '—'}</span>
            </div>
          </div>

          <div
            onClick={() => router.push('/admin/baridimob')}
            className={`cursor-pointer border rounded-xl p-3.5 flex flex-col justify-between transition shadow-xs hover:shadow-md ${
              (telemetry.pendingBaridiCount ?? 0) > 0 ? 'bg-linear-to-br from-white to-coral-50 border-[#7FA1C4]' : 'bg-white border-temu-gray-border-light'
            }`}
          >
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              🏦 BaridiMob Review
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">{telemetry.pendingBaridiCount === null ? <span className="text-gray-400">—</span> : telemetry.pendingBaridiCount}</span>
              <span className="text-[11px] text-[#7FA1C4] font-bold">Action Needed &rarr;</span>
            </div>
          </div>

          <div
            onClick={() => router.push('/admin/failed-orders')}
            className={`cursor-pointer border rounded-xl p-3.5 flex flex-col justify-between transition shadow-xs hover:shadow-md ${
              (telemetry.failedOrdersCount ?? 0) > 0 ? 'bg-linear-to-br from-white to-red-50 border-red-400' : 'bg-white border-temu-gray-border-light'
            }`}
          >
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              ⚠️ Failed in CJ
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">{telemetry.failedOrdersCount === null ? <span className="text-gray-400">—</span> : telemetry.failedOrdersCount}</span>
              <span className="text-[11px] text-red-500 font-bold">Resolve Queue &rarr;</span>
            </div>
          </div>
        </div>

        {/* Quick Search */}
        <form onSubmit={handleAdminSearch} className="relative mb-6">
          <input
            type="text"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="🔍 Search inventory products by title or ID to edit, price, or mark as deal..."
            className="w-full bg-white border border-temu-gray-border-light rounded-xl py-3.5 pl-4 pr-12 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-[#5B7EA6] transition shadow-xs"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#5B7EA6] p-1 cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
        </form>

        {/* Command Center Tabs — 🖱️ wheel=أفقي + مؤشر رقيق */}
        <div
          ref={tabsRef}
          className="tabstrip flex gap-2 overflow-x-auto pb-3 mb-6 border-b border-temu-gray-border-light snap-x"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-wider font-extrabold whitespace-nowrap transition cursor-pointer rounded-xl snap-start shrink-0 ${
                activeTab === tab.id
                  ? 'bg-linear-to-r from-[#5B7EA6] to-[#46648A] text-white shadow-lg shadow-[#5B7EA6]/20'
                  : 'bg-white text-gray-500 border border-temu-gray-border-light hover:bg-temu-offwhite hover:text-temu-black'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Box */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">

          {/* 1. Overview Operations */}
          {activeTab === 'overview' && (
            <div>
              <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-black text-temu-black">Operations Center</h2>
                  <p className="text-xs text-gray-500">Direct modules to manage inventory, payments, and disputes</p>
                </div>
                <button
                  onClick={runDiagnostics}
                  className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-3 py-1.5 rounded-lg border border-temu-gray-border-light transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span suppressHydrationWarning>🔄 Refresh Status ({telemetry.lastChecked})</span>
                </button>
              </div>

              {/* بطاقات العمليات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Manage Products', desc: 'Price updates, stock status & Lightning Deals ⚡', link: '/admin/manage', color: 'from-[#5B7EA6] to-fog-600', icon: '📦' },
                  { label: 'Watch & Shop Reels', desc: `Manage ${videoProducts.length} video feeds & visibility`, action: () => setActiveTab('reels'), color: 'from-coral-500 to-coral-600', icon: '🎬' },
                  { label: 'BaridiMob Approvals', desc: 'Inspect customer bank receipts and approve', link: '/admin/baridimob', color: 'from-[#7FA1C4] to-coral-600', icon: '🇩🇿' },
                  { label: 'Manual & Failed Orders', desc: 'Rescue orders that failed automated CJ fulfillment', link: '/admin/failed-orders', color: 'from-butter-up-500 to-red-600', icon: '🚨' },
                  { label: 'CJ Disputes Center', desc: 'Track refunds, damaged shipments & complaints', link: '/admin/disputes', color: 'from-cyan-500 to-fog-600', icon: '⚖️' },
                  { label: 'Advanced Engine Tools', desc: 'Auto-categorization & database maintenance', link: '/admin/advanced', color: 'from-fog-600 to-[#2E4057]', icon: '🛠️' },
                ].map((card, i) => (
                  <button
                    key={i}
                    onClick={() => card.link ? router.push(card.link) : card.action?.()}
                    className="text-left p-5 rounded-xl bg-white border border-temu-gray-border-light hover:border-[#5B7EA6]/60 transition group cursor-pointer active:scale-[0.98] shadow-xs"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-linear-to-tr ${card.color} flex items-center justify-center text-lg mb-3 shadow-md`}>
                      {card.icon}
                    </div>
                    <h3 className="font-bold text-temu-black text-sm group-hover:text-[#5B7EA6] transition">{card.label}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 📈 ويدجت أرباح الإعلانات المباشرة */}
          <div className="mt-8 bg-white p-6 rounded-2xl border border-temu-gray-border-light shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-black text-temu-black flex items-center gap-2">
                  <span>📊</span> Ad Campaigns & Revenue Attribution (Last 30 Days)
                </h3>
                <p className="text-xs text-gray-500">Track which ad network generates the most paid revenue</p>
              </div>
              <span className="text-[10px] font-bold uppercase bg-fog-50 text-[#5B7EA6] border border-[#5B7EA6]/20 px-2.5 py-1 rounded-full">
                Real-time ROI
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 block uppercase">TikTok Ads</span>
                  <span className="text-xs text-gray-400">Tracked via ttclid</span>
                </div>
                <span className="text-sm font-black text-black">Active 🎯</span>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 block uppercase">Facebook / Meta</span>
                  <span className="text-xs text-gray-400">Tracked via fbclid</span>
                </div>
                <span className="text-sm font-black text-[#5B7EA6]">Active 🎯</span>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-gray-500 block uppercase">Organic / Direct</span>
                  <span className="text-xs text-gray-400">Word of mouth</span>
                </div>
                <span className="text-sm font-black text-maroccan-tea-600">Free 🌿</span>
              </div>
            </div>
          </div>

          {/* ✨ 2. Watch & Shop Reels */}
          {activeTab === 'reels' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4 border-b border-temu-gray-border-light pb-4">
                <div>
                  <h2 className="text-lg font-black text-temu-black flex items-center gap-2">
                    <span>🎬</span> Watch & Shop Reels Management
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">Control live video demonstration feeds on your storefront homepage</p>
                </div>

                <button
                  onClick={fetchVideoProducts}
                  className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-3.5 py-2 rounded-xl border border-temu-gray-border-light transition flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  🔄 Reload Videos
                </button>
              </div>

              <div className="bg-temu-offwhite p-5 rounded-2xl border border-temu-gray-border-light flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-temu-black">Display Reels on Homepage</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Global setting — applies to <strong>all visitors</strong> instantly.
                  </p>
                </div>

                <button
                  onClick={async () => {
                    const nextVal = !showReels;
                    setShowReels(nextVal);
                    try {
                      await adminApi.put('/admin/settings/show_reels', { value: nextVal });
                    } catch (e) {
                      setShowReels(!nextVal);
                      alert('⚠️ Could not save the setting. Check your connection and try again.');
                    }
                  }}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer ${showReels ? 'bg-maroccan-tea-500' : 'bg-gray-300'}`}
                  aria-pressed={showReels}
                >
                  <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${showReels ? 'translate-x-7' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="bg-fog-50/60 p-5 rounded-2xl border border-[#5B7EA6]/25 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-black text-sm text-temu-black">Sync New Video Assets</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Multi-keyword hunt (v2): scans 12 categories for fresh video drops. Takes ~15 min in background.
                  </p>
                </div>
                <button
                  onClick={handleSyncVideos}
                  disabled={syncingVideos}
                  className="bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {syncingVideos ? 'Scanning CJ Videos...' : 'Scan & Import Videos'}
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                    Active Videos in Store ({videoProducts.length})
                  </h4>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full border ${
                    videoProducts.length >= 5
                      ? 'bg-maroccan-tea-50 text-maroccan-tea-600 border-maroccan-tea-200'
                      : 'bg-butter-up-50 text-butter-up-600 border-butter-up-200'
                  }`}>
                    {videoProducts.length >= 5 ? '✓ Reels Ready' : 'Need 5+ for full carousel'}
                  </span>
                </div>

                {loadingVideos ? (
                  <div className="text-center py-10">
                    <div className="w-6 h-6 border-2 border-[#5B7EA6] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-gray-400 font-bold">Scanning database for video products...</p>
                  </div>
                ) : videoProducts.length === 0 ? (
                  <div className="text-center py-12 bg-temu-offwhite rounded-2xl border border-dashed border-gray-300 space-y-2">
                    <span className="text-3xl">🎬</span>
                    <p className="text-xs font-bold text-gray-600">No products with videos found yet.</p>
                    <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                      Click the &ldquo;Scan &amp; Import Videos&rdquo; button above to import high-converting video drops from CJ.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {videoProducts.map((p) => (
                      <div key={p.id} className="p-3.5 bg-white border border-temu-gray-border-light rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden relative">
                            {p.image_url ? (
                              <img
                                src={p.image_url}
                                alt={p.title}
                                className="w-full h-full object-cover opacity-70"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : null}
                            <span className="absolute inset-0 flex items-center justify-center text-sm">▶</span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-temu-black truncate">{p.title}</p>
                            <p className="text-[11px] text-[#7FA1C4] font-black mt-0.5">${Number(p.price || 0).toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/api/video-proxy?url=${encodeURIComponent(p.video_url || '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                            title="Preview Video"
                          >
                            👁️
                          </a>

                          <button
                            onClick={() => handleDeleteVideo(p.id)}
                            className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Add Product Tab */}
          {activeTab === 'add' && (
            <div>
              <h2 className="text-lg font-black text-temu-black mb-2">Publish New Product</h2>
              <p className="text-xs text-gray-500 mb-6">Create manual items or auto-fill details via external link</p>

              {message && (
                <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.includes('✅') ? 'bg-maroccan-tea-50 border border-maroccan-tea-200 text-maroccan-tea-600' : 'bg-red-50 border border-red-200 text-red-500'}`}>
                  {message}
                </div>
              )}

              <div className="mb-6 p-4 bg-butter-up-50 rounded-xl border border-butter-up-200">
                <label className="block text-xs font-bold text-butter-up-600 uppercase tracking-wider mb-2">🤖 Auto-Scraper (Alibaba / AliExpress / External)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="Paste product page URL here..."
                    className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-butter-up-400 transition"
                  />
                  <button
                    onClick={handleScrape}
                    disabled={scraping}
                    className="bg-butter-up-500 hover:bg-butter-up-600 text-white font-extrabold px-6 py-3 rounded-xl transition disabled:opacity-50 active:scale-95 cursor-pointer"
                  >
                    {scraping ? 'Extracting Data...' : 'Scrape Data'}
                  </button>
                </div>
              </div>

              <div className="mb-6 p-4 bg-temu-offwhite rounded-xl border border-temu-gray-border-light">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Upload Product Images (Cloudinary)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#5B7EA6] file:text-white hover:file:brightness-110 cursor-pointer"
                />
                {imagePreviews.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {imagePreviews.map((img, idx) => (
                      <div key={idx} className="relative w-16 h-16 border border-temu-gray-border-light rounded-xl overflow-hidden bg-white">
                        <img src={img} alt={`preview ${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Title *</label>
                  <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cost / Base Price ($) *</label>
                    <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Strikethrough Price ($)</label>
                    <input type="number" step="0.01" name="original_price" value={formData.original_price} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Main Image URL *</label>
                  <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Gallery Images (Comma Separated)</label>
                  <input type="text" name="images" value={formData.images} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]">
                    {availableCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Colors (Hex / Names)</label>
                    <input type="text" name="colors" value={formData.colors} onChange={handleChange} placeholder="#000, #FFF" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Sizes</label>
                    <input type="text" name="sizes" value={formData.sizes} onChange={handleChange} placeholder="S, M, L, XL" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6] resize-none"></textarea>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold py-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#5B7EA6]/20 active:scale-[0.98]"
                >
                  {loading ? 'Publishing Product...' : 'Publish Product to Storefront'}
                </button>
              </form>
            </div>
          )}

          {/* 4. CJ Sync & Sourcing Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-black text-temu-black mb-1">CJ Automated Synchronization</h2>
                <p className="text-xs text-gray-500 mb-6">Synchronize trending inventory or ingest targeted 1688 items</p>
              </div>

              <div className="p-5 bg-fog-50 rounded-xl border border-[#5B7EA6]/30">
                <label className="block text-xs font-bold text-[#5B7EA6] uppercase tracking-wider mb-1">⚡ Ingest Single Sourced Product (PID) &bull; Auto Lightning Deal</label>
                <p className="text-xs text-gray-500 mb-3">Instantly pull product from CJ using its PID and tag it automatically as an active Lightning Deal.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={singlePid}
                    onChange={(e) => setSinglePid(e.target.value)}
                    placeholder="Enter CJ Product PID (e.g. 172938192)..."
                    className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]"
                  />
                  <button
                    onClick={handleSyncSingle}
                    disabled={syncingSingle}
                    className="bg-[#5B7EA6] hover:bg-[#46648A] text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer"
                  >
                    {syncingSingle ? 'Ingesting...' : 'Ingest & Deploy Deal ⚡'}
                  </button>
                </div>
                {singleMessage && <p className={`mt-2 text-xs font-bold ${singleMessage.includes('✅') ? 'text-maroccan-tea-500' : 'text-red-500'}`}>{singleMessage}</p>}
              </div>

              <div className="p-5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sync Category Batch</label>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <select
                    value={syncCategory}
                    onChange={(e) => setSyncCategory(e.target.value)}
                    className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]"
                  >
                    <option value="">🛍️ Trending / General Selection</option>
                    <option value="clipper">🪒 Shavers & Grooming</option>
                    <option value="smartphone">📱 Mobile Devices</option>
                    <option value="kitchen">🍳 Kitchenware</option>
                    <option value="jewelry">💍 Luxury Jewelry</option>
                    <option value="beauty">💄 Personal Care</option>
                    <option value="tool">🛠️ Hardware Tools</option>
                    <option value="home decor">🏠 Home Accessories</option>
                  </select>
                  <button
                    onClick={handleSyncCJ}
                    disabled={syncing}
                    className="bg-temu-black hover:bg-temu-dark text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer"
                  >
                    {syncing ? 'Triggering...' : 'Run Category Sync'}
                  </button>
                </div>

                <div className="pt-4 border-t border-temu-gray-border-light">
                  <label className="block text-xs font-bold text-[#5B7EA6] uppercase tracking-wider mb-2">🚀 Mass Import Engine (1200 Products)</label>
                  <button
                    onClick={handleMassSync}
                    disabled={massSyncing}
                    className="w-full bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold py-3 rounded-xl transition disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#5B7EA6]/20 cursor-pointer"
                  >
                    {massSyncing ? 'Engine Starting...' : 'Start Mass Import Engine'}
                  </button>
                </div>

                {syncMessage && <p className="mt-3 text-xs font-bold text-gray-500">{syncMessage}</p>}
              </div>

              <div className="p-5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="text-sm font-bold text-temu-black">CJ Categories Tree Architecture</h4>
                  <p className="text-xs text-gray-500">Keep store taxonomy aligned with official CJ product mappings</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncCategories}
                    disabled={syncingCats}
                    className="bg-maroccan-tea-500 hover:bg-maroccan-tea-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {syncingCats ? 'Syncing Tree...' : '1. Rebuild Tree'}
                  </button>
                  <button
                    onClick={handleBackfillCategories}
                    disabled={backfillingCats}
                    className="bg-temu-black hover:bg-temu-dark text-white font-bold px-4 py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {backfillingCats ? 'Updating Products...' : '2. Backfill Catalog'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. 1688 Sourcing Tab */}
          {activeTab === 'sourcing' && (
            <div>
              <h2 className="text-lg font-black text-temu-black mb-1">Direct 1688 Sourcing Submission</h2>
              <p className="text-xs text-gray-500 mb-6">Request CJ Sourcing Agents to procure and verify a winning 1688 item</p>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                try {
                  await adminApi.post('/admin/sourcing/create', payload);
                  alert('✅ Sourcing request sent to CJ team successfully!');
                  form.reset();
                } catch (err: any) {
                  alert(`❌ Sourcing Submission Failed: ${err.response?.data?.error || 'Server error.'}`);
                }
              }} className="space-y-4 bg-temu-offwhite p-6 rounded-xl border border-temu-gray-border-light">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Target Product Title *</label>
                  <input type="text" name="productName" required placeholder="e.g. Wireless Ergonomic Razor" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">High-Res Product Image URL *</label>
                  <input type="url" name="productImage" required placeholder="https://..." className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">1688 Reference Product URL</label>
                  <input type="url" name="productUrl" placeholder="https://detail.1688.com/..." className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Target Purchase Price ($ USD)</label>
                  <input type="number" step="0.01" name="price" placeholder="12.50" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                </div>
                <button type="submit" className="w-full bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition active:scale-95 shadow-lg shadow-[#5B7EA6]/20 cursor-pointer">
                  Transmit Sourcing Request to CJ Dropshipping
                </button>
              </form>
            </div>
          )}

          {/* 6. Coupons Tab */}
          {activeTab === 'coupons' && (
            <div>
              <h2 className="text-lg font-black text-temu-black mb-1">Create Promotional Coupon</h2>
              <p className="text-xs text-gray-500 mb-6">Deploy discount codes verified automatically in Stripe Checkout and cart</p>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                try {
                  await adminApi.post('/admin/add-coupon', {
                    ...payload,
                    discount_value: Number(payload.discount_value)
                  });
                  alert('✅ Coupon activated successfully in store system!');
                  form.reset();
                } catch (err: any) {
                  alert(`❌ Error: ${err.response?.data?.error || 'Failed to create coupon.'}`);
                }
              }} className="space-y-4 bg-temu-offwhite p-6 rounded-xl border border-temu-gray-border-light max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Coupon Code *</label>
                  <input type="text" name="code" required placeholder="e.g. VIP20OFF" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6] uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Discount Type</label>
                    <select name="discount_type" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Cash ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Value *</label>
                    <input type="number" step="0.01" name="discount_value" required placeholder="20" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#5B7EA6]" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-linear-to-r from-[#7FA1C4] to-coral-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition active:scale-95 shadow-lg shadow-[#7FA1C4]/20 cursor-pointer">
                  Deploy Discount Code
                </button>
              </form>
            </div>
          )}

          {/* 📋 7. System Events — Audit Trail (Mission #9) */}
          {activeTab === 'events' && (
            <SystemEventsPanel />
          )}

        </div>
      </div>
    </main>
  );
}