'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import StarRating from '../../components/StarRating';
import adminApi from '../../utils/adminApi';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image?: string;
  image_url?: string;
  variants?: any[];
  category?: string;
  images?: string[];
  description?: string;
  material?: string;
  colors?: string[];
  sizes?: string[];
  stock_status?: boolean;
  is_sourced?: boolean;
}

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

function pickImages(images: string[] | undefined, fallbackSingle: string): string[] {
  if (images && images.length > 0) return images;
  return fallbackSingle ? [fallbackSingle] : [];
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

function ManageProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [updatingCategoryId, setUpdatingCategoryId] = useState<string | number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<Product | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [sourcingId, setSourcingId] = useState<string | number | null>(null);
  const [togglingDealId, setTogglingDealId] = useState<string | number | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [availableCategories, setAvailableCategories] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    adminApi.get('/categories')
      .then(res => setAvailableCategories(flattenCategories(res.data)))
      .catch((err) => {
        if (err.response?.status === 401 || err.response?.status === 403) {
          router.push('/admin/login');
        }
      });
  }, [router]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const url = `/admin/search-products?q=${encodeURIComponent(searchQuery.trim())}`;
      const res = await adminApi.get(url);
      setProducts(res.data);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        router.push('/admin/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(fetchProducts, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleAutoCategorize = async () => {
    if (!confirm('Run automated AI categorization for all inventory items?')) return;
    setIsCategorizing(true);
    try {
      const res = await adminApi.post('/admin/auto-categorize');
      alert(`✅ ${res.data.message}`);
      fetchProducts(); 
    } catch (err: any) {
      alert(`❌ Failed: ${err.response?.data?.error || err.message}`);
    } finally { 
      setIsCategorizing(false); 
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to hide this product from the store?')) return;
    setDeletingId(id);
    try {
      await adminApi.delete(`/admin/delete-product/${id}`);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err: any) { 
      alert(`❌ Error: ${err.response?.data?.error || 'Failed'}`); 
    } finally { 
      setDeletingId(null); 
    }
  };

  const handleToggleDeal = async (id: string | number) => {
    setTogglingDealId(id);
    try {
      const res = await adminApi.put(`/admin/toggle-deal/${id}`);
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_sourced: res.data.is_sourced } : p));
    } catch (err: any) {
      alert(`❌ Deal toggle failed: ${err.response?.data?.error || 'Server error'}`);
    } finally { 
      setTogglingDealId(null); 
    }
  };

  const handleSendToSourcing = async (product: Product) => {
    setSourcingId(product.id);
    try {
      await adminApi.post('/admin/sourcing/create', {
        productName: product.title, 
        productImage: product.image_url || product.image, 
        productUrl: '', 
        price: Number(product.price) || 0
      });
      alert('✅ Sourcing request sent to CJ Agents!');
    } catch (err: any) {
      alert(`❌ Sourcing request failed: ${err.response?.data?.error || 'Server error'}`);
    } finally { 
      setSourcingId(null); 
    }
  };

  const handleCategoryChange = async (id: string | number, newCategory: string) => {
    setUpdatingCategoryId(id);
    try {
      await adminApi.put(`/admin/update-category/${id}`, { category: newCategory });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, category: newCategory } : p));
    } catch (err: any) { 
      alert(`❌ Category update failed: ${err.response?.data?.error}`); 
    } finally { 
      setUpdatingCategoryId(null); 
    }
  };

  const openEditModal = (product: Product) => { 
    setEditProduct({ ...product }); 
    setIsEditModalOpen(true); 
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editProduct) return;
    setEditProduct({ ...editProduct, [e.target.name]: e.target.value });
  };

   const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    // 🛡️ v1.1 — Client-side financial guards (السيرفر هو الحكم — هادو UX)
    const parsedPrice = Number(editProduct.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 9.99) {
      alert(`❌ Price floor is $9.99 (v3.1) — cannot save $${editProduct.price}.`);
      return;
    }
    if (!editProduct.title?.trim()) {
      alert('❌ Title is required.');
      return;
    }
    const parsedOriginal = editProduct.original_price ? Number(editProduct.original_price) : null;
    if (parsedOriginal !== null && (!Number.isFinite(parsedOriginal) || parsedOriginal <= parsedPrice)) {
      alert('❌ Original price must be higher than the selling price (or leave it empty).');
      return;
    }

    setSavingEdit(true);
    try {
      const resolvedImageUrl = editProduct.image_url || editProduct.image || '';

      // 🆕 v1.1 — original_price: null قرار 1 (بلا 0 مزيف) · material: '' قرار 2 (بلا شعار مزيف)
      const payload = {
        title: editProduct.title.trim(),
        price: parsedPrice,
        original_price: parsedOriginal,                      // null أو رقم صالح — ماشي 0
        image_url: resolvedImageUrl,
        images: pickImages(editProduct.images, resolvedImageUrl),
        description: editProduct.description || '',
        material: editProduct.material || '',                // قرار 2 — بلا 'Premium Quality' بلا مصدر
        colors: Array.isArray(editProduct.colors) ? editProduct.colors : [],
        sizes: Array.isArray(editProduct.sizes) ? editProduct.sizes : [],
        category: editProduct.category || 'other'
      };

      await adminApi.put(`/admin/update-product/${editProduct.id}`, payload);
      alert('✅ Product updated and cache refreshed!');
      setIsEditModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(`❌ Save failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const openReviewModal = (product: Product) => { 
    setReviewProduct(product); 
    setIsReviewModalOpen(true); 
    setReviewMessage(''); 
    setReviewRating(5); 
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewProduct) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    try {
      await adminApi.post('/admin/add-review', { ...payload, product_id: reviewProduct.id, rating: reviewRating });
      setReviewMessage('✅ Review added successfully!');
      form.reset();
      setTimeout(() => { 
        setIsReviewModalOpen(false); 
        setReviewProduct(null); 
      }, 1200);
    } catch (err: any) { 
      setReviewMessage(`❌ Error: ${err.response?.data?.error || 'Failed to add review'}`); 
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite text-temu-black p-6 pb-24 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Navigation Bar */}
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4 border-b border-gray-200 pb-4">
          <button 
            onClick={() => router.push('/admin')} 
            className="text-xs font-bold text-temu-orange hover:brightness-110 transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            &larr; Back to Mission Control
          </button>
          
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">
              Live Buffer: 30 Items / Query
            </span>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-gray-200 shadow-sm">
          
          {/* Header & Auto-Categorize */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-200 pb-5">
            <div>
              <h1 className="text-xl font-black text-temu-black tracking-wide">Inventory Management</h1>
              <p className="text-xs text-gray-500">Control prices, categories, and Lightning Deals ⚡</p>
            </div>

            <button 
              onClick={handleAutoCategorize} 
              disabled={isCategorizing} 
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 text-xs font-bold py-2.5 px-4 rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-2 whitespace-nowrap active:scale-95"
            >
              {isCategorizing ? (
                <><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div> Processing AI Rules...</>
              ) : (
                <>🤖 Run Auto-Categorizer</>
              )}
            </button>
          </div>

          {/* Quick Search Field */}
          <div className="mb-6 relative">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search products by title or ID (showing latest 30)..." 
              className="w-full bg-temu-offwhite border border-gray-200 rounded-xl py-3.5 pl-11 pr-10 text-sm text-temu-black placeholder-gray-400 focus:outline-none focus:border-temu-orange transition" 
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-temu-black transition p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Items List */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-bold text-gray-500">Fetching inventory slice...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-500 text-sm">{searchQuery ? `No matches found for "${searchQuery}"` : 'No active products found.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => {
                const imgSrc = product.image_url || product.image || '/placeholder.jpg';
                const safePrice = Number(product.price) || 0;
                const safeOldPrice = Number(product.original_price) || 0;

                return (
                  <div 
                    key={product.id} 
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-temu-offwhite rounded-xl border border-gray-100 hover:border-gray-300 transition"
                  >
                    {/* Product Info */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                        <img src={imgSrc} alt={product.title} className="w-full h-full object-cover" />
                        {product.is_sourced && (
                          <span className="absolute top-0.5 right-0.5 bg-amber-400 text-black text-[9px] font-black px-1 rounded shadow">
                            ⚡
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-temu-black truncate">{product.title}</h3>
                          <a 
                            href={`/products/${product.id}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[11px] text-temu-orange hover:underline shrink-0"
                            title="Open live storefront page"
                          >
                            Live ↗
                          </a>
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <span className="text-temu-error font-extrabold text-sm">${safePrice.toFixed(2)}</span>
                          {safeOldPrice > safePrice && (
                            <span className="text-gray-400 line-through text-xs">${safeOldPrice.toFixed(2)}</span>
                          )}
                          <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
                            ID: {product.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category Selector */}
                    <div className="flex items-center gap-2 lg:w-56 shrink-0">
                      <select 
                        value={product.category || 'other'} 
                        onChange={(e) => handleCategoryChange(product.id, e.target.value)} 
                        disabled={updatingCategoryId === product.id} 
                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-temu-black focus:outline-none focus:border-temu-orange disabled:opacity-50 cursor-pointer"
                      >
                        {availableCategories.map(cat => (
                          <option key={cat.value} value={cat.value} className="bg-white">{cat.label}</option>
                        ))}
                      </select>
                      {updatingCategoryId === product.id && (
                        <div className="w-4 h-4 border-2 border-temu-orange border-t-transparent rounded-full animate-spin shrink-0"></div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Edit Button */}
                      <button 
                        onClick={() => openEditModal(product)} 
                        className="bg-blue-50 hover:bg-blue-100 text-blue-500 border border-blue-200 p-2.5 rounded-xl transition cursor-pointer active:scale-95" 
                        title="Edit Price & Details"
                      >
                        ✏️
                      </button>

                      {/* Review Button */}
                      <button 
                        onClick={() => openReviewModal(product)} 
                        className="bg-amber-50 hover:bg-amber-100 text-amber-500 border border-amber-200 p-2.5 rounded-xl transition cursor-pointer active:scale-95" 
                        title="Add Verified Review"
                      >
                        ⭐
                      </button>

                      {/* Lightning Deal Toggle ⚡ */}
                      <button
                        onClick={() => handleToggleDeal(product.id)}
                        disabled={togglingDealId === product.id}
                        className={`p-2.5 rounded-xl border transition cursor-pointer active:scale-95 disabled:opacity-50 ${
                          product.is_sourced 
                            ? 'bg-amber-500 text-white border-amber-400 font-bold shadow-md shadow-amber-500/20' 
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                        title={product.is_sourced ? 'Active Lightning Deal (Click to Remove)' : 'Activate Lightning Deal'}
                      >
                        {togglingDealId === product.id ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          '⚡'
                        )}
                      </button>

                      {/* CJ Sourcing Button */}
                      <button 
                        onClick={() => handleSendToSourcing(product)} 
                        disabled={sourcingId === product.id} 
                        className="bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 p-2.5 rounded-xl transition disabled:opacity-50 cursor-pointer active:scale-95" 
                        title="Request CJ Sourcing Quote"
                      >
                        {sourcingId === product.id ? (
                          <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          '🏭'
                        )}
                      </button>

                      {/* Hide/Delete Button */}
                      <button 
                        onClick={() => handleDelete(product.id)} 
                        disabled={deletingId === product.id} 
                        className="bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 p-2.5 rounded-xl transition disabled:opacity-50 cursor-pointer active:scale-95" 
                        title="Hide / Out of Stock"
                      >
                        {deletingId === product.id ? (
                          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          '🗑️'
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Product Modal (Secure Attribute Shield) */}
      {isEditModalOpen && editProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-lg font-black text-temu-black">Edit Product Details</h2>
                <p className="text-xs text-gray-500">ID: {editProduct.id}</p>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="text-gray-400 hover:text-temu-black transition p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Product Title *</label>
                <input 
                  type="text" 
                  name="title" 
                  value={editProduct.title || ''} 
                  onChange={handleEditChange} 
                  required 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Selling Price ($) *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="price" 
                    value={editProduct.price || ''} 
                    onChange={handleEditChange} 
                    required 
                    className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Original Price ($) — optional · shown as strikethrough</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    name="original_price" 
                    value={editProduct.original_price || ''} 
                    onChange={handleEditChange} 
                    className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Primary Image URL</label>
                <input 
                  type="url" 
                  name="image_url" 
                  value={editProduct.image_url || editProduct.image || ''} 
                  onChange={handleEditChange} 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Category</label>
                <select 
                  name="category" 
                  value={editProduct.category || 'other'} 
                  onChange={handleEditChange} 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange"
                >
                  {availableCategories.map(cat => (
                    <option key={cat.value} value={cat.value} className="bg-white">{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Description</label>
                <textarea 
                  name="description" 
                  rows={3} 
                  value={editProduct.description || ''} 
                  onChange={handleEditChange} 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange resize-none"
                ></textarea>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={savingEdit} 
                  className="w-full bg-linear-to-r from-temu-orange to-temu-orange-bright hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer disabled:opacity-50 active:scale-[0.98] shadow-md"
                >
                  {savingEdit ? 'Syncing to Database...' : 'Save & Refresh Live Cache'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Review Modal */}
      {isReviewModalOpen && reviewProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-temu-black">Create Organic Review</h2>
              <button 
                onClick={() => setIsReviewModalOpen(false)} 
                className="text-gray-400 hover:text-temu-black transition p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4 truncate">
              Product: <span className="text-temu-black font-semibold">{reviewProduct.title}</span>
            </p>

            {reviewMessage && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-bold ${
                reviewMessage.includes('✅') 
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                  : 'bg-red-50 text-red-500 border border-red-200'
              }`}>
                {reviewMessage}
              </div>
            )}

            <form onSubmit={handleAddReview} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Customer Display Name *</label>
                <input 
                  type="text" 
                  name="author" 
                  required 
                  placeholder="e.g. Jessica M." 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Rating Score</label>
                <StarRating onChange={(val) => setReviewRating(val)} />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Review Feedback *</label>
                <textarea 
                  name="content" 
                  required 
                  rows={3} 
                  placeholder="Incredible build quality, arrived much faster than expected!" 
                  className="w-full bg-temu-offwhite border border-gray-200 rounded-xl px-4 py-3 text-sm text-temu-black focus:outline-none focus:border-temu-orange resize-none"
                ></textarea>
              </div>

              <button 
                type="submit" 
                className="w-full bg-linear-to-r from-temu-error to-rose-600 hover:brightness-110 text-white font-extrabold py-3.5 rounded-xl transition cursor-pointer active:scale-95 shadow-md"
              >
                Inject Verified Review
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ManageProducts() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-temu-offwhite">
        <div className="w-8 h-8 border-3 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ManageProductsContent />
    </Suspense>
  );
}