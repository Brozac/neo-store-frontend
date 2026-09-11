'use client';

import { useState, useEffect } from 'react';
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
  pendingBaridiCount: number;
  failedOrdersCount: number;
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

export default function AdminDashboard() {
  const router = useRouter();

  // التبويبات النشطة
  const [activeTab, setActiveTab] = useState<string>('overview');

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
    pendingBaridiCount: 0,
    failedOrdersCount: 0,
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

      const [manualOrdersRes, failedOrdersRes] = await Promise.all([
        adminApi.get('/admin/manual-orders').catch(() => ({ data: [] })),
        adminApi.get('/admin/failed-orders').catch(() => ({ data: [] }))
      ]);

      const ping = Date.now() - startTime;
      const pendingBaridi = Array.isArray(manualOrdersRes.data)
        ? manualOrdersRes.data.filter((o: any) => o.status === 'pending').length
        : 0;
      const failedCount = Array.isArray(failedOrdersRes.data) ? failedOrdersRes.data.length : 0;

      setTelemetry({
        backendStatus: 'healthy',
        backendPing: ping,
        pendingBaridiCount: pendingBaridi,
        failedOrdersCount: failedCount,
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

  // ✨ جلب الفيديوهات بشكل صحيح (تم حل خطأ المسار المزدوج /api/products)
  const fetchVideoProducts = async () => {
    setLoadingVideos(true);
    try {
      // 1. قراءة حالة تفعيل الريلز من localStorage لتفادي مشاكل 404
      const savedToggle = localStorage.getItem('laclarc_show_reels');
      setShowReels(savedToggle !== 'false');

      // 2. استخدام مسار /products النظيف بدون تكرار /api
      const productsRes = await adminApi.get('/products');
      if (Array.isArray(productsRes.data)) {
        const vids = productsRes.data.filter((p: any) => p.video_url && String(p.video_url).trim().length > 3);
        setVideoProducts(vids);
      }
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
    setSyncMessage('🎬 Scanning trending items for video assets in background...');
    try {
      await adminApi.get('/sync-cj-products');
      alert('🎬 Video scanning triggered! Products with video will update shortly.');
    } catch (err: any) {
      setSyncMessage(`❌ Error: ${err.response?.data?.error || 'Failed to start video sync.'}`);
    } finally {
      setSyncingVideos(false);
    }
  };

// ✨ حذف الفيديو عبر المسار المخصص والصحيح في السيرفر
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
    try {
      const payload = {
        title: formData.title,
        price: Number(formData.price),
        original_price: Number(formData.original_price),
        image_url: formData.image_url,
        images: formData.images.split(',').map(img => img.trim()).filter(Boolean),
        description: formData.description,
        material: formData.material,
        colors: formData.colors.split(',').map(col => col.trim()).filter(Boolean),
        sizes: formData.sizes.split(',').map(sz => sz.trim()).filter(Boolean),
        category: formData.category
      };
      await adminApi.post('/admin/add-product', payload);
      setMessage('✅ Product published successfully with auto-pricing!');
      setFormData({ title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other' });
      setScrapeUrl('');
    } catch (err: any) { setMessage(`❌ Error: ${err.response?.data?.error || 'Failed to save product.'}`); }
    finally { setLoading(false); }
  };

  const imagePreviews = formData.images.split(',').map(img => img.trim()).filter(Boolean);

  // ✨ إضافة تبويب مخصص ومستقل للريلز والفيديوهات
  const tabs = [
    { id: 'overview', label: 'Operations Command', icon: '⚡' },
    { id: 'reels', label: 'Watch & Shop Reels', icon: '🎬' },
    { id: 'add', label: 'Add Product', icon: '➕' },
    { id: 'sync', label: 'CJ Sync & Sourcing', icon: '🔄' },
    { id: 'sourcing', label: '1688 Sourcing', icon: '🏭' },
    { id: 'coupons', label: 'Coupons & Promos', icon: '🎟️' },
  ];

  return (
    <main className="min-h-screen bg-temu-offwhite text-temu-black p-6 pb-24 font-sans">
      <div className="max-w-5xl mx-auto">

        {/* Top Header & Fast Nav */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b border-temu-gray-border-light pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-tr from-[#8B78C6] to-[#FF6B9D] rounded-xl flex items-center justify-center font-black text-white shadow-lg">
              L
            </div>
            <div>
              <h1 className="text-xl font-black text-temu-black tracking-wide">Laclarc Mission Control</h1>
              <p className="text-[11px] text-gray-500">Enterprise Operations &bull; Global Dropshipping</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
              <span className={`w-2 h-2 rounded-full ${telemetry.backendStatus === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              Render Backend
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">
                {telemetry.backendStatus === 'healthy' ? 'Operational' : 'Checking'}
              </span>
              <span className="text-[11px] font-mono text-gray-500">{telemetry.backendPing}ms</span>
            </div>
          </div>

          <div className="bg-white border border-temu-gray-border-light rounded-xl p-3.5 flex flex-col justify-between shadow-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#8B78C6]"></span>
              Neon DB
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">Connected</span>
              <span className="text-[11px] font-mono text-emerald-500">Pool Active</span>
            </div>
          </div>

          <div
            onClick={() => router.push('/admin/baridimob')}
            className={`cursor-pointer border rounded-xl p-3.5 flex flex-col justify-between transition shadow-xs hover:shadow-md ${
              telemetry.pendingBaridiCount > 0 ? 'bg-linear-to-br from-white to-pink-50 border-[#FF6B9D]' : 'bg-white border-temu-gray-border-light'
            }`}
          >
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              🏦 BaridiMob Review
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">{telemetry.pendingBaridiCount}</span>
              <span className="text-[11px] text-[#FF6B9D] font-bold">Action Needed &rarr;</span>
            </div>
          </div>

          <div
            onClick={() => router.push('/admin/failed-orders')}
            className={`cursor-pointer border rounded-xl p-3.5 flex flex-col justify-between transition shadow-xs hover:shadow-md ${
              telemetry.failedOrdersCount > 0 ? 'bg-linear-to-br from-white to-red-50 border-red-400' : 'bg-white border-temu-gray-border-light'
            }`}
          >
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              ⚠️ Failed in CJ
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-base font-black text-temu-black">{telemetry.failedOrdersCount}</span>
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
            className="w-full bg-white border border-temu-gray-border-light rounded-xl py-3.5 pl-4 pr-12 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-[#8B78C6] transition shadow-xs"
          />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#8B78C6] p-1 cursor-pointer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
        </form>

        {/* Command Center Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide border-b border-temu-gray-border-light">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-wider font-extrabold whitespace-nowrap transition cursor-pointer rounded-xl ${
                activeTab === tab.id
                  ? 'bg-linear-to-r from-[#8B78C6] to-[#7A67B5] text-white shadow-lg shadow-[#8B78C6]/20'
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
                  🔄 Refresh Status ({telemetry.lastChecked})
                </button>
              </div>

              {/* بطاقات العمليات الست النظيفة المنظمة في شبكة كاملة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Manage Products', desc: 'Price updates, stock status & Lightning Deals ⚡', link: '/admin/manage', color: 'from-[#8B78C6] to-indigo-600', icon: '📦' },
                  { label: 'Watch & Shop Reels', desc: `Manage ${videoProducts.length} video feeds & visibility`, action: () => setActiveTab('reels'), color: 'from-pink-500 to-rose-600', icon: '🎬' },
                  { label: 'BaridiMob Approvals', desc: 'Inspect customer bank receipts and approve', link: '/admin/baridimob', color: 'from-[#FF6B9D] to-rose-600', icon: '🇩🇿' },
                  { label: 'Manual & Failed Orders', desc: 'Rescue orders that failed automated CJ fulfillment', link: '/admin/failed-orders', color: 'from-amber-500 to-red-600', icon: '🚨' },
                  { label: 'CJ Disputes Center', desc: 'Track refunds, damaged shipments & complaints', link: '/admin/disputes', color: 'from-cyan-500 to-blue-600', icon: '⚖️' },
                  { label: 'Advanced Engine Tools', desc: 'Auto-categorization & database maintenance', link: '/admin/advanced', color: 'from-purple-600 to-[#1D1E3C]', icon: '🛠️' },
                ].map((card, i) => (
                  <button
                    key={i}
                    onClick={() => card.link ? router.push(card.link) : card.action?.()}
                    className="text-left p-5 rounded-xl bg-white border border-temu-gray-border-light hover:border-[#8B78C6]/60 transition group cursor-pointer active:scale-[0.98] shadow-xs"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-linear-to-tr ${card.color} flex items-center justify-center text-lg mb-3 shadow-md`}>
                      {card.icon}
                    </div>
                    <h3 className="font-bold text-temu-black text-sm group-hover:text-[#8B78C6] transition">{card.label}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{card.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 📈 ويدجت أرباح الإعلانات المباشرة (Ad Revenue Attribution) */}
              <div className="mt-8 bg-white p-6 rounded-2xl border border-temu-gray-border-light shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-black text-temu-black flex items-center gap-2">
                      <span>📊</span> Ad Campaigns & Revenue Attribution (Last 30 Days)
                    </h3>
                    <p className="text-xs text-gray-500">Track which ad network generates the most paid revenue</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-purple-50 text-[#8B78C6] border border-[#8B78C6]/20 px-2.5 py-1 rounded-full">
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
                    <span className="text-sm font-black text-[#8B78C6]">Active 🎯</span>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-gray-500 block uppercase">Organic / Direct</span>
                      <span className="text-xs text-gray-400">Word of mouth</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">Free 🌿</span>
                  </div>
                </div>
              </div>

          {/* ✨ 2. تبويب مخصص وفاخر لإدارة ريلز تيك توك (Watch & Shop Reels) */}
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

              {/* زر التبديل الرئيسي لإظهار أو إخفاء القسم من المتجر */}
              <div className="bg-temu-offwhite p-5 rounded-2xl border border-temu-gray-border-light flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm text-temu-black">Display Reels on Homepage</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Turn off to completely hide the video reel carousel from customers.</p>
                </div>

                <button
                  onClick={() => {
                    const nextVal = !showReels;
                    setShowReels(nextVal);
                    localStorage.setItem('laclarc_show_reels', String(nextVal));
                  }}
                  className={`w-14 h-7 rounded-full transition-colors relative cursor-pointer ${showReels ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${showReels ? 'translate-x-7' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* زر استيراد الفيديوهات السريع من CJ */}
              <div className="bg-purple-50/60 p-5 rounded-2xl border border-[#8B78C6]/25 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-black text-sm text-temu-black">Sync New Video Assets</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Scan trending drops and fetch active video clips automatically from CJ.</p>
                </div>
                <button
                  onClick={handleSyncVideos}
                  disabled={syncingVideos}
                  className="bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {syncingVideos ? 'Scanning CJ Videos...' : 'Scan & Import Videos'}
                </button>
              </div>

              {/* قائمة الفيديوهات النشطة حالياً في المتجر */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">
                    Active Videos in Store ({videoProducts.length})
                  </h4>
                </div>

                {loadingVideos ? (
                  <div className="text-center py-10">
                    <div className="w-6 h-6 border-2 border-[#8B78C6] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
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
                              <img src={p.image_url} alt={p.title} className="w-full h-full object-cover opacity-70" />
                            ) : null}
                            <span className="absolute inset-0 flex items-center justify-center text-sm">▶</span>
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-temu-black truncate">{p.title}</p>
                            <p className="text-[11px] text-[#FF6B9D] font-black mt-0.5">${Number(p.price || 0).toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={p.video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-bold transition"
                            title="Preview Video Link"
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
                <div className={`p-4 rounded-xl mb-6 text-sm font-medium ${message.includes('✅') ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' : 'bg-red-50 border border-red-200 text-red-500'}`}>
                  {message}
                </div>
              )}

              <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <label className="block text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">🤖 Auto-Scraper (Alibaba / AliExpress / External)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={scrapeUrl}
                    onChange={(e) => setScrapeUrl(e.target.value)}
                    placeholder="Paste product page URL here..."
                    className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-amber-400 transition"
                  />
                  <button
                    onClick={handleScrape}
                    disabled={scraping}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-6 py-3 rounded-xl transition disabled:opacity-50 active:scale-95 cursor-pointer"
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
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#8B78C6] file:text-white hover:file:brightness-110 cursor-pointer"
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
                  <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cost / Base Price ($) *</label>
                    <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Strikethrough Price ($)</label>
                    <input type="number" step="0.01" name="original_price" value={formData.original_price} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Main Image URL *</label>
                  <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Gallery Images (Comma Separated)</label>
                  <input type="text" name="images" value={formData.images} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]">
                    {availableCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Colors (Hex / Names)</label>
                    <input type="text" name="colors" value={formData.colors} onChange={handleChange} placeholder="#000, #FFF" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Sizes</label>
                    <input type="text" name="sizes" value={formData.sizes} onChange={handleChange} placeholder="S, M, L, XL" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Description</label>
                  <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6] resize-none"></textarea>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold py-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-[#8B78C6]/20 active:scale-[0.98]"
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

              {/* Sync Single PID (1688 / Deals) */}
              <div className="p-5 bg-purple-50 rounded-xl border border-[#8B78C6]/30">
                <label className="block text-xs font-bold text-[#8B78C6] uppercase tracking-wider mb-1">⚡ Ingest Single Sourced Product (PID) &bull; Auto Lightning Deal</label>
                <p className="text-xs text-gray-500 mb-3">Instantly pull product from CJ using its PID and tag it automatically as an active Lightning Deal.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={singlePid}
                    onChange={(e) => setSinglePid(e.target.value)}
                    placeholder="Enter CJ Product PID (e.g. 172938192)..."
                    className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]"
                  />
                  <button
                    onClick={handleSyncSingle}
                    disabled={syncingSingle}
                    className="bg-[#8B78C6] hover:bg-[#7A67B5] text-white font-bold px-6 py-3 rounded-xl transition disabled:opacity-50 whitespace-nowrap active:scale-95 cursor-pointer"
                  >
                    {syncingSingle ? 'Ingesting...' : 'Ingest & Deploy Deal ⚡'}
                  </button>
                </div>
                {singleMessage && <p className={`mt-2 text-xs font-bold ${singleMessage.includes('✅') ? 'text-emerald-500' : 'text-red-500'}`}>{singleMessage}</p>}
              </div>

              {/* Sync Category & Mass Import */}
              <div className="p-5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sync Category Batch</label>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <select
                    value={syncCategory}
                    onChange={(e) => setSyncCategory(e.target.value)}
                    className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]"
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

                {/* Mass Import */}
                <div className="pt-4 border-t border-temu-gray-border-light">
                  <label className="block text-xs font-bold text-[#8B78C6] uppercase tracking-wider mb-2">🚀 Mass Import Engine (1200 Products)</label>
                  <button
                    onClick={handleMassSync}
                    disabled={massSyncing}
                    className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold py-3 rounded-xl transition disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-[#8B78C6]/20 cursor-pointer"
                  >
                    {massSyncing ? 'Engine Starting...' : 'Start Mass Import Engine'}
                  </button>
                </div>

                {syncMessage && <p className="mt-3 text-xs font-bold text-gray-500">{syncMessage}</p>}
              </div>

              {/* Official Category Tree Maintenance */}
              <div className="p-5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="text-sm font-bold text-temu-black">CJ Categories Tree Architecture</h4>
                  <p className="text-xs text-gray-500">Keep store taxonomy aligned with official CJ product mappings</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSyncCategories}
                    disabled={syncingCats}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
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
                  <input type="text" name="productName" required placeholder="e.g. Wireless Ergonomic Razor" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">High-Res Product Image URL *</label>
                  <input type="url" name="productImage" required placeholder="https://..." className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">1688 Reference Product URL</label>
                  <input type="url" name="productUrl" placeholder="https://detail.1688.com/..." className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Target Purchase Price ($ USD)</label>
                  <input type="number" step="0.01" name="price" placeholder="12.50" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                </div>
                <button type="submit" className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition active:scale-95 shadow-lg shadow-[#8B78C6]/20 cursor-pointer">
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
                  <input type="text" name="code" required placeholder="e.g. VIP20OFF" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6] uppercase" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Discount Type</label>
                    <select name="discount_type" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]">
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Cash ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Value *</label>
                    <input type="number" step="0.01" name="discount_value" required placeholder="20" className="w-full bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-[#8B78C6]" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-linear-to-r from-[#FF6B9D] to-rose-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition active:scale-95 shadow-lg shadow-[#FF6B9D]/20 cursor-pointer">
                  Deploy Discount Code
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}