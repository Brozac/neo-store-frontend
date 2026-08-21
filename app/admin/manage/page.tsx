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
  image: string;
  image_url?: string;
  variants?: any[];
  category?: string;
  images?: string[];
  description?: string;
  material?: string;
  colors?: string[];
  sizes?: string[];
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
  const [sourcingId, setSourcingId] = useState<string | number | null>(null);

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  
  const [availableCategories, setAvailableCategories] = useState<{ value: string, label: string }[]>([]);

  useEffect(() => {
    adminApi.get('/categories')
      .then(res => {
        const flat = flattenCategories(res.data);
        setAvailableCategories(flat);
      })
      .catch(err => console.error('Error fetching categories:', err));
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let url = '/products';
      if (searchQuery.trim()) {
        url = `/admin/search-products?q=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await adminApi.get(url);
      setProducts(res.data);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      alert(`Error loading products: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(fetchProducts, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleAutoCategorize = async () => {
    if (!confirm('This will automatically re-categorize ALL products based on their titles using the Smart Filter. Continue?')) return;
    setIsCategorizing(true);
    try {
      const res = await adminApi.post('/admin/auto-categorize');
      alert(`✅ ${res.data.message}`);
      fetchProducts(); 
    } catch (err: any) {
      alert(`❌ Failed: ${err.response?.data?.error || err.response?.data?.message || err.message}`);
    } finally {
      setIsCategorizing(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setDeletingId(id);
    try {
      await adminApi.delete(`/admin/delete-product/${id}`);
      setProducts(products.filter(p => p.id !== id));
    } catch (err: any) { 
      alert(`❌ Error: ${err.response?.data?.error || err.response?.data?.message || 'Failed to delete product.'}`); 
    } finally { 
      setDeletingId(null); 
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
      alert('✅ Sourcing request sent to CJ successfully!');
    } catch (err: any) {
      alert(`❌ Failed: ${err.response?.data?.error || err.response?.data?.message || 'Server error'}`);
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
      alert(`❌ Error: ${err.response?.data?.error || err.response?.data?.message || 'Failed to update category.'}`); 
    } finally { 
      setUpdatingCategoryId(null); 
    }
  };

  const openEditModal = (product: Product) => {
    setEditProduct(product);
    setIsEditModalOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editProduct) return;
    setEditProduct({ ...editProduct, [e.target.name]: e.target.value });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;
    setSavingEdit(true);

    try {
      const resolvedImageUrl = editProduct.image_url || editProduct.image;
      const payload = {
        title: editProduct.title,
        price: Number(editProduct.price) || 0,
        original_price: Number(editProduct.original_price) || 0,
        image_url: resolvedImageUrl,
        images: pickImages(editProduct.images, resolvedImageUrl),
        description: editProduct.description,
        material: editProduct.material,
        colors: editProduct.colors,
        sizes: editProduct.sizes,
        category: editProduct.category || 'other'
      };

      await adminApi.put(`/admin/update-product/${editProduct.id}`, payload);
      alert('✅ Product updated successfully!');
      setIsEditModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      alert(`❌ Error: ${err.response?.data?.error || err.response?.data?.message || 'Failed to update product.'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const openReviewModal = (product: Product) => {
    setReviewProduct(product);
    setIsReviewModalOpen(true);
    setReviewMessage('');
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewProduct) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    try {
      await adminApi.post('/admin/add-review', { ...payload, product_id: reviewProduct.id, rating: Number(payload.rating) });
      setReviewMessage('✅ Review added successfully!');
      form.reset();
      setTimeout(() => { setIsReviewModalOpen(false); setReviewProduct(null); }, 1500);
    } catch (err: any) { 
      setReviewMessage(`❌ Error: ${err.response?.data?.error || err.response?.data?.message || 'Failed to add review.'}`); 
    }
  };

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-24 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => router.push('/admin')} className="text-temu-orange font-bold mb-6">
          ← Back to Add Product
        </button>
        
        <div className="bg-white rounded-temu-sm p-8 border border-temu-gray-border-light">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h1 className="text-2xl font-extrabold text-temu-black">Manage Products</h1>
            <button 
              onClick={handleAutoCategorize}
              disabled={isCategorizing}
              className="bg-temu-green text-white text-sm font-bold py-2.5 px-5 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer flex items-center gap-2 whitespace-nowrap"
            >
              {isCategorizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Categorizing...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                    <line x1="12" y1="22.08" x2="12" y2="12"></line>
                  </svg>
                  Auto-Categorize All
                </>
              )}
            </button>
          </div>

          <div className="mb-6 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name..."
              className="w-full bg-temu-offwhite border-2 border-temu-gray-border-light rounded-temu-sm py-3 pl-10 pr-10 text-sm focus:outline-none focus:border-temu-orange transition"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-temu-gray-light">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-temu-gray-light hover:text-temu-error transition cursor-pointer"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-10"><p className="text-temu-orange font-bold animate-pulse">Loading...</p></div>
          ) : products.length === 0 ? (
            <p className="text-center text-temu-gray-light py-10">
              {searchQuery ? `No products found for "${searchQuery}"` : 'No products found.'}
            </p>
          ) : (
            <div className="space-y-4">
              {products.map((product) => {
                const imgSrc = product.image || product.image_url || '/placeholder.jpg';
                const safePrice = Number(product.price) || 0;
                
                return (
                  <div key={product.id} className="flex flex-col md:flex-row md:items-center gap-4 p-3 bg-temu-offwhite rounded-temu-sm border border-temu-gray-border-light">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-16 h-16 rounded-temu-sm overflow-hidden bg-gray-200 shrink-0">
                        <img src={imgSrc} alt={product.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm text-temu-black truncate">{product.title}</h3>
                        <p className="text-temu-error font-extrabold text-sm">${safePrice.toFixed(2)}</p>
                        {product.variants && product.variants.length > 0 && (
                          <p className="text-[10px] text-temu-gray-light mt-1 truncate">
                            SKU: {product.variants[0].variantSku || product.variants[0].sku || 'N/A'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:w-64 shrink-0">
                      <select
                        value={product.category || 'other'}
                        onChange={(e) => handleCategoryChange(product.id, e.target.value)}
                        disabled={updatingCategoryId === product.id}
                        className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-2 py-2 text-xs font-bold text-temu-dark focus:outline-none focus:border-temu-orange disabled:opacity-50 cursor-pointer"
                      >
                        {availableCategories.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                      {updatingCategoryId === product.id && (
                        <div className="w-4 h-4 border-2 border-temu-orange border-t-transparent rounded-full animate-spin shrink-0"></div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEditModal(product)}
                        className="bg-blue-50 text-blue-500 p-3 rounded-temu-sm hover:bg-blue-100 transition cursor-pointer"
                        title="Edit Product"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </button>

                      <button
                        onClick={() => openReviewModal(product)}
                        className="bg-temu-yellow-soft text-temu-orange p-3 rounded-temu-sm hover:bg-temu-yellow transition cursor-pointer"
                        title="Add Review"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                      </button>

                      <button
                        onClick={() => handleSendToSourcing(product)}
                        disabled={sourcingId === product.id}
                        className="bg-green-50 text-temu-green p-3 rounded-temu-sm hover:bg-green-100 transition disabled:opacity-50 cursor-pointer"
                        title="Send to CJ Sourcing"
                      >
                        {sourcingId === product.id ? (
                          <div className="w-5 h-5 border-2 border-temu-green border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 19c.946 0 1.81-.103 2.598-.281l-1.757-1.757C12.568 16.983 12.291 17 12 17c-5.351 0-7.424-3.846-7.926-5 .204-.47.674-1.381 1.508-2.297L4.184 8.305c-1.538 1.667-2.121 3.346-2.132 3.379-.069.205-.069.428 0 .633C2.073 12.383 4.367 19 12 19z"></path>
                            <path d="M12 5c-1.837 0-3.346.396-4.604.981L3.707 2.293 2.293 3.707l18 18 1.414-1.414-3.319-3.319c2.614-1.951 3.547-4.615 3.561-4.657.069-.205.069-.428 0-.633C21.927 11.617 19.633 5 12 5z"></path>
                          </svg>
                        )}
                      </button>

                      <button
                        onClick={() => handleDelete(product.id)}
                        disabled={deletingId === product.id}
                        className="bg-red-50 text-temu-error p-3 rounded-temu-sm hover:bg-red-100 transition disabled:opacity-50 cursor-pointer"
                        title="Delete Product"
                      >
                        {deletingId === product.id ? (
                          <div className="w-5 h-5 border-2 border-temu-error border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
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

      {/* Modal التعديل (Edit Modal) */}
      {isEditModalOpen && editProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-temu-sm p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Edit Product</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-temu-gray-light hover:text-temu-black">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Title</label>
                <input type="text" name="title" value={editProduct.title || ''} onChange={handleEditChange} required className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-temu-black mb-2">Price ($)</label>
                  <input type="number" step="0.01" name="price" value={editProduct.price || ''} onChange={handleEditChange} required className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-temu-black mb-2">Original Price ($)</label>
                  <input type="number" step="0.01" name="original_price" value={editProduct.original_price || ''} onChange={handleEditChange} className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Category</label>
                <select name="category" value={editProduct.category || 'other'} onChange={handleEditChange} className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange">
                  {availableCategories.map(cat => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Description</label>
                <textarea name="description" rows={3} value={editProduct.description || ''} onChange={handleEditChange} className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange resize-none"></textarea>
              </div>
              <button type="submit" disabled={savingEdit} className="w-full bg-temu-orange text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer disabled:opacity-50">
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal التقييم (Review Modal) */}
      {isReviewModalOpen && reviewProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-temu-sm p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Add Review</h2>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-temu-gray-light hover:text-temu-black">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <p className="text-sm text-temu-gray-text mb-4 truncate">For: <span className="font-bold text-temu-black">{reviewProduct.title}</span></p>
            {reviewMessage && (
              <div className={`p-3 rounded-temu-sm mb-4 text-sm font-medium ${reviewMessage.includes('✅') ? 'bg-temu-green-light text-temu-green' : 'bg-red-50 text-temu-error'}`}>{reviewMessage}</div>
            )}
            <form onSubmit={handleAddReview} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Author Name *</label>
                <input type="text" name="author" required placeholder="e.g., John D." className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Rating</label>
                <StarRating onChange={(val) => {
                  const hiddenInput = document.getElementById('hidden-rating') as HTMLInputElement;
                  if (hiddenInput) hiddenInput.value = val.toString();
                }} />
                <input type="hidden" id="hidden-rating" name="rating" defaultValue="5" />
              </div>
              <div>
                <label className="block text-sm font-bold text-temu-black mb-2">Review Content *</label>
                <textarea name="content" required rows={3} placeholder="Great product, fast delivery!" className="w-full bg-temu-offwhite border border-temu-gray-border rounded-temu-sm px-4 py-3 focus:outline-none focus:border-temu-orange resize-none"></textarea>
              </div>
              <button type="submit" className="w-full bg-temu-orange text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition cursor-pointer">Submit Review</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function ManageProducts() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-temu-offwhite"><div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div></div>}>
      <ManageProductsContent />
    </Suspense>
  );
}