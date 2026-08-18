'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  image: string;
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

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'materials', label: 'Materials' },
  { key: 'size', label: 'Size & Fit' },
  { key: 'shipping', label: 'Shipping & Returns' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params;
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const { addToCart, cart } = useCart();
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('M');

  const [reviews, setReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [showVideo, setShowVideo] = useState(false);
  
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const touchStartX = useRef(0);

  useEffect(() => {
    const favs = JSON.parse(localStorage.getItem('favorites') || '[]');
    setFavoriteIds(favs);
  }, [id]);
  
  const [purchaseCount, setPurchaseCount] = useState(0);

  useEffect(() => {
    if (!product) return;
    setPurchaseCount(getSeedNumber(product.id, 50, 10));
    const interval = setInterval(() => {
      setPurchaseCount((prev) => {
        const change = Math.floor(Math.random() * 7) - 2;
        let newCount = prev + change;
        if (newCount < 5) newCount = 5;
        if (newCount > 150) newCount = 150;
        return newCount;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [product]);

  const handleToggleFavorite = (productId: string | number) => {
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    let newFavorites;

    if (favorites.includes(String(productId))) {
      newFavorites = favorites.filter((favId: string) => favId !== String(productId));
    } else {
      newFavorites = [...favorites, String(productId)];
    }

    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    setFavoriteIds(newFavorites);
  };
  
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);

  const scrollThumbnails = (direction: 'up' | 'down') => {
    if (thumbnailScrollRef.current) {
      const scrollAmount = 64;
      thumbnailScrollRef.current.scrollBy({
        top: direction === 'down' ? scrollAmount : -scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    setLoading(true);
    fetch(`https://neo-store-backend.onrender.com/api/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then((found: Product) => {
        setProduct(found);
        setSelectedImage(found.image || found.image_url || '');
        if (found.colors && found.colors.length > 0) setSelectedColor(found.colors[0]);
        if (found.sizes && found.sizes.length > 0) setSelectedSize(found.sizes[0]);

        fetch(`https://neo-store-backend.onrender.com/api/reviews/${found.id}`)
          .then((res) => res.json())
          .then((revData) => setReviews(revData))
          .catch(() => {});
      })
      .catch((err) => {
        console.error('Error fetching product:', err);
        setProduct(null);
      })
      .finally(() => setLoading(false));

    fetch(`https://neo-store-backend.onrender.com/api/products`)
      .then((res) => res.json())
      .then((data: Product[]) => setAllProducts(data))
      .catch((err) => console.error('Error fetching related products:', err));
  }, [id]);

  const getSeedNumber = (str: string | number, max: number, min: number) => {
    const idStr = String(str);
    let seed = 0;
    for (let i = 0; i < idStr.length; i++) seed += idStr.charCodeAt(i);
    return (seed % (max - min + 1)) + min;
  };

  const parsePrice = (price: number | string | undefined): number => {
    if (price === undefined) return 0;
    if (typeof price === 'number') return price;
    const cleaned = String(price).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const stripHtml = (html?: string): string => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const handleAddToCart = () => {
    if (!product) return;
    const defaultImage = '/placeholder.jpg';
    const imgSrc = selectedImage || product.image || product.image_url || defaultImage;

    let vid = '';
    if (product.variants) {
      try {
        const variants = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
        if (Array.isArray(variants) && variants.length > 0 && variants[0].vid) {
          vid = variants[0].vid;
        }
      } catch (e) {
        console.error('Error parsing variants for vid:', e);
      }
    }

    addToCart({
      id: product.id,
      name: product.title,
      price: parsePrice(product.price),
      quantity: quantity,
      image: imgSrc,
      color: selectedColor,
      size: selectedSize,
      vid: vid,
    });
  };

  const getColorHex = (colorName: string) => {
    if (colorName.startsWith('#')) return colorName;
    const colorMap: Record<string, string> = {
      Black: '#000000', 'Black+Blue': '#1D1E3C', White: '#FFFFFF',
      Pink: '#FFC0CB', Blue: '#0000FF', Red: '#FF0000', Gray: '#808080',
    };
    return colorMap[colorName] || '#CCCCCC';
  };

  const handlePrevImage = () => {
    if (galleryImages.length <= 1 || showVideo) return;
    const currentIndex = galleryImages.findIndex((img) => img === selectedImage);
    const prevIndex = currentIndex === 0 ? galleryImages.length - 1 : currentIndex - 1;
    setSelectedImage(galleryImages[prevIndex] || defaultImage);
  };

  const handleNextImage = () => {
    if (galleryImages.length <= 1 || showVideo) return;
    const currentIndex = galleryImages.findIndex((img) => img === selectedImage);
    const nextIndex = currentIndex === galleryImages.length - 1 ? 0 : currentIndex + 1;
    setSelectedImage(galleryImages[nextIndex] || defaultImage);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (showVideo) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartX.current - touchEndX;
    
    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-6">
        <h1 className="text-2xl font-bold text-temu-black mb-4">Product not found</h1>
        <button onClick={() => router.push('/')} className="bg-temu-orange text-white px-6 py-3 rounded-temu-sm font-bold cursor-pointer active:scale-95">
          Back to Home
        </button>
      </div>
    );
  }

  const defaultImage = '/placeholder.jpg';
  const mainImageSrc = selectedImage || product.image || product.image_url || defaultImage;
  const galleryImages = product.images && product.images.length > 0 ? product.images : [mainImageSrc];

  const colorsList = product.colors || [];
  const sizesList = product.sizes || [];

  const safePrice = parsePrice(product.price);
  const safeOriginalPrice = parsePrice(product.original_price);
  const discountPct = safeOriginalPrice > 0 ? Math.round(((safeOriginalPrice - safePrice) / safeOriginalPrice) * 100) : 0;

  const productForBuyNow = {
    id: product.id,
    title: product.title,
    price: safePrice,
    image: mainImageSrc,
  };

  let relatedProducts = allProducts.filter((p) => p.id !== product.id);
  let sameCategory = relatedProducts.filter((p) => p.category === product.category);

  if (sameCategory.length < 4 && product.category) {
    const baseCategory = product.category.split('-')[0];
    const baseMatch = relatedProducts.filter((p) => p.category?.startsWith(baseCategory));
    sameCategory = Array.from(new Set([...sameCategory, ...baseMatch]));
  }

  if (sameCategory.length < 4) {
    const others = relatedProducts.filter((p) => !sameCategory.includes(p));
    sameCategory = Array.from(new Set([...sameCategory, ...others]));
  }

  const finalRelatedProducts = sameCategory.slice(0, 4);

  // ✨ تعديل قائمة التفاصيل: إضافة المادة والأصل، وحذف النصوص الافتراضية
  const detailBullets: string[] = [];
  if (product.composition) detailBullets.push(`Composition: ${product.composition}`);
  if (product.pattern) detailBullets.push(`Pattern: ${product.pattern}`);
  if (product.chest_pad) detailBullets.push(`Chest pad: ${product.chest_pad}`);
  if (product.wires) detailBullets.push(`Wires: ${product.wires}`);
  if (product.support) detailBullets.push(`Support: ${product.support}`);
  if (product.origin) detailBullets.push(`Origin: ${product.origin}`);

  const isCurrentProductFavorited = favoriteIds.includes(String(product.id));

  return (
    <main className="min-h-screen bg-temu-offwhite pb-32 font-sans">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-12">
        
        {/* Breadcrumbs */}
        <div className="flex flex-col gap-2 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-temu-gray-light hover:text-temu-black font-medium text-sm transition cursor-pointer active:scale-95 w-fit"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
          </button>
          
          <div className="text-sm text-temu-gray-light flex items-center gap-2 flex-wrap">
            <Link href="/" className="hover:text-temu-orange cursor-pointer">Home</Link>
            <span>/</span>
            <Link href={`/category/${product.category?.split('/')[0] || 'all'}`} className="hover:text-temu-orange cursor-pointer capitalize">
              {product.category?.split('/')[0] || 'Products'}
            </Link>
            <span>/</span>
            <span className="text-temu-black font-medium truncate max-w-50 sm:max-w-full">{product.title}</span>
          </div>
        </div>

        {/* Product top section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-stretch">
          {/* Gallery */}
          <div className="flex flex-col gap-4 h-full">
            <div 
              className="relative flex-1 h-full min-h-70 sm:min-h-95 md:min-h-125 rounded-temu-sm overflow-hidden bg-white border border-temu-gray-border-light group touch-pan-y"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {showVideo && product.video_url ? (
                <video 
                  src={product.video_url} 
                  controls 
                  autoPlay 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={mainImageSrc}
                  alt={product.title}
                  fill
                  unoptimized={mainImageSrc.includes('localhost') || mainImageSrc.includes('127.0.0.1')}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain transition-transform duration-500 group-hover:scale-105 group-active:scale-105"
                  priority
                />
              )}

              {galleryImages.length > 1 && !showVideo && (
                <>
                  <button
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2 rounded-full shadow-md opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer z-10 active:scale-90"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2 rounded-full shadow-md opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer z-10 active:scale-90"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </>
              )}

              {!showVideo && (
                <button
                  onClick={() => window.open(mainImageSrc, '_blank')}
                  title="View full size"
                  className="absolute bottom-4 right-4 bg-white rounded-full p-2.5 shadow-md hover:scale-105 transition cursor-pointer z-10 active:scale-90"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              )}
            </div>

            <div className="flex gap-2 w-full overflow-x-auto pb-1 scrollbar-hide touch-pan-x sm:overflow-visible">
  
              {product.video_url && (
                <div
                  onClick={() => setShowVideo(true)}
                  className={`relative aspect-square w-16 shrink-0 sm:w-auto sm:flex-1 sm:shrink rounded-temu-sm overflow-hidden cursor-pointer border-2 transition flex items-center justify-center bg-black active:scale-95 ${
                    showVideo ? 'border-temu-orange' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white" className="opacity-80">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </div>
              )}

              {galleryImages.map((img, idx) => {
                const imgSrc = img || defaultImage;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setSelectedImage(imgSrc);
                      setShowVideo(false);
                    }}
                    className={`relative aspect-square w-16 shrink-0 sm:w-auto sm:flex-1 sm:shrink rounded-temu-sm overflow-hidden cursor-pointer border-2 transition bg-white active:scale-95 ${
                      !showVideo && selectedImage === imgSrc ? 'border-temu-orange' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <Image 
                      src={imgSrc} 
                      alt="Thumbnail" 
                      fill 
                      sizes="100px" 
                      className="object-contain p-1" 
                      unoptimized={imgSrc.includes('localhost') || imgSrc.includes('127.0.0.1')} 
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Purchase info */}
          <div className="flex flex-col justify-between">
            <div>
              {typeof product.sales_count === 'number' && product.sales_count < 50 && (
                <span className="inline-block text-[11px] font-bold tracking-wide uppercase bg-temu-yellow text-temu-black px-3 py-1 rounded-temu-sm mb-4">
                  New Arrival
                </span>
              )}

              <h1 className="text-2xl md:text-3xl font-bold text-temu-black tracking-tight mb-3 leading-tight">{product.title}</h1>

              <div className="flex items-center gap-2 mb-6">
                <span className="text-temu-orange text-sm">★★★★★</span>
                <span className="text-sm font-bold text-temu-black">{(4 + getSeedNumber(product.id, 9, 0) / 10).toFixed(1)}</span>
                <span className="text-sm text-temu-gray-light">({reviews.length > 0 ? reviews.length : getSeedNumber(product.id, 250, 15)} reviews)</span>
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-3xl font-bold text-temu-error">${safePrice.toFixed(2)}</span>
                {safeOriginalPrice > 0 && (
                  <>
                    <span className="text-lg text-temu-gray-light line-through">${safeOriginalPrice.toFixed(2)}</span>
                    <span className="bg-temu-black text-white text-xs font-bold px-2.5 py-1 rounded-temu-sm">{discountPct}% OFF</span>
                  </>
                )}
              </div>

              {colorsList.length > 0 && (
                <div className="mb-7">
                  <label className="block text-sm font-bold text-temu-black mb-3">
                    Color: <span className="font-normal text-temu-gray-text">{selectedColor}</span>
                  </label>
                  <div className="flex gap-3 flex-wrap">
                    {colorsList.map((col, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedColor(col)}
                        className={`w-9 h-9 rounded-full transition cursor-pointer border-2 active:scale-90 ${
                          selectedColor === col ? 'border-temu-orange scale-110' : 'border-temu-gray-border'
                        }`}
                        title={col}
                      >
                        <span
                          style={{ backgroundColor: getColorHex(col) }}
                          className="block w-full h-full rounded-full border border-black/5"
                        ></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {sizesList.length > 0 && (
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-temu-black">Size</label>
                    <button onClick={() => setActiveTab('size')} className="text-xs text-temu-gray-text font-semibold cursor-pointer hover:text-temu-orange hover:underline flex items-center gap-1 active:scale-95">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="7" width="18" height="10" rx="1"></rect>
                        <line x1="7" y1="7" x2="7" y2="10"></line>
                        <line x1="11" y1="7" x2="11" y2="10"></line>
                        <line x1="15" y1="7" x2="15" y2="10"></line>
                      </svg>
                      Size guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizesList.map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setSelectedSize(sz)}
                        className={`w-14 h-14 rounded-temu-sm font-bold text-sm transition cursor-pointer border-2 active:scale-90 ${
                          selectedSize === sz ? 'border-temu-orange bg-temu-orange text-white' : 'border-temu-gray-border text-temu-black hover:border-temu-gray-text'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2">
              <div className="bg-temu-yellow-soft border border-temu-gold p-3 rounded-temu-sm mb-4">
                <p className="text-xs font-bold text-temu-error flex items-center justify-center gap-2 animate-pulse">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  {getSeedNumber(product.id, 45, 12)} people are viewing this right now
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
                    <div className="bg-temu-error h-full rounded-full" style={{ width: `${80 + getSeedNumber(product.id, 15, 0)}%` }}></div>
                  </div>
                  <span className="text-[10px] font-bold text-temu-error whitespace-nowrap">
                    Only {getSeedNumber(product.id, 10, 2)} left!
                  </span>
                </div>
              </div>

              <CountdownTimer />

              {/* Quantity */}
              <div className="flex items-center gap-4 mb-4 mt-4">
                <span className="text-sm font-bold text-temu-black">Quantity:</span>
                <div className="flex items-center border border-temu-gray-border rounded-temu-sm overflow-hidden">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                    className="px-4 py-2 text-lg font-bold text-temu-gray-text hover:bg-temu-offwhite active:scale-90 transition cursor-pointer"
                  >-</button>
                  <span className="px-6 py-2 font-bold text-temu-black border-x border-temu-gray-border bg-white">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)} 
                    className="px-4 py-2 text-lg font-bold text-temu-gray-text hover:bg-temu-offwhite active:scale-90 transition cursor-pointer"
                  >+</button>
                </div>
              </div>

              <div className="flex gap-3 mt-3 mb-3">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold py-4 px-6 rounded-temu-sm transition flex items-center justify-center gap-3 text-base cursor-pointer active:scale-95"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                  Add to Cart
                </button>
                
                <button 
                  onClick={() => handleToggleFavorite(product.id)}
                  className={`w-14 h-14 shrink-0 flex items-center justify-center border-2 rounded-temu-sm transition cursor-pointer active:scale-90 ${
                    isCurrentProductFavorited 
                      ? 'border-temu-error bg-temu-error text-white shadow-sm' 
                      : 'border-temu-gray-border text-temu-gray-text hover:border-temu-error hover:text-temu-error'
                  }`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={isCurrentProductFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
                  </svg>
                </button>
              </div>

              <div className="mb-6">
                <BuyButton product={productForBuyNow} />
              </div>

              {/* Social Proof */}
              <div className="flex items-center gap-3 mb-6 bg-temu-offwhite p-3 rounded-temu-sm border border-temu-gray-border-light">
                <div className="flex -space-x-3">
                  <img src="https://i.pravatar.cc/150?img=12" className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="user" />
                  <img src="https://i.pravatar.cc/150?img=32" className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="user" />
                  <img src="https://i.pravatar.cc/150?img=45" className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="user" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-temu-orange text-white text-[10px] flex items-center justify-center font-bold">
                    +{Math.max(0, purchaseCount - 3)}
                  </div>
                </div>
                <p className="text-xs text-temu-gray-text font-medium">
                  <span className="font-bold text-temu-black">{purchaseCount}</span> other people purchased it today
                </p>
              </div>

              {/* Trust Badges */}
              <div className="pt-6 mt-2 border-t border-temu-gray-border-light">
                <div className="grid grid-cols-3 gap-2 text-center mb-6">
                  <div className="flex flex-col items-center gap-1 text-[11px] text-temu-gray-text font-medium">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-temu-green">
                      <rect x="1" y="3" width="15" height="13"></rect>
                      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                      <circle cx="5.5" cy="18.5" r="2.5"></circle>
                      <circle cx="18.5" cy="18.5" r="2.5"></circle>
                    </svg>
                    Worldwide shipping
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[11px] text-temu-gray-text font-medium">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-temu-green">
                      <polyline points="1 4 1 10 7 10"></polyline>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Easy Returns
                  </div>
                  <div className="flex flex-col items-center gap-1 text-[11px] text-temu-gray-text font-medium">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-temu-green">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    Secure Payment
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 bg-temu-offwhite p-4 rounded-temu-sm border border-temu-gray-border-light">
                  <div className="flex items-center gap-2 text-temu-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                      <polyline points="9 12 11 14 15 10"></polyline>
                    </svg>
                    <p className="text-sm font-bold text-temu-black">Pay confidently with our secure methods</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                    <img src="/logos/stripe.png" alt="Stripe" className="h-6 w-auto object-contain opacity-70 hover:opacity-100 transition" />
                    <img src="/logos/paysera.png" alt="Paysera" className="h-6 w-auto object-contain opacity-70 hover:opacity-100 transition" />
                    <img src="/logos/usdt.png" alt="USDT" className="h-8 w-auto object-contain opacity-70 hover:opacity-100 transition" />
                    <img src="/logos/usdc.png" alt="USDC" className="h-8 w-auto object-contain opacity-70 hover:opacity-100 transition" />
                    <img src="/logos/nowpayments.png" alt="NowPayments" className="h-8 w-auto object-contain opacity-70 hover:opacity-100 transition" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

                {/* Tabs */}
        <div className="border-t border-temu-gray-border-light pt-10">
          <div className="flex gap-8 border-b border-temu-gray-border-light mb-8 overflow-x-auto scrollbar-hide touch-pan-x">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`pb-4 text-sm font-bold whitespace-nowrap transition cursor-pointer border-b-2 -mb-px active:scale-95 ${
                  activeTab === tab.key ? 'border-temu-orange text-temu-orange' : 'border-transparent text-temu-gray-light hover:text-temu-gray-text'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-start">
            <div>
              {activeTab === 'details' && (
                <>
                  {/* ✨ إضافة عنوان واضح للوصف */}
                  <h3 className="text-lg font-extrabold text-temu-black mb-4">Product Information</h3>
                  <p className="text-sm text-temu-gray-text leading-relaxed mb-6">
                    {product.description
                      ? stripHtml(product.description)
                      : `High-quality product crafted with attention to detail. Designed to provide the best experience for our customers${
                          product.store_name ? ` at ${product.store_name}` : ''
                        }.`}
                  </p>
                  {detailBullets.length > 0 && (
                    <ul className="space-y-3">
                      {detailBullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-temu-gray-text">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-temu-green">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {activeTab === 'materials' && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 text-sm">
                  {product.material && (
                    <div>
                      <span className="text-temu-gray-light block mb-1">Material</span>
                      <span className="font-bold text-temu-black">{product.material}</span>
                    </div>
                  )}
                  {product.composition && (
                    <div>
                      <span className="text-temu-gray-light block mb-1">Composition</span>
                      <span className="font-bold text-temu-black">{product.composition}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-temu-gray-light block mb-1">Origin</span>
                    <span className="font-bold text-temu-black">{product.origin || 'China'}</span>
                  </div>
                  <div>
                    <span className="text-temu-gray-light block mb-1">Support</span>
                    <span className="font-bold text-temu-black">{product.support || '24/7'}</span>
                  </div>
                </div>
              )}

              {activeTab === 'size' && (
                <div className="text-sm text-temu-gray-text leading-relaxed space-y-4">
                  <p>
                    {sizesList.length > 0
                      ? `Available in ${sizesList.join(', ')}. If you're between sizes, we recommend sizing up for a relaxed fit.`
                      : 'This item is true to size. Refer to your usual size when ordering.'}
                  </p>
                  {product.instruction && <p>{product.instruction}</p>}
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="text-sm text-temu-gray-text leading-relaxed space-y-4">
                  <p>Worldwide shipping available. Orders are processed within 1–2 business days.</p>
                  
                  <div className="bg-temu-offwhite p-4 rounded-temu-sm border border-temu-gray-border-light">
                    <h4 className="font-bold text-temu-black mb-3 text-center">Estimated Delivery Times</h4>
                    <ul className="space-y-2 text-xs">
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold">DHL Official</span>
                        <span>3-7 days</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold">CJPacket Fast Ordinary</span>
                        <span>4-9 days</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold">USPS</span>
                        <span>5-9 days</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold">CJPacket Ordinary</span>
                        <span>8-12 days</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold">YunExpress Sensitive</span>
                        <span>8-15 days</span>
                      </li>
                      <li className="flex justify-between border-b border-gray-100 pb-1">
                        <span className="font-bold">CJPacket Sensitive</span>
                        <span>10-15 days</span>
                      </li>
                      <li className="flex justify-between">
                        <span className="font-bold">CJPacket Liquid Line</span>
                        <span>20-60 days</span>
                      </li>
                    </ul>
                  </div>

                  <p>Returns are accepted within 30 days of delivery, provided the item is unused and in its original packaging.</p>
                </div>
              )}
            </div>

            {/* ✨ إضافة عنوان واضح للصورة (في نفس مستوى Product Information) */}
            <div>
              <h3 className="text-lg font-extrabold text-temu-black mb-4">Product Image</h3>
              <div className="relative aspect-square rounded-temu-sm overflow-hidden bg-white border border-temu-gray-border-light">
                <Image
                  src={galleryImages[detailImageIndex] || mainImageSrc}
                  alt={product.title}
                  fill
                  unoptimized={(galleryImages[detailImageIndex] || mainImageSrc).includes('localhost') || (galleryImages[detailImageIndex] || mainImageSrc).includes('127.0.0.1')}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain"
                />
                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={() => setDetailImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2 rounded-full shadow-sm transition cursor-pointer active:scale-90"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                    </button>
                    <button
                      onClick={() => setDetailImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-temu-black p-2 rounded-full shadow-sm transition cursor-pointer active:scale-90"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* You May Also Like */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-temu-gray-border-light pt-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-temu-black">You May Also Like</h2>
              <Link href="/" className="text-sm font-semibold text-temu-gray-text hover:text-temu-orange transition flex items-center gap-1 active:scale-95">
                View All
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {finalRelatedProducts.map((p) => {
                const relPrice = parsePrice(p.price);
                const relImg = p.image || p.image_url || '/placeholder.jpg';
                const isRelFavorited = favoriteIds.includes(String(p.id));
                
                return (
                  <TiltCard key={p.id}>
                    <Link href={`/products/${p.id}`} className="group cursor-pointer flex flex-col h-full bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden active:scale-95 transition-transform duration-150">
                      <div className="relative aspect-4/5 overflow-hidden bg-temu-offwhite mb-3">
                        <Image 
                          src={relImg} 
                          alt={p.title} 
                          fill 
                          sizes="200px" 
                          className="object-cover transition-transform duration-500 group-hover:scale-105 group-active:scale-105" 
                          unoptimized={relImg.includes('localhost') || relImg.includes('127.0.0.1')} 
                        />
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite(p.id);
                          }}
                          className="absolute top-3 right-3 bg-white/90 hover:bg-white p-2 rounded-full shadow-sm transition cursor-pointer z-10 active:scale-90"
                        >
                          <svg 
                            width="14" 
                            height="14" 
                            viewBox="0 0 24 24" 
                            fill={isRelFavorited ? '#FF6B9D' : 'none'} 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className={isRelFavorited ? 'text-temu-error' : 'text-temu-gray-text hover:text-temu-error'}
                          >
                            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path>
                          </svg>
                        </button>
                      </div>
                      <div className="p-3 pt-0">
                        <h3 className="text-sm font-bold text-temu-dark line-clamp-2 mb-1 group-hover:text-temu-orange transition">{p.title}</h3>
                        <p className="text-temu-error font-bold text-sm">${relPrice.toFixed(2)}</p>
                      </div>
                    </Link>
                  </TiltCard>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="border-t border-temu-gray-border-light pt-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-temu-gray-border-light">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-temu-black">{reviews.length} reviews</h2>
                <span className="text-base font-bold text-temu-orange">
                  {reviews.length > 0 ? `${(reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1)} ★★★★★` : '★★★★★'}
                </span>
              </div>
              <p className="text-xs text-temu-green font-bold mt-1">✔ All reviews are from verified purchases</p>
            </div>
            <div className="w-full md:w-64 space-y-1 text-xs">
              <div className="flex justify-between items-center text-temu-gray-text">
                <span>Small</span>
                <div className="w-32 bg-temu-gray-border-light h-2 rounded-full overflow-hidden">
                  <div className="bg-temu-orange w-[17%] h-full"></div>
                </div>
                <span>17%</span>
              </div>
              <div className="flex justify-between items-center text-temu-gray-text">
                <span>True to size</span>
                <div className="w-32 bg-temu-gray-border-light h-2 rounded-full overflow-hidden">
                  <div className="bg-temu-orange w-[83%] h-full"></div>
                </div>
                <span>83%</span>
              </div>
            </div>
          </div>

          {reviews.length > 0 ? (
            <div className="reviews-carousel">
              {reviews.map((rev) => (
                <div key={rev.id} className="review-card">
                  <div className="flex justify-between text-xs text-temu-gray-light mb-2">
                    <span className="font-bold text-temu-black">
                      {rev.author} in 🇺🇸
                    </span>
                    <span className="text-temu-orange">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-xs text-temu-gray-light mb-3">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-sm text-temu-dark font-medium leading-relaxed">{rev.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-temu-gray-light py-6">No reviews yet. Be the first to review!</p>
          )}
          
          <ReviewForm productId={product.id} onReviewAdded={() => {
            fetch(`https://neo-store-backend.onrender.com/api/reviews/${product.id}`)
              .then((res) => res.json())
              .then((revData) => setReviews(revData))
              .catch(() => {});
          }} />
        </div>

        {/* Store info */}
        <div className="border-t border-temu-gray-border-light pt-10 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <img src="/icon-512.png" alt="Laclarc Store" className="w-16 h-16 rounded-full object-cover border border-temu-gray-border-light" />
            <div>
              <h3 className="font-bold text-temu-black text-lg">{product.store_name || 'Laclarc'}</h3>
              <p className="text-xs text-temu-gray-light">
                Trusted Seller {product.store_sales ? `| ${product.store_sales} Sold` : ''} | 4.9 ★
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="bg-temu-orange text-white font-bold px-4 py-2.5 rounded-temu-sm hover:bg-temu-orange-bright transition text-sm cursor-pointer active:scale-95"
            >
              Visit Store
            </button>
          </div>
        </div>
      </div>

      <LivePurchaseNotification productName={product.title} />
    </main>
  );
}