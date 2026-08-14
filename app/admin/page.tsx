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

export default function AdminAddProduct() {
  const router = useRouter();
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

  // ✨ حالات جديدة للمزامنة
  const [syncingCats, setSyncingCats] = useState(false);
  const [backfillingCats, setBackfillingCats] = useState(false);

  useEffect(() => {
    adminApi.get('/categories')
      .then(res => {
        const flat = flattenCategories(res.data);
        setAvailableCategories(flat);
      })
      .catch(err => console.error('Error fetching categories:', err));
  }, []);

  const handleSyncCategories = async () => {
    setSyncingCats(true);
    try {
      const res = await adminApi.post('/admin/sync-categories');
      alert(`✅ ${res.data.message}`);
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.error || 'Server error'}`);
    } finally {
      setSyncingCats(false);
    }
  };

    const handleBackfillCategories = async () => {
    if (!confirm('This will update categories for ALL existing products. It may take several minutes depending on the number of products. Continue?')) return;
    setBackfillingCats(true);
    try {
      // ✨ تمرير timeout: 0 لتعطيل مهلة الانتظار لهذا الطلب الطويل فقط
      const res = await adminApi.post('/admin/backfill-categories', {}, { timeout: 0 });
      alert(`✅ ${res.data.message}`);
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.error || err.message || 'Server error'}`);
    } finally {
      setBackfillingCats(false);
    }
  };

  const handleAdminSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminSearch.trim()) {
      router.push(`/admin/manage?search=${encodeURIComponent(adminSearch.trim())}`);
    }
  };

  const handleSyncCJ = async () => {
    setSyncing(true);
    setSyncMessage('⏳ Syncing products from CJ... This may take a few minutes. Please do not close this page.');
    try {
      const url = syncCategory 
        ? `/sync-cj-products?keyword=${encodeURIComponent(syncCategory)}` 
        : '/sync-cj-products';
      
      const res = await adminApi.get(url, { timeout: 0 });
      setSyncMessage(`✅ ${res.data.message}`);
    } catch (err: any) {
      setSyncMessage(`❌ Error: ${err.response?.data?.error || err.message || 'Failed to connect to server.'}`);
    } finally {
      setSyncing(false);
    }
  };

  const [formData, setFormData] = useState({
    title: '',
    price: '',
    original_price: '',
    image_url: '',
    images: '',
    description: '',
    material: '',
    colors: '',
    sizes: '',
    category: 'other'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage('📤 Uploading images...');

    const uploadData = new FormData();
    for (let i = 0; i < files.length; i++) {
      uploadData.append('images', files[i]);
    }

    try {
      const res = await adminApi.post('/admin/upload', uploadData);
      const urls = res.data.urls;

      const mainImg = urls[0];
      const allImgs = urls.join(', ');

      setFormData(prev => ({
        ...prev,
        image_url: prev.image_url || mainImg,
        images: prev.images ? `${prev.images}, ${allImgs}` : allImgs
      }));
      setMessage('✅ Images uploaded successfully!');
    } catch (err: any) {
      setMessage(`❌ Upload Error: ${err.response?.data?.error || 'Unknown error'}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
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
        title: data.title || '',
        image_url: data.image_url || '',
        description: data.description || '',
        price: data.price || '',
        images: data.image_url ? data.image_url : ''
      }));
      setMessage('✅ Data fetched successfully! Review and complete the missing fields.');
    } catch (err: any) {
      setMessage(`❌ Scrape Error: ${err.response?.data?.error || 'Failed to connect to server.'}`);
    } finally {
      setScraping(false);
    }
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
      
      setMessage('✅ Product added successfully!');
      setFormData({ title: '', price: '', original_price: '', image_url: '', images: '', description: '', material: '', colors: '', sizes: '', category: 'other' });
      setScrapeUrl('');
    } catch (err: any) {
      setMessage(`❌ Error: ${err.response?.data?.error || 'Failed to connect to server.'}`);
    } finally {
      setLoading(false);
    }
  };

  const imagePreviews = formData.images.split(',').map(img => img.trim()).filter(Boolean);

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <button onClick={() => router.push('/')} className="text-temu-orange font-bold">
            ← Back to Store
          </button>
          
          <form onSubmit={handleAdminSearch} className="relative flex-1 min-w-50">
            <input 
              type="text" 
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder="🔍 Quick search products..." 
              className="w-full bg-white border-2 border-temu-gray-border-light rounded-temu-sm py-2 pl-4 pr-10 text-sm focus:outline-none focus:border-temu-orange transition"
            />
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-temu-gray-light hover:text-temu-orange cursor-pointer p-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </button>
          </form>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          <button onClick={() => router.push('/admin/manage')} className="bg-temu-black text-white text-sm font-bold py-2 px-4 rounded-temu-sm hover:bg-temu-dark transition cursor-pointer">Manage Products</button>
          <button onClick={() => router.push('/admin/baridimob')} className="bg-[#8B78C6] text-white text-sm font-bold py-2 px-4 rounded-temu-sm hover:bg-[#7a68af] transition cursor-pointer">BaridiMob Orders</button>
          <button onClick={() => router.push('/admin/disputes')} className="bg-temu-error text-white text-sm font-bold py-2 px-4 rounded-temu-sm hover:bg-red-600 transition cursor-pointer">Disputes</button>
          <button onClick={() => router.push('/admin/advanced')} className="bg-temu-black text-white text-sm font-bold py-2 px-4 rounded-temu-sm hover:bg-temu-dark transition cursor-pointer">Advanced Tools</button>
        </div>
        
        <div className="bg-white rounded-temu-sm p-8 border border-temu-gray-border-light">
          <h1 className="text-2xl font-extrabold text-temu-black mb-6">Add New Product</h1>
          
          {message && (
            <div className={`p-4 rounded-temu-sm mb-6 text-sm font-medium ${message.includes('✅') ? 'bg-temu-green-light text-temu-green' : 'bg-red-50 text-temu-error'}`}>
              {message}
            </div>
          )}

          <div className="mb-8 p-4 bg-temu-yellow-soft rounded-temu-sm border border-temu-gold">
            <label className="block text-sm font-bold text-temu-black mb-2">Auto-Fill from URL</label>
            <div className="flex gap-2">
              <input type="url" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} placeholder="Paste product link here..." className="flex-1 bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange" />
              <button onClick={handleScrape} disabled={scraping} className="bg-temu-black text-white font-bold px-6 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer whitespace-nowrap">{scraping ? 'Fetching...' : 'Fetch Data'}</button>
            </div>
          </div>

          <div className="mb-8 p-4 bg-white rounded-temu-sm border border-temu-gray-border-light">
            <label className="block text-sm font-bold text-temu-black mb-2">Sync Products from CJ by Category</label>
            <div className="flex gap-2">
              <select value={syncCategory} onChange={(e) => setSyncCategory(e.target.value)} className="flex-1 bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange cursor-pointer">
                <option value="">🛍️ منتجات شاملة (General / Trending)</option>
                <option value="clipper">🪒 آلات الحلاقة (Shavers)</option>
                <option value="smartphone">📱 الهواتف الذكية (Smartphones)</option>
                <option value="kitchen">🍳 المطبخ (Kitchen)</option>
                <option value="appliance">🔌 كهرومنزلية (Home Appliances)</option>
                <option value="jewelry">💍 اكسسوارات وجواهر (Jewelry)</option>
                <option value="beauty">💄 مواد التجميل (Beauty)</option>
                <option value="tool">🛠️ أدوات (Tools)</option>
                <option value="home decor">🏠 المنزل (Home)</option>
                <option value="car accessory">🚗 السيارات (Automobile)</option>
                <option value="shoes">👟 أحذية (Footwear)</option>
                <option value="men clothes">👕 ملابس رجالية (Men's Clothing)</option>
                <option value="women clothes">👗 ملابس نسائية (Women's Clothing)</option>
                <option value="kids clothes">🧒 ملابس أطفال (Kids' Clothing)</option>
                <option value="drone">🚁 طائرات بدون طيار (Drones)</option>
                <option value="smart home">🏠 المنزل الذكي (Smart Home)</option>
                <option value="fitness">⚽ رياضة ولياقة (Sports & Fitness)</option>
                <option value="garden">🌳 الحديقة (Garden)</option>
                <option value="pet">🐾 حيوانات أليفة (Pet)</option>
              </select>
              <button onClick={handleSyncCJ} disabled={syncing} className="bg-temu-black text-white font-bold px-6 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer whitespace-nowrap">{syncing ? 'Syncing...' : 'Sync Now'}</button>
            </div>
            {syncMessage && (<p className={`mt-3 text-sm font-medium ${syncMessage.includes('✅') ? 'text-temu-green' : 'text-temu-error'}`}>{syncMessage}</p>)}
          </div>

          {/* ✨ أزرار شجرة الفئات الرسمية */}
          <div className="mb-8 p-4 bg-white rounded-temu-sm border border-temu-gray-border-light">
            <label className="block text-sm font-bold text-temu-black mb-2">Official CJ Categories Tree</label>
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={handleSyncCategories}
                disabled={syncingCats}
                className="bg-temu-green text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {syncingCats ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Syncing Tree...
                  </>
                ) : (
                  '1. Sync Categories Tree'
                )}
              </button>
              
              <button 
                onClick={handleBackfillCategories}
                disabled={backfillingCats}
                className="bg-temu-black text-white font-bold px-6 py-3 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {backfillingCats ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Backfilling... (Wait)
                  </>
                ) : (
                  '2. Update Existing Products'
                )}
              </button>
            </div>
            <p className="text-xs text-temu-gray-text mt-2">Run Step 1 first, then Step 2 to apply official categories to all products.</p>
          </div>

          <div className="mb-6 p-4 bg-temu-offwhite rounded-temu-sm border border-temu-gray-border-light">
            <label className="block text-sm font-bold text-temu-black mb-2">Upload Images from PC</label>
            <div className="flex items-center gap-4">
              <input type="file" accept="image/*" multiple onChange={handleFileUpload} disabled={uploading} className="block w-full text-sm text-temu-gray-text file:mr-4 file:py-3 file:px-4 file:rounded-temu-sm file:border-0 file:text-sm file:font-bold file:bg-temu-orange file:text-white hover:file:bg-temu-orange-bright cursor-pointer" />
              {uploading && <span className="text-sm font-bold text-temu-orange animate-pulse">Uploading...</span>}
            </div>
            {imagePreviews.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {imagePreviews.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 border border-temu-gray-border rounded-temu-sm overflow-hidden">
                    <img src={img} alt={`preview ${idx}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-temu-black mb-2">Product Title *</label>
              <input type="text" name="title" value={formData.title} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Price ($) *</label>
                <input type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} required className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Original Price ($)</label>
                <input type="number" step="0.01" name="original_price" value={formData.original_price} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-temu-black mb-2">Main Image URL *</label>
              <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} required placeholder="https://..." className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
            </div>

            <div>
              <label className="block text-sm font-bold text-temu-black mb-2">Additional Images (comma separated)</label>
              <input type="text" name="images" value={formData.images} onChange={handleChange} placeholder="url1, url2, url3" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              <p className="text-xs text-temu-gray-text mt-1">سيتم ملء هذا الحقل تلقائياً عند رفع الصور من الكمبيوتر</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-temu-black mb-2">Category</label>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange">
                {availableCategories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Colors (hex codes)</label>
                <input type="text" name="colors" value={formData.colors} onChange={handleChange} placeholder="#000000, #FFFFFF" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Sizes</label>
                <input type="text" name="sizes" value={formData.sizes} onChange={handleChange} placeholder="S, M, L, XL" className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-temu-black mb-2">Material</label>
              <input type="text" name="material" value={formData.material} onChange={handleChange} placeholder="Cotton, Plastic, etc." className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
            </div>

            <div>
              <label className="block text-sm font-bold text-temu-black mb-2">Description</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange resize-none"></textarea>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-4 rounded-temu-sm transition disabled:opacity-50 flex justify-center items-center cursor-pointer">
              {loading ? 'Adding...' : 'Add Product'}
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-temu-gray-border-light">
            <h2 className="text-2xl font-extrabold text-temu-black mb-6">Create Coupon</h2>
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
            }} className="space-y-5 bg-temu-offwhite p-6 rounded-temu-sm border border-temu-gray-border-light">
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Coupon Code *</label>
                <input type="text" name="code" required placeholder="e.g., NEO10" className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-temu-black mb-2">Discount Type</label>
                  <select name="discount_type" className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange">
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-temu-black mb-2">Value *</label>
                  <input type="number" step="0.01" name="discount_value" required placeholder="e.g., 10" className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
                </div>
              </div>
              <button type="submit" className="bg-temu-black text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-dark transition cursor-pointer">Create Coupon</button>
            </form>
          </div>

          <div className="mt-12 pt-8 border-t border-temu-gray-border-light">
            <h2 className="text-2xl font-extrabold text-temu-black mb-2">Product Sourcing</h2>
            <p className="text-sm text-temu-gray-text mb-6">Found a winning product elsewhere? Send it to CJ to source it for you.</p>
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
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Product Name *</label>
                <input type="text" name="productName" required placeholder="e.g., Smart Watch Pro" className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Image URL *</label>
                <input type="url" name="productImage" required placeholder="https://..." className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Product URL (Link to the product)</label>
                <input type="url" name="productUrl" placeholder="https://aliexpress.com/..." className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Target Price ($)</label>
                <input type="number" step="0.01" name="price" placeholder="e.g., 15.00" className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <button type="submit" className="bg-temu-black text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-dark transition cursor-pointer">Send Sourcing Request to CJ</button>
            </form>
          </div>

        </div>
      </div>
    </main>
  );
}