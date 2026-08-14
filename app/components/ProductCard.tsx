'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image: string;
  image_url?: string;
  description?: string;
  rating?: number;
  sales_count?: number;
  discount?: string;
}

// ✨ استقبال حالة isTouched من الصفحة الرئيسية
interface ProductCardProps {
  product: Product;
  isTouched: boolean;
}

export default function ProductCard({ product, isTouched }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();

  // ✨ النقر على البطاقة يفتح المنتج مباشرة
  const handleCardClick = () => {
    router.push(`/products/${product.id}`);
  };

  // ✨ زر الإضافة للسلة يعمل مباشرة
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    addToCart({
      id: product.id,
      name: product.title,
      price: Number(product.price) || 0,
      quantity: 1,
      image: product.image || product.image_url,
    });
  };

  const safePrice = Number(product.price) || 0;
  let displayOriginalPrice = Number(product.original_price) || 0;
  let discountText = '';

  if (displayOriginalPrice > safePrice) {
    const disc = Math.round(((displayOriginalPrice - safePrice) / displayOriginalPrice) * 100);
    if (disc > 0 && disc < 90) {
      discountText = `${disc}% OFF`;
    } else {
      displayOriginalPrice = 0; 
    }
  }

  if (!discountText && safePrice > 0) {
    const discounts = [15, 20, 25, 30, 40, 50];
    const fakeDiscount = discounts[Number(product.id) % discounts.length];
    displayOriginalPrice = safePrice / (1 - fakeDiscount / 100);
    discountText = `${fakeDiscount}% OFF`;
  }

  const imgSrc = product.image || product.image_url || '/placeholder.jpg';

  return (
    <div 
      // ✨ إضافة data-product-id لتتبع الإصبع + كلاس product-card-wrapper
      data-product-id={String(product.id)}
      className={`product-card-wrapper product-card-animated bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden flex flex-col justify-between group relative cursor-pointer transition-transform duration-300 active:scale-95 ${
        isTouched ? 'is-active' : ''
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => {/* الماوس للكمبيوتر */}}
      onMouseLeave={() => {/* الماوس للكمبيوتر */}}
    >
      <div>
        <div className="relative aspect-square bg-temu-offwhite overflow-hidden">
          <Image
            src={imgSrc}
            alt={product.title || 'Product'}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105 group-active:scale-105"
            priority
          />
          {discountText && (
            <div className="absolute top-2 left-2 bg-temu-yellow text-temu-black text-[10px] font-bold px-2 py-1 rounded-temu-sm shadow-sm">
              {discountText}
            </div>
          )}
        </div>

        <div className="p-3 pb-2">
          <h3 className="text-sm font-semibold text-temu-dark line-clamp-2 mb-2 group-hover:text-temu-orange transition min-h-10">
            {product.title}
          </h3>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-lg font-extrabold text-temu-error">
              ${safePrice.toFixed(2)}
            </span>
            {displayOriginalPrice > 0 && (
              <span className="text-xs text-temu-gray-light line-through">
                ${displayOriginalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 pt-0">
        <button
          onClick={handleAddToCart}
          className="add-to-cart-btn w-full bg-temu-orange text-white font-bold py-2.5 px-4 rounded-temu-sm hover:bg-temu-orange-bright transition flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-90"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          Add to Cart
        </button>
      </div>
    </div>
  );
}