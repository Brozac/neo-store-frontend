'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import CountdownTimer from '../../components/CountdownTimer';
import LivePurchaseNotification from '../../components/LivePurchaseNotification';
import BuyButton from '../../components/BuyButton';
import TiltCard from '../../components/TiltCard';
import ReviewForm from '../../components/ReviewForm';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  category?: string;
  image?: string;
  image_url?: string;
  description?: string;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  variants?: any[];
  rating?: number;
  sales_count?: number;
  composition?: string;
  material?: string;
  chest_pad?: string;
  wires?: string;
  pattern?: string;
  support?: string;
  instruction?: string;
  origin?: string;
  store_name?: string;
  store_followers?: number;
  store_sales?: string;
  video_url?: string;
}

interface Review { id: number; author: string; rating: number; content: string; country: string; created_at: string; }

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'materials', label: 'Materials' },
  { key: 'size', label: 'Size & Fit' },
  { key: 'shipping', label: 'Shipping & Returns' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const STATIC_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
];

export default function ProductDetailsClient({ 
  product, 
  initialReviews, 
  relatedProducts 
}: { 
  product: Product; 
  initialReviews: Review[]; 
  relatedProducts: Product[];
}) {
  const router = useRouter();
  const { addToCart } = useCart();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showVideo, setShowVideo] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState(product.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || 'M');
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [reviews, setReviews] = useState(initialReviews);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [purchaseCount, setPurchaseCount] = useState(38);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const touchStartX = useRef(0);

  const defaultImage = '/placeholder.jpg';
  const galleryImages = useMemo(() => {
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images.filter(img => img && typeof img === 'string');
    }
    return [product.image_url || product.image || defaultImage];
  }, [product]);

  const mainImageSrc = galleryImages[currentImageIndex] || galleryImages[0] || defaultImage;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  // ✨ مطابقة المتغير الدقيق (Matching selected variant vid)
  const matchedVariant = useMemo(() => {
    if (!product.variants) return null;
    try {
      const parsedVariants = typeof product.variants === 'string' 
        ? JSON.parse(product.variants) 
        : product.variants;

      if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) return null;

      // 1. مطابقة اللون والمقاس معاً
      const exactMatch = parsedVariants.find((v: any) => {
        const name = (v.variantKey || v.variantNameEn || '').toLowerCase();
        const matchesColor = selectedColor ? name.includes(selectedColor.toLowerCase()) : true;
        const matchesSize = selectedSize ? new RegExp(`\\b${selectedSize}\\b`, 'i').test(name) : true;
        return matchesColor && matchesSize;
      });
      if (exactMatch) return exactMatch;

      // 2. مطابقة المقاس فقط
      const sizeMatch = parsedVariants.find((v: any) => {
        const name = (v.variantKey || v.variantNameEn || '').toLowerCase();
        return selectedSize ? new RegExp(`\\b${selectedSize}\\b`, 'i').test(name) : false;
      });
      if (sizeMatch) return sizeMatch;

      // 3. خيار احتياطي: أول متغير صالح
      return parsedVariants[0];
    } catch (e) {
      return null;
    }
  }, [product.variants, selectedColor, selectedSize]);

  useEffect(() => {
    const controller = new AbortController();
    setPurchaseCount(Math.floor(Math.random() * 35) + 18);

    const interval = setInterval(() => {
      setPurchaseCount(prev => Math.min(120, Math.max(12, prev + (Math.floor(Math.random() * 5) - 2))));
    }, 7000);

    try {
      const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
      setFavoriteIds(favs);
    } catch (e) {}

    // جلب التقييمات عبر رابط البيئة الديناميكي
    fetch(`${API_BASE_URL}/api/reviews/${product.id}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setReviews(data); })
      .catch(() => {});

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [product.id, API_BASE_URL]);

  const parsePrice = (price: any) => Number(price) || 0;
  const stripHtml = (html?: string) => html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const getColorHex = (c: string) => c.startsWith('#') ? c : '#888888';

  const handleToggleFavorite = (productId: string | number) => {
    const idStr = String(productId);
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const newFavorites = favorites.includes(idStr) 
      ? favorites.filter((f: string) => f !== idStr) 
      : [...favorites, idStr];
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    setFavoriteIds(newFavorites);
  };

  // ✨ إضافة للسلة مع المتغير الحقيقي المختار (vid المطابق)
  const handleAddToCart = () => {
    const resolvedVid = matchedVariant?.vid || '';
    
    addToCart({
      id: product.id,
      title: product.title,
      price: parsePrice(product.price),
      quantity,
      image: mainImageSrc,
      image_url: mainImageSrc,
      color: selectedColor,
      size: selectedSize,
      vid: resolvedVid
    }, quantity);
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX;
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        setCurrentImageIndex(prev => (prev === galleryImages.length - 1 ? 0 : prev + 1));
      } else {
        setCurrentImageIndex(prev => (prev === 0 ? galleryImages.length - 1 : prev - 1));
      }
    }
  };

  const safePrice = parsePrice(product.price);
  const safeOriginalPrice = parsePrice(product.original_price);
  const discountPct = safeOriginalPrice > safePrice 
    ? Math.round(((safeOriginalPrice - safePrice) / safeOriginalPrice) * 100) 
    : 0;

  const isCurrentProductFavorited = favoriteIds.includes(String(product.id));

  const detailBullets: string[] = [];
  if (product.material) detailBullets.push(`Material: ${product.material}`);
  if (product.composition) detailBullets.push(`Composition: ${product.composition}`);
  if (product.pattern) detailBullets.push(`Pattern: ${product.pattern}`);
  if (product.origin) detailBullets.push(`Origin: ${product.origin}`);

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-12">
        
        {/* Breadcrumbs */}
        <div className="flex flex-col gap-2 mb-6">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-temu-gray-light hover:text-temu-black font-medium text-sm transition cursor-pointer active:scale-95 w-fit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            Back
          </button>
          <div className="text-sm text-temu-gray-light flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-temu-orange cursor-pointer">Home</Link>
            <span>/</span>
            <Link href={`/category/${product.category?.split('/')[0] || 'all'}`} className="hover:text-temu-orange cursor-pointer capitalize">
              {product.category?.split('/')[0] || 'Catalog'}
            </Link>
            <span>/</span>
            <span className="text-temu-black font-medium truncate max-w-[200px] sm:max-w-none">{product.title}</span>
          </div>
        </div>

        {/* Product Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-stretch">
          
          {/* Visual Gallery */}
          <div className="flex flex-col gap-4 h-full">
            <div 
              className="relative flex-1 min-h-[350px] sm:min-h-[450px] rounded-temu-sm overflow-hidden bg-white border border-temu-gray-border-light group touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => setIsLightboxOpen(true)}
            >
              {showVideo && product.video_url ? (
                <video src={product.video_url} controls autoPlay className="w-full h-full object-cover" />
              ) : (
                <Image 
                  src={mainImageSrc} 
                  alt={product.title} 
                  fill 
                  sizes="(max-width: 768px) 100vw, 50vw" 
                  className="object-contain p-2 transition-transform duration-500 group-hover:scale-105" 
                  priority 
                />
              )}
              {galleryImages.length > 1 && !showVideo && (
                <>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1)} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2 rounded-full shadow-md transition cursor-pointer z-10 active:scale-90"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button 
                    onClick={() => setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2 rounded-full shadow-md transition cursor-pointer z-10 active:scale-90"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </>
              )}
              {!showVideo && (
                <button 
                  onClick={() => setIsLightboxOpen(true)} 
                  className="absolute bottom-4 right-4 bg-white/90 hover:bg-white rounded-full p-2.5 shadow-md hover:scale-105 transition cursor-pointer z-10 active:scale-90"
                >
                  🔍
                </button>
              )}
            </div>

            {/* Thumbnails */}
            <div className="flex gap-2 w-full overflow-x-auto pb-1 scrollbar-hide touch-pan-x">
              {product.video_url && (
                <div 
                  onClick={() => setShowVideo(true)} 
                  className={`relative aspect-square w-16 shrink-0 rounded-temu-sm overflow-hidden cursor-pointer border-2 transition flex items-center justify-center bg-black ${showVideo ? 'border-temu-orange' : 'border-transparent opacity-70'}`}
                >
                  <span className="text-white text-lg">▶</span>
                </div>
              )}
              {galleryImages.map((img, idx) => (
                <div 
                  key={idx} 
                  onClick={() => { setCurrentImageIndex(idx); setShowVideo(false); }} 
                  className={`relative aspect-square w-16 shrink-0 rounded-temu-sm overflow-hidden cursor-pointer border-2 transition bg-white ${!showVideo && currentImageIndex === idx ? 'border-temu-orange' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <Image src={img} alt="Thumbnail" fill sizes="80px" className="object-contain p-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & Customization Box */}
          <div className="flex flex-col justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-temu-black tracking-tight mb-3 leading-tight">{product.title}</h1>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="text-temu-orange text-sm">★★★★★</span>
                <span className="text-sm font-bold text-temu-black">4.9</span>
                <span className="text-xs text-temu-gray-light">({reviews.length} verified ratings)</span>
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-3xl font-black text-temu-error">${safePrice.toFixed(2)}</span>
                {safeOriginalPrice > safePrice && (
                  <>
                    <span className="text-lg text-temu-gray-light line-through">${safeOriginalPrice.toFixed(2)}</span>
                    <span className="bg-temu-black text-white text-xs font-black px-2.5 py-1 rounded-temu-sm">{discountPct}% OFF</span>
                  </>
                )}
              </div>

              {/* Color Options */}
              {product.colors && product.colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs uppercase font-extrabold text-temu-black mb-2">
                    Color: <span className="text-temu-gray-text font-semibold">{selectedColor}</span>
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {product.colors.map((col, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedColor(col)} 
                        className={`w-9 h-9 rounded-full transition cursor-pointer border-2 active:scale-90 ${selectedColor === col ? 'border-temu-orange scale-110 shadow' : 'border-gray-200'}`}
                      >
                        <span style={{ backgroundColor: getColorHex(col) }} className="block w-full h-full rounded-full border border-black/10"></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Options */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase font-extrabold text-temu-black">Size</label>
                    <button onClick={() => setActiveTab('size')} className="text-xs text-temu-orange font-bold cursor-pointer hover:underline">
                      Size Guide ↗
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((sz) => (
                      <button 
                        key={sz} 
                        onClick={() => setSelectedSize(sz)} 
                        className={`h-11 px-4 rounded-temu-sm font-bold text-xs transition cursor-pointer border-2 active:scale-95 ${selectedSize === sz ? 'border-temu-orange bg-temu-orange text-white' : 'border-gray-200 text-temu-black hover:border-gray-400 bg-white'}`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* CTA Controls */}
            <div className="space-y-4">
              <CountdownTimer />

              <div className="flex items-center gap-4">
                <span className="text-xs font-bold uppercase text-temu-black">Quantity:</span>
                <div className="flex items-center border border-temu-gray-border rounded-temu-sm overflow-hidden bg-white">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3.5 py-1.5 text-base font-bold text-temu-gray-text hover:bg-gray-100 active:scale-90">-</button>
                  <span className="px-4 py-1.5 font-bold text-sm text-temu-black border-x border-temu-gray-border">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="px-3.5 py-1.5 text-base font-bold text-temu-gray-text hover:bg-gray-100 active:scale-90">+</button>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleAddToCart} 
                  className="flex-1 bg-temu-orange hover:bg-temu-orange-bright text-white font-black py-4 px-6 rounded-temu-sm transition flex items-center justify-center gap-3 text-base cursor-pointer active:scale-95 shadow-lg shadow-temu-orange/20"
                >
                  <span></span> Add to Cart
                </button>
                <button 
                  onClick={() => handleToggleFavorite(product.id)} 
                  className={`w-14 h-14 shrink-0 flex items-center justify-center border-2 rounded-temu-sm transition cursor-pointer active:scale-90 ${isCurrentProductFavorited ? 'border-temu-error bg-temu-error text-white' : 'border-temu-gray-border bg-white text-temu-gray-text hover:text-temu-error'}`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isCurrentProductFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>
                </button>
              </div>

              {/* ✨ تمرير كامل المتغيرات إلى BuyButton */}
              <BuyButton 
                product={{ 
                  id: product.id, 
                  title: product.title, 
                  price: safePrice, 
                  image: mainImageSrc,
                  color: selectedColor,
                  size: selectedSize,
                  quantity: quantity,
                  vid: matchedVariant?.vid || ''
                }} 
              />

              {/* Dynamic Social Proof Indicator */}
              <div className="flex items-center gap-3 bg-white p-3 rounded-temu-sm border border-temu-gray-border-light shadow-sm">
                <div className="flex -space-x-2.5">
                  {STATIC_AVATARS.map((av, idx) => (
                    <img key={idx} src={av} className="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm" alt="Buyer avatar" />
                  ))}
                </div>
                <p className="text-xs text-temu-gray-text font-medium">
                  <span className="font-extrabold text-temu-black">{purchaseCount} shoppers</span> purchased this in the last 24 hours
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 text-[11px] text-temu-gray-text font-semibold border-t border-temu-gray-border-light">
                <div>✈️ Free Shipping</div>
                <div>🛡️ 30-Day Guarantee</div>
                <div>🔒 Secure Checkout</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Specifications */}
        <div className="border-t border-temu-gray-border-light pt-8">
          <div className="flex gap-6 border-b border-temu-gray-border-light mb-6 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button 
                key={tab.key} 
                onClick={() => setActiveTab(tab.key)} 
                className={`pb-3 text-xs uppercase font-extrabold whitespace-nowrap transition border-b-2 -mb-px cursor-pointer ${activeTab === tab.key ? 'border-temu-orange text-temu-orange' : 'border-transparent text-temu-gray-light hover:text-temu-black'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-sm text-temu-gray-text leading-relaxed">
            {activeTab === 'details' && (
              <div>
                <p className="mb-4">{stripHtml(product.description) || 'High quality craft with strict manufacturing standards.'}</p>
                {detailBullets.length > 0 && (
                  <ul className="space-y-1.5 list-disc list-inside">
                    {detailBullets.map((b, i) => <li key={i}>{b}</li>)}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'materials' && (
              <p>{product.material || 'Engineered with durable, high-grade hypoallergenic materials.'}</p>
            )}

            {activeTab === 'size' && (
              <p>Standard fit. Order your typical size. Detailed guide available upon request from support.</p>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-2">
                <p>Worldwide insured delivery. Shipped in 24–48 hours directly via CJ Dropshipping.</p>
                <p className="text-xs text-temu-gray-light">Typical transit time: 7–15 business days depending on destination country.</p>
              </div>
            )}
          </div>
        </div>

        {/* You May Also Like Section */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-temu-gray-border-light pt-10">
            <h2 className="text-lg font-black text-temu-black mb-6">Frequently Bought Together</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <TiltCard key={p.id}>
                  <Link href={`/products/${p.id}`} className="group flex flex-col h-full bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden active:scale-95 transition">
                    <div className="relative aspect-square overflow-hidden bg-gray-50">
                      <Image src={p.image_url || p.image || defaultImage} alt={p.title} fill sizes="200px" className="object-contain p-2 transition group-hover:scale-105" />
                    </div>
                    <div className="p-3 pt-2 flex flex-col justify-between flex-1">
                      <h3 className="text-xs font-bold text-temu-black line-clamp-2 mb-1 group-hover:text-temu-orange">{p.title}</h3>
                      <p className="text-temu-error font-extrabold text-sm">${parsePrice(p.price).toFixed(2)}</p>
                    </div>
                  </Link>
                </TiltCard>
              ))}
            </div>
          </div>
        )}

        {/* Verified Customer Reviews */}
        <div className="border-t border-temu-gray-border-light pt-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-temu-black">Customer Reviews ({reviews.length})</h2>
            <span className="text-xs font-bold text-temu-green">Verified Worldwide Purchases ✔</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {reviews.slice(0, 6).map((rev) => (
              <div key={rev.id} className="p-4 bg-white rounded-temu-sm border border-temu-gray-border-light shadow-sm space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-temu-black">{rev.author} ({rev.country || 'Verified Buyer'})</span>
                  <span className="text-temu-orange text-xs">{'★'.repeat(rev.rating)}</span>
                </div>
                <p className="text-xs text-temu-gray-text leading-relaxed">{rev.content}</p>
                <span className="text-[10px] text-gray-400 block font-mono">{new Date(rev.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          <ReviewForm 
            productId={product.id} 
            onReviewAdded={() => {
              fetch(`${API_BASE_URL}/api/reviews/${product.id}`)
                .then(r => r.json())
                .then(setReviews)
                .catch(() => {});
            }} 
          />
        </div>

      </div>

            {/* ✨ نافذة العرض السريع الاحترافية (Quick View Modal) */}
      {isLightboxOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setIsLightboxOpen(false)}>
          
          {/* زر الإغلاق */}
          <button 
            className="absolute top-4 right-4 text-white text-3xl cursor-pointer z-10 active:scale-90 transition" 
            onClick={() => setIsLightboxOpen(false)}
          >
            ✕
          </button>

          {/* صندوق المحتوى (يمنع الإغلاق عند الضغط بداخله) */}
          <div 
            className="relative w-full max-w-5xl bg-white rounded-xl overflow-hidden flex flex-col md:flex-row h-[85vh] md:h-[80vh]" 
            onClick={e => e.stopPropagation()}
          >
            
            {/* قسم الصور (يسار/أعلى) */}
            <div className="flex-1 flex flex-col bg-temu-offwhite p-4 relative">
              <div 
                className="relative w-full flex-1 min-h-[250px]"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <Image 
                  src={mainImageSrc} 
                  alt={product.title} 
                  fill 
                  className="object-contain" 
                />
                
                {/* أسهم التنقل بين الصور */}
                {galleryImages.length > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1)} 
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-md active:scale-90 transition cursor-pointer"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button 
                      onClick={() => setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1)} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white p-2 rounded-full shadow-md active:scale-90 transition cursor-pointer"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                  </>
                )}
              </div>

              {/* شريط الصور المصغرة (Thumbnails) */}
              <div className="flex gap-2 w-full overflow-x-auto pb-2 scrollbar-hide justify-center mt-2">
                {galleryImages.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => setCurrentImageIndex(idx)} 
                    className={`relative w-14 h-14 shrink-0 rounded-md overflow-hidden cursor-pointer border-2 transition ${currentImageIndex === idx ? 'border-temu-orange' : 'border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    <Image src={img} alt="Thumbnail" fill sizes="56px" className="object-contain p-1" />
                  </div>
                ))}
              </div>
            </div>

            {/* قسم الشراء والتفاصيل (يمين/أسفل) */}
            <div className="w-full md:w-1/3 p-6 flex flex-col justify-between bg-white">
              <div>
                <h2 className="text-lg font-extrabold text-temu-black line-clamp-3 mb-2">{product.title}</h2>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-black text-temu-error">${safePrice.toFixed(2)}</span>
                  {safeOriginalPrice > safePrice && (
                    <span className="text-sm text-temu-gray-light line-through">${safeOriginalPrice.toFixed(2)}</span>
                  )}
                </div>
                
                {/* ملخص الاختيارات */}
                <div className="text-xs text-temu-gray-text space-y-1 mb-4 bg-temu-offwhite p-3 rounded-lg">
                  {selectedColor && <p>🎨 Color: <span className="font-bold text-temu-black">{selectedColor}</span></p>}
                  {selectedSize && <p>📏 Size: <span className="font-bold text-temu-black">{selectedSize}</span></p>}
                  <p>📦 Quantity: <span className="font-bold text-temu-black">{quantity}</span></p>
                </div>
              </div>

              {/* أزرار الشراء */}
              <div className="space-y-2">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    handleAddToCart(); 
                    setIsLightboxOpen(false); 
                  }} 
                  className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-black py-3.5 rounded-lg active:scale-95 transition flex items-center justify-center gap-2 shadow-md"
                >
                  🛒 Add to Cart
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setIsLightboxOpen(false); 
                  }} 
                  className="w-full bg-white border border-temu-gray-border text-temu-black font-bold py-3 rounded-lg active:scale-95 transition"
                >
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Social Proof Notification */}
      <LivePurchaseNotification productName={product.title} />
    </main>
  );
}