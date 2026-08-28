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

function flattenCategories(nodes: CategoryNode[], parentPath = ''): { value: string, label: string }[] {
  let flat: { value: string, label: string }[] = [];
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
  
  // ✨ حالة التبويبات (Dashboard Slider)
  const [activeTab, setActiveTab] = useState('overview');

  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [syncCategory, setSyncCategory] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  
  const [adminSearch, setAdminSearch] = useState('');
  const [availableCategories, setAvailableCategories] = useState<{ value: string, label: string }[]>([]);
  const [syncingCats, setSyncingCats] = useState(false);
  const [backfillingCats, setBackfillingCats] = useState(false);

  // ✨ حالات Sourcing
  const [singlePid, setSinglePid] = useState('');
  const [syncingSingle, setSyncingSingle] = useState(false);
  const [singleMessage, setSingleMessage] = useState('');

  const [formData, setFormData] = useState({
    title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other'
  });

  useEffect(() => {
    adminApi.get('/categories')
      .then(res => setAvailableCategories(flattenCategories(res.data)))
      .catch(err => console.error('Error fetching categories:', err));
  }, []);

  // ==========================================
  // دوال الأدوات (Handlers)
  // ==========================================
  const handleAdminSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminSearch.trim()) router.push(`/admin/manage?search=${encodeURIComponent(adminSearch.trim())}`);
  };

  const handleSyncCategories = async () => {
    setSyncingCats(true);
    try {
      const res = await adminApi.post('/admin/sync-categories');
      alert(`✅ ${res.data.message}`);
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.error || 'Network Error'}`);
    } finally { setSyncingCats(false); }
  };

  const handleBackfillCategories = async () => {
    if (!confirm('This will update categories for ALL existing products. Continue?')) return;
    setBackfillingCats(true);
    try {
      const res = await adminApi.post('/admin/backfill-categories', {}, { timeout: 0 });
      alert(`✅ ${res.data.message}`);
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.error || 'Server error'}`);
    } finally { setBackfillingCats(false); }
  };

  const handleSyncCJ = async () => {
    setSyncing(true);
    setSyncMessage('⏳ Syncing products from CJ... This may take a few minutes.');
    try {
      const url = syncCategory ? `/sync-cj-products?keyword=${encodeURIComponent(syncCategory)}` : '/sync-cj-products';
      const res = await adminApi.get(url, { timeout: 0 });
      setSyncMessage(`✅ ${res.data.message}`);
    } catch (err: any) {
      setSyncMessage(`❌ Error: ${err.response?.data?.error || 'Failed to connect.'}`);
    } finally { setSyncing(false); }
  };

  const handleSyncSingle = async () => {
    if (!singlePid.trim()) return;
    setSyncingSingle(true);
    setSingleMessage('⏳ Syncing sourced product...');
    try {
      const res = await adminApi.post('/admin/sync-single-product', { pid: singlePid.trim() });
      setSingleMessage(`✅ ${res.data.message}`);
      setSinglePid('');
    } catch (err: any) {
      setSingleMessage(`❌ Error: ${err.response?.data?.error || 'Failed to sync.'}`);
    } finally { setSyncingSingle(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage('📤 Uploading images...');
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
    } catch (err: any) {
      setMessage(`❌ Upload Error: ${err.response?.data?.error || 'Unknown error'}`);
    } finally { setUploading(false); e.target.value = ''; }
  };

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setScraping(true);
    setMessage('');
    try {
      const res = await adminApi.post('/admin/scrape-product', { url: scrapeUrl });
      const data = res.data;
      setFormData(prev => ({
        ...prev,
        title: data.title || '', image_url: data.image_url || '', description: data.description || '', price: data.price || '', images: data.image_url ? data.image_url : ''
      }));
      setMessage('✅ Data fetched successfully!');
    } catch (err: any) {
      setMessage(`❌ Scrape Error: ${err.response?.data?.error || 'Failed to connect.'}`);
    } finally { setScraping(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = {
        title: formData.title, price: Number(formData.price), original_price: Number(formData.original_price),
        image_url: formData.image_url, images: formData.images.split(',').map(img => img.trim()).filter(Boolean),
        description: formData.description, material: formData.material,
        colors: formData.colors.split(',').map(col => col.trim()).filter(Boolean),
        sizes: formData.sizes.split(',').map(sz => sz.trim()).filter(Boolean), category: formData.category
      };
      await adminApi.post('/admin/add-product', payload);
      setMessage('✅ Product added successfully!');
      setFormData({ title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other' });
      setScrapeUrl('');
    } catch (err: any) {
      setMessage(`❌ Error: ${err.response?.data?.error || 'Failed to connect.'}`);
    } finally { setLoading(false); }
  };

  const imagePreviews = formData.images.split(',').map(img => img.trim()).filter(Boolean);

  // ==========================================
  // التبويبات (Tabs Data)
  // ==========================================
  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'add', label: 'Add Product', icon: '➕' },
    { id: 'sync', label: 'Sync & Import', icon: '🔄' },
    { id: 'sourcing', label: '1688 Sourcing', icon: '🏭' },
    { id: 'coupons', label: 'Coupons', icon: '🎟️' },
  ];

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <h1 className="text-2xl font-extrabold text-temu-black">Laclarc Admin Dashboard</h1>
          <button onClick={() => router.push('/')} className="flex items-center gap-2 text-temu-orange font-bold active:scale-95 transition touch-manipulation w-fit text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back to Store
          </button>
        </div>

        {/* Quick Search */}
        <form onSubmit={handleAdminSearch} className="relative flex-1 min-w-50 mb-6">
          <input type="text" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="🔍 Quick search products..." className="w-full bg-white border-2 border-temu-gray-border-light rounded-temu-sm py-3 pl-4 pr-10 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-temu-gray-light hover:text-temu-orange cursor-pointer p-1 active:scale-90">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
        </form>

        {/* ✨ Dashboard Slider Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide touch-pan-x border-b border-temu-gray-border-light">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 shrink-0 px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300 cursor-pointer active:scale-95 rounded-t-temu-sm ${
                activeTab === tab.id
                  ? 'bg-temu-black text-white shadow-md -mb-1 border-b-2 border-temu-orange'
                  : 'bg-white text-temu-gray-text border border-temu-gray-border-light hover:bg-temu-offwhite'
              }`}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* ✨ محتوى التبويبات */}
        <div className="bg-white rounded-temu-sm p-8 border border-temu-gray-border-light shadow-sm">
          
          {/* 1. Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-extrabold text-temu-black mb-6">Dashboard Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Manage Products', desc: 'Edit, delete, or mark as Lightning Deal', link: '/admin/manage', color: 'bg-temu-black' },
                  { label: 'BaridiMob Orders', desc: 'Approve manual payments', link: '/admin/baridimob', color: 'bg-temu-orange' },
                  { label: 'Manual & Pending', desc: 'Failed orders that need action', link: '/admin/failed-orders', color: 'bg-temu-error' },
                  { label: 'Disputes', desc: 'Manage CJ disputes', link: '/admin/disputes', color: 'bg-temu-black' },
                  { label: 'Advanced Tools', desc: 'Auto-categorize & more', link: '/admin/advanced', color: 'bg-temu-black' },
                ].map((card) => (
                  <button key={card.label} onClick={() => router.push(card.link)} className="text-left p-4 rounded-xl border border-temu-gray-border-light hover:border-temu-orange transition active:scale-95 cursor-pointer">
                    <div className={`w-10 h-10 rounded-full ${card.color} flex items-center justify-center text-white mb-3`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"></path></svg>
                    </div>
                    <h3 className="font-bold text-temu-black text-sm">{card.label}</h3>
                    <p className="text-xs text-temu-gray-light mt-1">{card.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2. Add Product Tab */}
          {activeTab === 'add' && (
            <div>
              <h2 className="text-xl font-extrabold text-temu-black mb-6">Add New Product</h2>
              
              {message && <div className={`p-4 rounded-temu-sm mb-6 text-sm font-medium ${message.includes('✅') ? 'bg-temu-green-light/10 text-temu-green' : 'bg-red-50 text-temu-error'}`}>{message}</div>}

              <div className="mb-8 p-4 bg-temu-yellow-soft rounded-temu-sm border border-temu-gold">
                <label className="block text-sm font-bold text-temu-black mb-2">Auto-Fill from URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="url" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="Paste product link here..." className="flex-1 bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition" />
                  <button onClick={handleScrape} disabled={scraping} className="bg-temu-black text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 active:scale-95">{scraping ? 'Fetching...' : 'Fetch Data'}</button>
                </div>
              </div>

              <div className="mb-6 p-4 bg-temu-offwhite rounded-temu-sm border border-temu-gray-border-light">
                <label className="block text-sm font-bold text-temu-black mb-2">Upload Images from PC</label>
                <div className="flex items-center gap-4">
                  <input type="file" accept="image/*" multiple onChange={handleFileUpload} disabled={uploading} className="block w-full text-sm text-temu-gray-text file:mr-4 file:py-3 file:px-4 file:rounded-temu-sm file:border-0 file:text-sm file:font-bold file:bg-temu-orange file:text-white hover:file:bg-temu-orange-bright cursor-pointer" />
                  {uploading && <span className="text-sm font-bold text-temu-orange animate-pulse">Uploading...</span>}
                </div>
                {imagePreviews.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {imagePreviews.map((img, idx) => <div key={idx} className="relative w-20 h-20 border border-temu-gray-border rounded-temu-sm overflow-hidden"><img src={img} alt={`preview ${idx}`} className="w-full h-full object-cover" /></div>)}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div><label className="block text-sm font-bold text-temu-black mb-2">Product Title *</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-temu-black mb-2">Price ($) *</label><input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                  <div><label className="block text-sm font-bold text-temu-black mb-2">Original Price ($)</label><input type="number" step="0.01" name="original_price" value={formData.original_price} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                </div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Main Image URL *</label><input type="url" name="image_url" value={formData.image_url} onChange={handleChange} required placeholder="https://..." className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Additional Images (comma separated)</label><input type="text" name="images" value={formData.images} onChange={handleChange} placeholder="url1, url2, url3" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Category</label><select name="category" value={formData.category} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition">{availableCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-temu-black mb-2">Colors (hex)</label><input type="text" name="colors" value={formData.colors} onChange={handleChange} placeholder="#000, #FFF" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                  <div><label className="block text-sm font-bold text-temu-black mb-2">Sizes</label><input type="text" name="sizes" value={formData.sizes} onChange={handleChange} placeholder="S, M, L" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                </div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Description</label><textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange resize-none transition"></textarea></div>
                <button type="submit" disabled={loading} className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-4 rounded-temu-sm transition disabled:opacity-50 flex justify-center items-center cursor-pointer active:scale-95 shadow-md">{loading ? 'Adding...' : 'Add Product'}</button>
              </form>
            </div>
          )}

          {/* 3. Sync & Import Tab */}
          {activeTab === 'sync' && (
            <div>
              <h2 className="text-xl font-extrabold text-temu-black mb-6">Sync & Import Products</h2>

              {/* Sync CJ by Category */}
              <div className="mb-8 p-4 bg-temu-offwhite rounded-temu-sm border border-temu-gray-border-light">
                <label className="block text-sm font-bold text-temu-black mb-2">Sync Products from CJ by Category</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select value={syncCategory} onChange={(e) => setSyncCategory(e.target.value)} className="flex-1 bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange cursor-pointer">
                    <option value="">🛍️ General / Trending</option>
                    <option value="clipper">🪒 Shavers</option>
                    <option value="smartphone">📱 Smartphones</option>
                    <option value="kitchen">🍳 Kitchen</option>
                    <option value="jewelry">💍 Jewelry</option>
                    <option value="beauty">💄 Beauty</option>
                    <option value="tool">🛠️ Tools</option>
                    <option value="home decor">🏠 Home</option>
                    <option value="car accessory">🚗 Automobile</option>
                    <option value="shoes">👟 Footwear</option>
                    <option value="men clothes">👕 Men's Clothing</option>
                    <option value="women clothes">👗 Women's Clothing</option>
                    <option value="kids clothes">🧒 Kids' Clothing</option>
                  </select>
                  <button onClick={handleSyncCJ} disabled={syncing} className="bg-temu-black text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 active:scale-95 whitespace-nowrap">{syncing ? 'Syncing...' : 'Sync Now'}</button>
                </div>
                {syncMessage && <p className={`mt-3 text-sm font-medium ${syncMessage.includes('✅') ? 'text-temu-green' : 'text-temu-error'}`}>{syncMessage}</p>}
              </div>

              {/* Sync Single PID */}
              <div className="mb-8 p-4 bg-purple-50 rounded-xl border border-[#8B78C6]/30">
                <label className="block text-sm font-bold text-[#1D1E3C] mb-2">Sync Sourced Product by PID (1688)</label>
                <p className="text-xs text-gray-500 mb-3">After CJ accepts your sourcing request, copy the product ID (PID) from your CJ dashboard and paste it here.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input type="text" value={singlePid} onChange={(e) => setSinglePid(e.target.value)} placeholder="Enter CJ Product ID (e.g., 12345678)..." className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#8B78C6] transition" />
                  <button onClick={handleSyncSingle} disabled={syncingSingle} className="bg-[#8B78C6] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#7a67b5] transition disabled:opacity-50 active:scale-95 whitespace-nowrap">{syncingSingle ? 'Syncing...' : 'Sync & Mark as Deal ⚡'}</button>
                </div>
                {singleMessage && <p className={`mt-3 text-sm font-medium ${singleMessage.includes('✅') ? 'text-green-600' : 'text-red-500'}`}>{singleMessage}</p>}
              </div>

              {/* Categories Tree */}
              <div className="p-4 bg-white rounded-temu-sm border border-temu-gray-border-light">
                <label className="block text-sm font-bold text-temu-black mb-2">Official CJ Categories Tree</label>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={handleSyncCategories} disabled={syncingCats} className="bg-temu-green text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-green/90 transition disabled:opacity-50 flex items-center gap-2 active:scale-95">
                    {syncingCats ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Syncing...</> : '1. Sync Categories Tree'}
                  </button>
                  <button onClick={handleBackfillCategories} disabled={backfillingCats} className="bg-temu-black text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 flex items-center gap-2 active:scale-95">
                    {backfillingCats ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Backfilling...</> : '2. Update Products'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. 1688 Sourcing Tab */}
          {activeTab === 'sourcing' && (
            <div>
              <h2 className="text-xl font-extrabold text-temu-black mb-2">Product Sourcing (1688)</h2>
              <p className="text-sm text-temu-gray-text mb-6">Found a winning product on 1688? Send it to CJ to source it for you.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                try {
                  await adminApi.post('/admin/sourcing/create', payload);
                  alert('Sourcing request sent successfully!');
                  form.reset();
                } catch (err: any) {
                  alert(`Failed: ${err.response?.data?.error || 'Server error.'}`);
                }
              }} className="space-y-5 bg-temu-offwhite p-6 rounded-temu-sm border border-temu-gray-border-light">
                <div><label className="block text-sm font-bold text-temu-black mb-2">Product Name *</label><input type="text" name="productName" required placeholder="e.g., Smart Watch Pro" className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Image URL *</label><input type="url" name="productImage" required placeholder="https://..." className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Product URL (Link to the product)</label><input type="url" name="productUrl" placeholder="https://1688.com/..." className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div><label className="block text-sm font-bold text-temu-black mb-2">Target Price ($)</label><input type="number" step="0.01" name="price" placeholder="e.g., 15.00" className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <button type="submit" className="w-full bg-temu-black text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-dark transition active:scale-95">Send Sourcing Request to CJ</button>
              </form>
            </div>
          )}

          {/* 5. Coupons Tab */}
          {activeTab === 'coupons' && (
            <div>
              <h2 className="text-xl font-extrabold text-temu-black mb-6">Create Coupon</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);
                const payload = Object.fromEntries(formData.entries());
                try {
                  await adminApi.post('/admin/add-coupon', { ...payload, discount_value: Number(payload.discount_value) });
                  alert('Coupon created successfully!');
                  form.reset();
                } catch (err: any) {
                  alert(`Failed: ${err.response?.data?.error || 'Server error.'}`);
                }
              }} className="space-y-5 bg-temu-offwhite p-6 rounded-temu-sm border border-temu-gray-border-light max-w-md">
                <div><label className="block text-sm font-bold text-temu-black mb-2">Coupon Code *</label><input type="text" name="code" required placeholder="e.g., LACLARC10" className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-bold text-temu-black mb-2">Type</label><select name="discount_type" className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed ($)</option></select></div>
                  <div><label className="block text-sm font-bold text-temu-black mb-2">Value *</label><input type="number" step="0.01" name="discount_value" required placeholder="e.g., 10" className="w-full bg-white border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange transition" /></div>
                </div>
                <button type="submit" className="w-full bg-temu-black text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-dark transition active:scale-95">Create Coupon</button>
              </form>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}