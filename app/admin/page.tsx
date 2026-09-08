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

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [syncCategory, setSyncCategory] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncingVideos, setSyncingVideos] = useState(false);
  
  // ✨ حالات الريلز
  const [showReels, setShowReels] = useState(true);
  const [videoProducts, setVideoProducts] = useState<any[]>([]);

  const [adminSearch, setAdminSearch] = useState('');
  const [availableCategories, setAvailableCategories] = useState<{ value: string; label: string }[]>([]);
  const [syncingCats, setSyncingCats] = useState(false);
  const [backfillingCats, setBackfillingCats] = useState(false);

  const [singlePid, setSinglePid] = useState('');
  const [syncingSingle, setSyncingSingle] = useState(false);
  const [singleMessage, setSingleMessage] = useState('');
  const [massSyncing, setMassSyncing] = useState(false);

  const [telemetry, setTelemetry] = useState<TelemetryState>({
    backendStatus: 'checking', backendPing: 0, pendingBaridiCount: 0, failedOrdersCount: 0, lastChecked: '--',
  });

  const [formData, setFormData] = useState({
    title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other'
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
      const pendingBaridi = Array.isArray(manualOrdersRes.data) ? manualOrdersRes.data.filter((o: any) => o.status === 'pending').length : 0;
      const failedCount = Array.isArray(failedOrdersRes.data) ? failedOrdersRes.data.length : 0;
      setTelemetry({ backendStatus: 'healthy', backendPing: ping, pendingBaridiCount: pendingBaridi, failedOrdersCount: failedCount, lastChecked: new Date().toLocaleTimeString() });
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) { router.push('/admin/login'); return; }
      setTelemetry(prev => ({ ...prev, backendStatus: 'offline', lastChecked: new Date().toLocaleTimeString() }));
    }
  };

  // ✨ دالة جلب بيانات الريلز
  const fetchVideoProducts = async () => {
    try {
      const settingsRes = await adminApi.get('/api/settings');
      const settingsData: any = settingsRes.data || {};
      setShowReels(settingsData.show_reels !== false);
      
      const productsRes = await adminApi.get('/api/products');
      const vids = productsRes.data.filter((p: any) => p.video_url && p.video_url.trim() !== '');
      setVideoProducts(vids);
    } catch (err) {
      console.error('Error fetching reels data:', err);
    }
  };

  useEffect(() => {
    runDiagnostics();
    fetchVideoProducts();
    adminApi.get('/categories')
      .then(res => setAvailableCategories(flattenCategories(res.data)))
      .catch((err) => { if (err.response?.status === 401 || err.response?.status === 403) router.push('/admin/login'); });
  }, [router]);

  const handleAdminSearch = (e: React.FormEvent) => { e.preventDefault(); if (adminSearch.trim()) router.push(`/admin/manage?search=${encodeURIComponent(adminSearch.trim())}`); };
  const handleLogout = async () => { try { await adminApi.post('/admin/logout'); } finally { router.push('/admin/login'); } };
  const handleSyncCategories = async () => { setSyncingCats(true); try { const res = await adminApi.post('/admin/sync-categories'); alert(`✅ ${res.data.message}`); } catch (err: any) { alert(`❌ Error: ${err.response?.data?.error || 'Network Error'}`); } finally { setSyncingCats(false); } };
  const handleBackfillCategories = async () => { if (!confirm('Update categories for all products?')) return; setBackfillingCats(true); try { const res = await adminApi.post('/admin/backfill-categories'); alert(`✅ ${res.data.message}`); } catch (err: any) { alert(`❌ Error`); } finally { setBackfillingCats(false); } };
  const handleSyncCJ = async () => { setSyncing(true); setSyncMessage('⏳ Sync started...'); try { const url = syncCategory ? `/sync-cj-products?keyword=${encodeURIComponent(syncCategory)}` : '/sync-cj-products'; const res = await adminApi.get(url); setSyncMessage(`✅ ${res.data.message}`); } catch (err: any) { setSyncMessage(`❌ Error`); } finally { setSyncing(false); } };
  const handleSyncSingle = async () => { if (!singlePid.trim()) return; setSyncingSingle(true); setSingleMessage('⏳ Sourcing...'); try { const res = await adminApi.post('/admin/sync-single-product', { pid: singlePid.trim() }); setSingleMessage(`✅ ${res.data.message}`); setSinglePid(''); } catch (err: any) { setSingleMessage(`❌ Error`); } finally { setSyncingSingle(false); } };
  const handleMassSync = async () => { if (!confirm('Fetch 1200 products?')) return; setMassSyncing(true); setSyncMessage('🚀 Mass Sync started...'); try { await adminApi.post('/admin/mass-sync'); } catch (err: any) { setSyncMessage(`❌ Error`); } finally { setTimeout(() => setMassSyncing(false), 3000); } };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => { const files = e.target.files; if (!files || files.length === 0) return; setUploading(true); setMessage('📤 Uploading...'); const uploadData = new FormData(); for (let i = 0; i < files.length; i++) uploadData.append('images', files[i]); try { const res = await adminApi.post('/admin/upload', uploadData); const urls = res.data.urls; setFormData(prev => ({ ...prev, image_url: prev.image_url || urls[0], images: prev.images ? `${prev.images}, ${urls.join(', ')}` : urls.join(', ') })); setMessage('✅ Uploaded!'); } catch (err: any) { setMessage(`❌ Error`); } finally { setUploading(false); e.target.value = ''; } };
  const handleScrape = async () => { if (!scrapeUrl.trim()) return; setScraping(true); setMessage(''); try { const res = await adminApi.post('/admin/scrape-product', { url: scrapeUrl.trim() }); const data = res.data; setFormData(prev => ({ ...prev, title: data.title || '', price: data.price || '', image_url: data.images?.[0] || data.image_url || '', images: Array.isArray(data.images) ? data.images.join(', ') : '', description: data.description || '' })); setMessage('✅ Scraped!'); } catch (err: any) { setMessage(`❌ Error`); } finally { setScraping(false); } };
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setMessage(''); try { const payload = { title: formData.title, price: Number(formData.price), original_price: Number(formData.original_price), image_url: formData.image_url, images: formData.images.split(',').map(img => img.trim()).filter(Boolean), description: formData.description, material: formData.material, colors: formData.colors.split(',').map(col => col.trim()).filter(Boolean), sizes: formData.sizes.split(',').map(sz => sz.trim()).filter(Boolean), category: formData.category }; await adminApi.post('/admin/add-product', payload); setMessage('✅ Product published!'); setFormData({ title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other' }); setScrapeUrl(''); } catch (err: any) { setMessage(`❌ Error`); } finally { setLoading(false); } };
  const handleSyncVideos = async () => { if (!confirm('Scan CJ for video products?')) return; setSyncingVideos(true); setSyncMessage('🎬 Scanning CJ for videos...'); try { await adminApi.post('/admin/sync-videos'); } catch (err: any) { setSyncMessage(`❌ Error`); } finally { setTimeout(() => setSyncingVideos(false), 3000); } };

  const imagePreviews = formData.images.split(',').map(img => img.trim()).filter(Boolean);

  const tabs = [
    { id: 'overview', label: 'Operations Command', icon: '⚡' },
    { id: 'add', label: 'Add Product', icon: '➕' },
    { id: 'sync', label: 'CJ Sync & Sourcing', icon: '🔄' },
    { id: 'sourcing', label: '1688 Sourcing', icon: '🏭' },
    { id: 'coupons', label: 'Coupons & Promos', icon: '🎟️' },
  ];

  return (
    <main className="min-h-screen bg-temu-offwhite text-temu-black p-6 pb-24 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b border-temu-gray-border-light pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-linear-to-tr from-[#8B78C6] to-[#FF6B9D] rounded-xl flex items-center justify-center font-black text-white shadow-lg">L</div>
            <div>
              <h1 className="text-xl font-black text-temu-black tracking-wide">Laclarc Mission Control</h1>
              <p className="text-[11px] text-gray-500">Enterprise Operations &bull; Global Dropshipping</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="px-3.5 py-2 bg-white hover:bg-temu-offwhite border border-temu-gray-border-light rounded-xl text-xs font-bold text-temu-black transition">🌐 Storefront</button>
            <button onClick={handleLogout} className="px-3.5 py-2 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold text-red-500 transition">🔒 Logout</button>
          </div>
        </div>

        {/* Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
           <div className="bg-white border border-temu-gray-border-light rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
             <span className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${telemetry.backendStatus === 'healthy' ? 'bg-emerald-500' : 'bg-red-500'}`}></span>Render Backend</span>
             <div className="mt-2 flex justify-between"><span className="text-base font-black">{telemetry.backendStatus === 'healthy' ? 'Operational' : 'Checking'}</span><span className="text-[11px] font-mono text-gray-500">{telemetry.backendPing}ms</span></div>
           </div>
           <div className="bg-white border border-temu-gray-border-light rounded-xl p-3.5 flex flex-col justify-between shadow-sm">
             <span className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#8B78C6]"></span>Neon DB</span>
             <div className="mt-2 flex justify-between"><span className="text-base font-black">Connected</span><span className="text-[11px] font-mono text-emerald-500">Pool Active</span></div>
           </div>
           <div onClick={() => router.push('/admin/baridimob')} className={`cursor-pointer border rounded-xl p-3.5 flex flex-col justify-between shadow-sm ${telemetry.pendingBaridiCount > 0 ? 'bg-linear-to-br from-white to-pink-50 border-[#FF6B9D]' : 'bg-white border-temu-gray-border-light'}`}>
             <span className="text-[11px] font-bold text-gray-500 uppercase">🏦 BaridiMob Review</span>
             <div className="mt-2 flex justify-between"><span className="text-base font-black">{telemetry.pendingBaridiCount}</span><span className="text-[11px] text-[#FF6B9D] font-bold">Action Needed &rarr;</span></div>
           </div>
           <div onClick={() => router.push('/admin/failed-orders')} className={`cursor-pointer border rounded-xl p-3.5 flex flex-col justify-between shadow-sm ${telemetry.failedOrdersCount > 0 ? 'bg-linear-to-br from-white to-red-50 border-red-400' : 'bg-white border-temu-gray-border-light'}`}>
             <span className="text-[11px] font-bold text-gray-500 uppercase">⚠️ Failed in CJ</span>
             <div className="mt-2 flex justify-between"><span className="text-base font-black">{telemetry.failedOrdersCount}</span><span className="text-[11px] text-red-500 font-bold">Resolve Queue &rarr;</span></div>
           </div>
        </div>

        {/* Search */}
        <form onSubmit={handleAdminSearch} className="relative mb-6">
          <input type="text" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="🔍 Search inventory..." className="w-full bg-white border border-temu-gray-border-light rounded-xl py-3.5 pl-4 pr-12 text-sm focus:outline-none focus:border-[#8B78C6] shadow-sm" />
          <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>
        </form>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-hide border-b border-temu-gray-border-light">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-5 py-2.5 text-xs uppercase font-extrabold whitespace-nowrap cursor-pointer rounded-xl ${activeTab === tab.id ? 'bg-linear-to-r from-[#8B78C6] to-[#7A67B5] text-white shadow-lg' : 'bg-white text-gray-500 border border-temu-gray-border-light hover:bg-temu-offwhite'}`}><span>{tab.icon}</span> {tab.label}</button>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-sm">

          {/* 1. Overview */}
          {activeTab === 'overview' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div><h2 className="text-lg font-black text-temu-black">Operations Center</h2><p className="text-xs text-gray-500">Direct modules to manage inventory, payments, and disputes</p></div>
                <button onClick={runDiagnostics} className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-3 py-1.5 rounded-lg border border-temu-gray-border-light">🔄 Refresh</button>
              </div>

              {/* Reels Management */}
              <div className="mt-8 pt-8 border-t border-temu-gray-border-light">
                <h3 className="text-lg font-black text-temu-black mb-4">Watch & Shop Reels Management</h3>
                <div className="bg-temu-offwhite p-4 rounded-xl border border-temu-gray-border-light mb-4">
                  <div className="flex items-center justify-between">
                    <div><p className="font-bold text-sm text-temu-black">Show Reels Section</p><p className="text-xs text-gray-500">Toggle to show/hide on storefront.</p></div>
                    <button onClick={async () => { const v = !showReels; setShowReels(v); await adminApi.put('/api/admin/settings/show_reels', { value: v }); }} className={`w-12 h-6 rounded-full transition relative cursor-pointer ${showReels ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showReels ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-bold">Current Videos in Store:</p>
                  {videoProducts.length === 0 ? (
                    <div className="text-center py-6 bg-temu-offwhite rounded-xl border border-dashed border-gray-300"><p className="text-xs text-gray-400">No videos found. Go to "CJ Sync" tab to import.</p></div>
                  ) : (
                    videoProducts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                        <span className="text-xs font-bold text-temu-black truncate flex-1">🎬 {p.title}</span>
                        <button onClick={async () => { if (!confirm('Delete this video?')) return; await adminApi.delete(`/api/admin/videos/${p.id}`); fetchVideoProducts(); }} className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold ml-3">Delete</button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8">
                {[{label:'Manage Products',link:'/admin/manage',icon:'📦',color:'from-[#8B78C6] to-indigo-600'},{label:'BaridiMob Approvals',link:'/admin/baridimob',icon:'🇩🇿',color:'from-[#FF6B9D] to-rose-600'},{label:'Manual & Failed Orders',link:'/admin/failed-orders',icon:'🚨',color:'from-amber-500 to-red-600'},{label:'CJ Disputes',link:'/admin/disputes',icon:'⚖️',color:'from-cyan-500 to-blue-600'},{label:'Payment Gateways',link:'/admin/payment-settings',icon:'💳',color:'from-emerald-500 to-teal-600'},{label:'Advanced Tools',link:'/admin/advanced',icon:'🛠️',color:'from-purple-600 to-[#1D1E3C]'}].map((c) => (
                  <button key={c.label} onClick={() => router.push(c.link)} className="text-left p-5 rounded-xl bg-white border border-temu-gray-border-light hover:border-[#8B78C6]/60 transition group shadow-sm">
                    <div className={`w-10 h-10 rounded-xl bg-linear-to-tr ${c.color} flex items-center justify-center text-lg mb-3 shadow-md`}>{c.icon}</div>
                    <h3 className="font-bold text-temu-black text-sm group-hover:text-[#8B78C6]">{c.label}</h3>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Add Product */}
          {activeTab === 'add' && (
            <div>
              <h2 className="text-lg font-black text-temu-black mb-2">Publish New Product</h2>
              <p className="text-xs text-gray-500 mb-6">Create manual items or auto-fill details via external link</p>
              {message && <div className={`p-4 rounded-xl mb-6 text-sm ${message.includes('✅') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>{message}</div>}
              <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
                <label className="block text-xs font-bold text-amber-600 mb-2 uppercase">🤖 Auto-Scraper</label>
                <div className="flex gap-2"><input type="url" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="Paste URL..." className="flex-1 bg-white border border-temu-gray-border-light rounded-xl px-4 py-3 text-sm" /><button onClick={handleScrape} disabled={scraping} className="bg-amber-500 text-white font-extrabold px-6 py-3 rounded-xl disabled:opacity-50">{scraping ? '...' : 'Scrape'}</button></div>
              </div>
              <div className="mb-6 p-4 bg-temu-offwhite rounded-xl border border-temu-gray-border-light">
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Upload Images</label>
                <input type="file" accept="image/*" multiple onChange={handleFileUpload} disabled={uploading} className="block w-full text-xs file:bg-[#8B78C6] file:text-white file:border-0 file:px-4 file:py-2.5 file:rounded-xl" />
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="text" name="title" value={formData.title} onChange={handleChange} placeholder="Title *" required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-3" />
                <div className="grid grid-cols-2 gap-4"><input type="number" name="price" value={formData.price} onChange={handleChange} placeholder="Price *" required className="w-full bg-temu-offwhite border rounded-xl px-4 py-3" /><input type="number" name="original_price" value={formData.original_price} onChange={handleChange} placeholder="Old Price" className="w-full bg-temu-offwhite border rounded-xl px-4 py-3" /></div>
                <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} placeholder="Main Image URL *" required className="w-full bg-temu-offwhite border rounded-xl px-4 py-3" />
                <input type="text" name="images" value={formData.images} onChange={handleChange} placeholder="Gallery Images" className="w-full bg-temu-offwhite border rounded-xl px-4 py-3" />
                <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-temu-offwhite border rounded-xl px-4 py-3">{availableCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
                <textarea name="description" value={formData.description} onChange={handleChange} rows={4} placeholder="Description" className="w-full bg-temu-offwhite border rounded-xl px-4 py-3 resize-none"></textarea>
                <button type="submit" disabled={loading} className="w-full bg-linear-to-r from-[#8B78C6] to-[#7B68B6] text-white font-extrabold py-4 rounded-xl disabled:opacity-50">{loading ? 'Publishing...' : 'Publish'}</button>
              </form>
            </div>
          )}

          {/* 3. Sync */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              <div><h2 className="text-lg font-black text-temu-black mb-1">CJ Sync & Sourcing</h2><p className="text-xs text-gray-500">Synchronize inventory or ingest 1688 items</p></div>
              
              <div className="p-5 bg-purple-50 rounded-xl border border-[#8B78C6]/30">
                <label className="block text-xs font-bold text-[#8B78C6] uppercase mb-1">⚡ Ingest Single PID</label>
                <div className="flex gap-2"><input type="text" value={singlePid} onChange={(e) => setSinglePid(e.target.value)} placeholder="Enter PID..." className="flex-1 bg-white border rounded-xl px-4 py-3" /><button onClick={handleSyncSingle} disabled={syncingSingle} className="bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50">Sync ⚡</button></div>
              </div>

              <div className="p-5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sync Category Batch</label>
                <div className="flex gap-2 mb-4"><select value={syncCategory} onChange={(e) => setSyncCategory(e.target.value)} className="flex-1 bg-white border rounded-xl px-4 py-3"><option value="">Trending</option><option value="clipper">Shavers</option></select><button onClick={handleSyncCJ} disabled={syncing} className="bg-temu-black text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50">Sync</button></div>
                <div className="pt-4 border-t"><label className="block text-xs font-bold text-[#8B78C6] uppercase mb-2">🚀 Mass Import</label><button onClick={handleMassSync} disabled={massSyncing} className="w-full bg-linear-to-r from-[#8B78C6] to-[#7A67B5] text-white font-extrabold py-3 rounded-xl disabled:opacity-50">{massSyncing ? 'Starting...' : 'Start Mass Engine'}</button></div>
                <div className="pt-4 mt-4 border-t"><label className="block text-xs font-bold text-[#FF6B9D] uppercase mb-2">🎬 Video Products</label><button onClick={handleSyncVideos} disabled={syncingVideos} className="w-full bg-linear-to-r from-[#FF6B9D] to-rose-600 text-white font-extrabold py-3 rounded-xl disabled:opacity-50">{syncingVideos ? 'Scanning...' : 'Scan & Import Videos'}</button></div>
                {syncMessage && <p className="mt-3 text-xs font-bold text-gray-500">{syncMessage}</p>}
              </div>

              <div className="p-5 bg-temu-offwhite rounded-xl border border-temu-gray-border-light flex justify-between items-center">
                <div><h4 className="text-sm font-bold">Categories Tree</h4><p className="text-xs text-gray-500">Rebuild/Backfill</p></div>
                <div className="flex gap-2"><button onClick={handleSyncCategories} disabled={syncingCats} className="bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs disabled:opacity-50">Rebuild</button><button onClick={handleBackfillCategories} disabled={backfillingCats} className="bg-temu-black text-white px-4 py-2.5 rounded-xl text-xs disabled:opacity-50">Backfill</button></div>
              </div>
            </div>
          )}

          {/* 4. Sourcing */}
          {activeTab === 'sourcing' && (
            <div>
              <h2 className="text-lg font-black text-temu-black mb-1">1688 Sourcing</h2>
              <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.target as HTMLFormElement); try { await adminApi.post('/admin/sourcing/create', Object.fromEntries(f)); alert('✅ Sent!'); (e.target as HTMLFormElement).reset(); } catch { alert('❌ Error'); } }} className="space-y-4 bg-temu-offwhite p-6 rounded-xl border">
                <input type="text" name="productName" required placeholder="Product Name" className="w-full bg-white border rounded-xl px-4 py-3" />
                <input type="url" name="productImage" required placeholder="Image URL" className="w-full bg-white border rounded-xl px-4 py-3" />
                <input type="url" name="productUrl" placeholder="1688 URL" className="w-full bg-white border rounded-xl px-4 py-3" />
                <button type="submit" className="w-full bg-linear-to-r from-[#8B78C6] to-[#7B68B6] text-white font-extrabold py-3.5 rounded-xl">Submit</button>
              </form>
            </div>
          )}

          {/* 5. Coupons */}
          {activeTab === 'coupons' && (
            <div>
              <h2 className="text-lg font-black text-temu-black mb-1">Coupons</h2>
              <form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.target as HTMLFormElement); const p = Object.fromEntries(f); try { await adminApi.post('/admin/add-coupon', { ...p, discount_value: Number(p.discount_value) }); alert('✅ Created!'); (e.target as HTMLFormElement).reset(); } catch { alert('❌ Error'); } }} className="space-y-4 bg-temu-offwhite p-6 rounded-xl border max-w-lg">
                <input type="text" name="code" required placeholder="Code (e.g. LACLARC10)" className="w-full bg-white border rounded-xl px-4 py-3 uppercase" />
                <div className="grid grid-cols-2 gap-4"><select name="discount_type" className="w-full bg-white border rounded-xl px-4 py-3"><option value="percentage">%</option><option value="fixed">$</option></select><input type="number" name="discount_value" required placeholder="Value" className="w-full bg-white border rounded-xl px-4 py-3" /></div>
                <button type="submit" className="w-full bg-linear-to-r from-[#FF6B9D] to-rose-600 text-white font-extrabold py-3.5 rounded-xl">Deploy</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}