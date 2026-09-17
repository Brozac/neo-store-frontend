'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '../../context/CartContext';
import CountdownTimer from '../../components/CountdownTimer';
import LivePurchaseNotification from '../../components/LivePurchaseNotification';
import BuyButton from '../../components/BuyButton';
import TiltCard from '../../components/TiltCard';
import ReviewForm from '../../components/ReviewForm';
import FrequentlyBoughtTogether from '../../components/FrequentlyBoughtTogether';
import DeliveryEstimator from '../../components/DeliveryEstimator';

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

interface Review { 
  id: number; 
  author: string; 
  rating: number; 
  content: string; 
  country: string; 
  created_at: string;
  images?: string[]; 
}

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
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [stickyAdded, setStickyAdded] = useState(false);
  const [mainAdded, setMainAdded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const touchStartX = useRef(0);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const mainCtaRef = useRef<HTMLDivElement>(null);

  const defaultImage = '/icon-512.png'; 

  const galleryImages = useMemo(() => {
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      return product.images.filter(img => img && typeof img === 'string');
    }
    return [product.image_url || product.image || defaultImage];
  }, [product, defaultImage]);

  const mainImageSrc = galleryImages[currentImageIndex] || galleryImages[0] || defaultImage;
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (thumbnailsRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      thumbnailsRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const matchedVariant = useMemo(() => {
    if (!product.variants) return null;
    try {
      const parsedVariants = typeof product.variants === 'string' 
        ? JSON.parse(product.variants) 
        : product.variants;

      if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) return null;

      const exactMatch = parsedVariants.find((v: any) => {
        const name = (v.variantKey || v.variantNameEn || '').toLowerCase();
        const matchesColor = selectedColor ? name.includes(selectedColor.toLowerCase()) : true;
        const matchesSize = selectedSize ? new RegExp(`\\b${selectedSize}\\b`, 'i').test(name) : true;
        return matchesColor && matchesSize;
      });
      if (exactMatch) return exactMatch;

      const sizeMatch = parsedVariants.find((v: any) => {
        const name = (v.variantKey || v.variantNameEn || '').toLowerCase();
        return selectedSize ? new RegExp(`\\b${selectedSize}\\b`, 'i').test(name) : false;
      });
      if (sizeMatch) return sizeMatch;

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

    fetch(`${API_BASE_URL}/api/reviews/${product.id}`, { signal: controller.signal })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setReviews(data); })
      .catch(() => {});

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [product.id, API_BASE_URL]);

  useEffect(() => {
    const target = mainCtaRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting && window.scrollY > 400);
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const parsePrice = (price: any) => Number(price) || 0;
  const stripHtml = (html?: string) => html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
  const getColorHex = (c: string) => c.startsWith('#') ? c : '#888888';

  const safePrice = parsePrice(product.price);
  const safeOriginalPrice = parsePrice(product.original_price);
  const discountPct = safeOriginalPrice > safePrice 
    ? Math.round(((safeOriginalPrice - safePrice) / safeOriginalPrice) * 100) 
    : 0;

  const discountedUnitPrice = useMemo(() => {
    if (quantity >= 3) return safePrice * 0.75;
    if (quantity === 2) return safePrice * 0.85;
    return safePrice;
  }, [quantity, safePrice]);

  const handleToggleFavorite = (productId: string | number) => {
    const idStr = String(productId);
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    const newFavorites = favorites.includes(idStr) 
      ? favorites.filter((f: string) => f !== idStr) 
      : [...favorites, idStr];
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    setFavoriteIds(newFavorites);
  };

const handleAddToCart = () => {
  const resolvedVid = matchedVariant?.vid || '';
  
  addToCart({
    id: product.id,
    title: product.title,
    name: product.title,
    price: parseFloat(discountedUnitPrice.toFixed(2)),
    quantity,
    image: mainImageSrc,
    image_url: mainImageSrc,
    color: selectedColor,
    size: selectedSize,
    vid: resolvedVid
  }, quantity);
  
  // 🎯 Mission #15 — feedback فوري (نفس نمط stickyAdded الموجود)
  setMainAdded(true);
  setTimeout(() => setMainAdded(false), 1500);
};

  const handleTouchStart = (e: React.TouchEvent) => { 
    touchStartX.current = e.touches[0].clientX; 
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isZoomed) return;
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-start">
          
          {/* Visual Gallery */}
          <div className="flex flex-col gap-4">
            <div 
              className="relative w-full aspect-square sm:min-h-[440px] rounded-2xl overflow-hidden bg-white border border-temu-gray-border-light group touch-pan-y cursor-zoom-in shadow-sm flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onClick={() => { setIsLightboxOpen(true); setIsZoomed(false); }}
            >
              {showVideo && product.video_url ? (
                <video src={product.video_url} controls autoPlay className="w-full h-full object-cover" />
              ) : (
                /* ✨ استبدال Image بـ img */
                <img 
                  src={mainImageSrc} 
                  alt={product.title} 
                  className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-105" 
                />
              )}

              {galleryImages.length > 1 && !showVideo && (
                <>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1); 
                    }} 
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2.5 rounded-full shadow-md transition cursor-pointer z-10 active:scale-90"
                    aria-label="Previous Image"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1); 
                    }} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2.5 rounded-full shadow-md transition cursor-pointer z-10 active:scale-90"
                    aria-label="Next Image"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>
                </>
              )}

              {!showVideo && (
                <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md pointer-events-none">
                  <span></span> Tap to Zoom
                </div>
              )}
            </div>

            <div className="relative w-full flex items-center group/thumbs">
              
              {galleryImages.length > 4 && (
                <button
                  type="button"
                  onClick={() => scrollThumbnails('left')}
                  className="absolute -left-2 z-10 bg-white/90 hover:bg-white text-black w-8 h-8 rounded-full shadow-md border border-gray-200 flex items-center justify-center cursor-pointer transition-all opacity-80 hover:opacity-100 active:scale-90"
                  aria-label="Scroll Left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
              )}

              <div 
                ref={thumbnailsRef}
                className="flex gap-2.5 w-full overflow-x-auto p-2 scrollbar-hide touch-pan-x items-center scroll-smooth"
              >
                {product.video_url && (
                  <div 
                    onClick={() => setShowVideo(true)} 
                    className={`relative aspect-square w-16 sm:w-20 rounded-xl overflow-hidden cursor-pointer border-2 transition flex items-center justify-center bg-black shrink-0 ${showVideo ? 'border-temu-orange' : 'border-transparent opacity-70'}`}
                  >
                    <span className="text-white text-xl">▶</span>
                  </div>
                )}
                {galleryImages.map((img, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { setCurrentImageIndex(idx); setShowVideo(false); }} 
                    className={`relative aspect-square w-16 sm:w-20 rounded-xl overflow-hidden cursor-pointer border-2 transition-all duration-200 bg-white shrink-0 ${
                      !showVideo && currentImageIndex === idx 
                        ? 'border-[#8B78C6] shadow-md ring-2 ring-[#8B78C6]/30 scale-95' 
                        : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-300'
                    }`}
                  >
                    {/* ✨ استبدال Image بـ img */}
                    <img src={img} alt="Thumbnail" className="w-full h-full object-contain p-1" />
                  </div>
                ))}
              </div>

              {galleryImages.length > 4 && (
                <button
                  type="button"
                  onClick={() => scrollThumbnails('right')}
                  className="absolute -right-2 z-10 bg-white/90 hover:bg-white text-black w-8 h-8 rounded-full shadow-md border border-gray-200 flex items-center justify-center cursor-pointer transition-all opacity-80 hover:opacity-100 active:scale-90"
                  aria-label="Scroll Right"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              )}
            </div>
          </div>

          {/* Pricing & Customization Box */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-temu-black tracking-tight mb-3 leading-tight">
                {product.title}
              </h1>
              
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

              {product.colors && product.colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-xs uppercase font-extrabold text-temu-black mb-2">
                    Color: <span className="text-temu-gray-text font-semibold">{selectedColor}</span>
                  </label>
                  <div className="flex gap-2.5 flex-wrap">
                    {product.colors.map((col, idx) => (
                      <button 
                        key={idx} 
                        type="button"
                        onClick={() => setSelectedColor(col)} 
                        className={`w-9 h-9 rounded-full transition cursor-pointer border-2 active:scale-90 ${selectedColor === col ? 'border-temu-orange scale-110 shadow' : 'border-gray-200'}`}
                      >
                        <span style={{ backgroundColor: getColorHex(col) }} className="block w-full h-full rounded-full border border-black/10"></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs uppercase font-extrabold text-temu-black">Size</label>
                    <button type="button" onClick={() => setActiveTab('size')} className="text-xs text-temu-orange font-bold cursor-pointer hover:underline">
                      Size Guide ↗
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((sz) => (
                      <button 
                        key={sz} 
                        type="button"
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
            <div ref={mainCtaRef} className="space-y-4 pt-2 border-t border-gray-200">
              <CountdownTimer />
              <DeliveryEstimator />

              <div className="space-y-2.5 my-6">
                <label className="block text-xs uppercase font-black text-gray-800 tracking-wider">
                  ⚡ Exclusive Bundle Savings:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div 
                    onClick={() => setQuantity(1)}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition active:scale-95 flex flex-col justify-between text-left ${
                      quantity === 1 
                        ? 'border-[#8B78C6] bg-purple-50/50 shadow-sm' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-gray-900">Standard</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${quantity === 1 ? 'border-[#8B78C6] bg-[#8B78C6]' : 'border-gray-300'}`}>
                        {quantity === 1 && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">Buy 1 Unit</span>
                    <span className="text-sm font-black text-gray-900 mt-1">${safePrice.toFixed(2)}</span>
                  </div>

                  <div 
                    onClick={() => setQuantity(2)}
                    className={`relative p-3 rounded-2xl border-2 cursor-pointer transition active:scale-95 flex flex-col justify-between text-left ${
                      quantity === 2 
                        ? 'border-[#8B78C6] bg-purple-50/50 shadow-sm' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow">
                      Popular 🔥
                    </span>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-[#8B78C6]">Save 15%</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${quantity === 2 ? 'border-[#8B78C6] bg-[#8B78C6]' : 'border-gray-300'}`}>
                        {quantity === 2 && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">Buy 2 Units</span>
                    <span className="text-sm font-black text-[#FF6B9D] mt-1">${(safePrice * 0.85 * 2).toFixed(2)}</span>
                  </div>

                  <div 
                    onClick={() => setQuantity(3)}
                    className={`relative p-3 rounded-2xl border-2 cursor-pointer transition active:scale-95 flex flex-col justify-between text-left ${
                      quantity >= 3 
                        ? 'border-[#8B78C6] bg-purple-50/50 shadow-sm' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow">
                      Best Value 
                    </span>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-xs text-emerald-600">Save 25%</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${quantity >= 3 ? 'border-[#8B78C6] bg-[#8B78C6]' : 'border-gray-300'}`}>
                        {quantity >= 3 && <span className="w-1.5 h-1.5 bg-white rounded-full"></span>}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-600">Buy 3 Units</span>
                    <span className="text-sm font-black text-emerald-600 mt-1">${(safePrice * 0.75 * 3).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
  type="button"
  onClick={handleAddToCart} 
  className={`flex-1 text-white font-black py-4 px-6 rounded-temu-sm transition flex items-center justify-center gap-3 text-base cursor-pointer active:scale-95 shadow-lg ${
    mainAdded 
      ? 'bg-emerald-600 shadow-emerald-600/20' 
      : 'bg-temu-orange hover:bg-temu-orange-bright shadow-temu-orange/20'
  }`}
>
  {mainAdded ? (
    <><span>✓</span> Added to Bag — View Cart →</>
  ) : (
    <><span></span> Add to Cart</>
  )}
</button>
                <button 
                  type="button"
                  onClick={() => handleToggleFavorite(product.id)} 
                  className={`w-14 h-14 shrink-0 flex items-center justify-center border-2 rounded-temu-sm transition cursor-pointer active:scale-90 ${isCurrentProductFavorited ? 'border-temu-error bg-temu-error text-white' : 'border-temu-gray-border bg-white text-temu-gray-text hover:text-temu-error'}`}
                  aria-label="Save to Wishlist"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isCurrentProductFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>
                </button>
              </div>

              <BuyButton 
                product={{ 
                  id: product.id, 
                  title: product.title, 
                  name: product.title,
                  price: parseFloat(discountedUnitPrice.toFixed(2)), 
                  image: mainImageSrc,
                  color: selectedColor,
                  size: selectedSize,
                  quantity: quantity,
                  vid: matchedVariant?.vid || ''
                }} 
              />

              <div className="flex items-center gap-3 bg-white p-3 rounded-temu-sm border border-temu-gray-border-light shadow-sm">
                <div className="flex -space-x-2.5">
                  {STATIC_AVATARS.map((av, idx) => (
                    <img key={idx} src={av} className="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm" alt="Buyer" />
                  ))}
                </div>
                <p className="text-xs text-temu-gray-text font-medium">
                  <span className="font-extrabold text-temu-black">{purchaseCount} shoppers</span> purchased this in the last 24 hours
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2 text-[11px] text-temu-gray-text font-semibold border-t border-temu-gray-border-light">
                <div> Free Shipping</div>
                <div> 30-Day Guarantee</div>
                <div> Secure Checkout</div>
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
                type="button"
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

        {relatedProducts.length > 0 && (
          <FrequentlyBoughtTogether 
            currentProduct={product} 
            relatedProducts={relatedProducts} 
          />
        )}

        {/* You May Also Like */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-temu-gray-border-light pt-10">
            <h2 className="text-lg font-black text-temu-black mb-6">You May Also Like</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((p) => (
                <TiltCard key={p.id}>
                  <Link href={`/products/${p.id}`} className="group flex flex-col h-full bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden active:scale-95 transition">
                    <div className="relative aspect-square overflow-hidden bg-gray-50">
                      {/* ✨ استبدال Image بـ img */}
                      <img src={p.image_url || p.image || defaultImage} alt={p.title} className="w-full h-full object-contain p-2 transition group-hover:scale-105" />
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

        {/* Customer Reviews */}
        <div className="border-t border-temu-gray-border-light pt-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-black text-temu-black">Customer Reviews ({reviews.length})</h2>
            <span className="text-xs font-bold text-temu-green">Verified Worldwide Purchases ✔</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {reviews.slice(0, 6).map((rev) => (
              <div key={rev.id} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-gray-900">{rev.author} ({rev.country || 'Verified Buyer'})</span>
                  <span className="text-amber-400 text-xs">{'★'.repeat(rev.rating)}</span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{rev.content}</p>

                {rev.images && Array.isArray(rev.images) && rev.images.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    {rev.images.map((photoUrl, pIdx) => (
                      <div 
                        key={pIdx} 
                        className="relative w-14 h-14 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 cursor-pointer hover:scale-105 transition"
                        onClick={() => window.open(photoUrl, '_blank')}
                        title="Click to view full photo"
                      >
                        {/* ✨ استبدال Image بـ img */}
                        <img src={photoUrl} alt="Buyer proof photo" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                <span className="text-[10px] text-gray-400 block font-mono">
                  {new Date(rev.created_at).toLocaleDateString()}
                </span>
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

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 bg-black/95 z-[200] flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md animate-fade-in select-none"
          onClick={() => { setIsLightboxOpen(false); setIsZoomed(false); }}
        >
          <div className="flex justify-between items-center w-full max-w-6xl mx-auto z-20" onClick={e => e.stopPropagation()}>
            <div className="bg-white/10 backdrop-blur-md text-white font-mono text-xs px-3.5 py-1.5 rounded-full border border-white/10 shadow-sm">
              {currentImageIndex + 1} / {galleryImages.length}
            </div>

            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setIsZoomed(!isZoomed)}
                className="bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-full border border-white/10 transition cursor-pointer text-xs font-bold active:scale-95 flex items-center gap-1.5"
                title={isZoomed ? "Reset Zoom" : "Zoom In (2.5x)"}
              >
                <span>🔍</span> {isZoomed ? 'Reset (1x)' : 'Zoom (2.5x)'}
              </button>

              <button 
                type="button"
                onClick={() => { setIsLightboxOpen(false); setIsZoomed(false); }}
                className="bg-white/20 hover:bg-white/40 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold transition cursor-pointer active:scale-90"
                aria-label="Close Lightbox"
              >
                ✕
              </button>
            </div>
          </div>

          <div 
            className="relative flex-1 w-full max-w-5xl mx-auto flex items-center justify-center overflow-hidden my-2"
            onClick={e => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className={`relative w-full h-full flex items-center justify-center transition-transform duration-300 ${
                isZoomed ? 'scale-175 sm:scale-225 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              onClick={() => setIsZoomed(!isZoomed)}
            >
              {/* ✨ استبدال Image بـ img */}
              <img 
                src={mainImageSrc} 
                alt={product.title} 
                className="w-full h-full object-contain"
              />
            </div>

            {galleryImages.length > 1 && !isZoomed && (
              <>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === 0 ? galleryImages.length - 1 : prev - 1);
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition active:scale-90 cursor-pointer z-10"
                  aria-label="Previous Photo"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(prev => prev === galleryImages.length - 1 ? 0 : prev + 1);
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition active:scale-90 cursor-pointer z-10"
                  aria-label="Next Photo"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              </>
            )}
          </div>

          <div className="w-full max-w-xl mx-auto z-20 overflow-x-auto scrollbar-hide py-1" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 justify-center">
              {galleryImages.map((img, idx) => (
                <div 
                  key={idx}
                  onClick={() => { setCurrentImageIndex(idx); setIsZoomed(false); }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden cursor-pointer border-2 transition shrink-0 ${
                    currentImageIndex === idx ? 'border-temu-orange scale-105 shadow-md' : 'border-white/20 opacity-50 hover:opacity-100'
                  }`}
                >
                  {/* ✨ استبدال Image بـ img */}
                  <img src={img} alt="Thumb" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <LivePurchaseNotification productName={product.title} />
      
      {/* Sticky Buy Bar */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-[0_-8px_25px_rgba(0,0,0,0.08)] p-3 sm:p-4 transition-all duration-300 transform ${
          showStickyBar ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          
          <div 
            onClick={() => window.scrollTo({ top: 400, behavior: 'smooth' })}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            title="Tap to review choices"
          >
            <div className="relative w-12 h-12 rounded-xl bg-gray-50 overflow-hidden border border-gray-200 shrink-0">
              {/* ✨ استبدال Image بـ img */}
              <img 
                src={mainImageSrc} 
                alt={product.title} 
                className="w-full h-full object-contain p-1" 
              />
            </div>
            
            <div className="min-w-0 pr-1">
              <p className="text-xs font-black text-gray-900 truncate">{product.title}</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-sm font-black text-[#FF6B9D]">${safePrice.toFixed(2)}</span>
                {safeOriginalPrice > safePrice && (
                  <span className="text-[10px] text-gray-400 line-through">${safeOriginalPrice.toFixed(2)}</span>
                )}
              </div>
              <p className="text-[10px] text-gray-500 font-semibold truncate">
                {selectedColor && `${selectedColor} • `}{selectedSize} • Qty: {quantity}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                handleAddToCart();
                setStickyAdded(true);
                setTimeout(() => setStickyAdded(false), 1200);
              }}
              className={`py-3 px-3.5 sm:px-4 rounded-xl font-black text-xs transition active:scale-95 flex items-center gap-1.5 shadow-sm ${
                stickyAdded 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              }`}
            >
              {stickyAdded ? <span>✓ Added</span> : <span>🛒 +Bag</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                const resolvedVid = matchedVariant?.vid || '';
                addToCart({
                  id: product.id,
                  title: product.title,
                  name: product.title,
                  price: parseFloat(discountedUnitPrice.toFixed(2)),
                  quantity,
                  image: mainImageSrc,
                  image_url: mainImageSrc,
                  color: selectedColor,
                  size: selectedSize,
                  vid: resolvedVid
                }, quantity);
                router.push('/cart');
              }}
              className="bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-black py-3 px-4 sm:px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg shadow-[#8B78C6]/25 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>⚡</span> Buy Now
            </button>
          </div>

        </div>
      </div>
    </main>
  );
}