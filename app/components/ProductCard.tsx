'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image?: string;
  image_url?: string;
  description?: string;
  rating?: number;
  sales_count?: number;
  discount?: string;
  variants?: any[];
}

interface ProductCardProps {
  product: Product;
  isTouched?: boolean;
}

export default function ProductCard({ product, isTouched }: ProductCardProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const handleCardClick = () => {
    router.push(`/products/${product.id}`);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    let defaultVid = '';
    if (product.variants) {
      try {
        const v = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
        if (Array.isArray(v) && v[0]?.vid) defaultVid = v[0].vid;
      } catch (e) {}
    }

    addToCart({
      id: product.id,
      title: product.title,
      price: Number(product.price) || 0,
      quantity: 1,
      image: product.image || product.image_url || '/placeholder.jpg',
      image_url: product.image_url || product.image || '/placeholder.jpg',
      vid: defaultVid
    }, 1);

    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1200);
  };

  const safePrice = Number(product.price) || 0;

  // 🩹 TRUST FIX — discount من original_price الحقيقي فقط (CJ) — صفر خصومات مفبركة:
  //    النسبة تُحسب من original_price الحقيقي فقط، والشارة تظهر فقط عند خصم حقيقي معقول (1-89%)
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

  const imgSrc = product.image_url || product.image || '/placeholder.jpg';

  return (
    <div
      data-product-id={String(product.id)}
      className={`product-card-wrapper product-card-animated bg-white border border-temu-gray-border-light rounded-temu-sm overflow-hidden flex flex-col justify-between group relative cursor-pointer transition-all duration-300 active:scale-[0.98] shadow-sm hover:shadow-md ${
        isTouched ? 'is-active' : ''
      }`}
      onClick={handleCardClick}
    >
      <div>
        <div className="relative aspect-square bg-temu-offwhite overflow-hidden">
          {/* ✨ استبدال Image بـ img */}
          <img
            src={imgSrc}
            alt={product.title || 'Product'}
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
          />
          {discountText && (
            <div className="absolute top-2 left-2 bg-temu-error text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">
              {discountText}
            </div>
          )}
        </div>

        <div className="p-3 pb-2">
          <h3 className="text-xs font-bold text-temu-black line-clamp-2 mb-2 group-hover:text-temu-orange transition min-h-[32px] leading-relaxed">
            {product.title}
          </h3>

          <div className="flex items-baseline gap-2 mb-1 flex-wrap">
            <span className="text-base font-black text-temu-error">
              ${safePrice.toFixed(2)}
            </span>
            {displayOriginalPrice > safePrice && (
              <span className="text-[11px] text-temu-gray-light line-through font-medium">
                ${displayOriginalPrice.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 pt-0">
        <button
          type="button"
          onClick={handleAddToCart}
          className={`w-full font-bold py-2.5 px-3 rounded-temu-sm transition-all duration-200 flex items-center justify-center gap-1.5 text-xs cursor-pointer active:scale-90 shadow-sm ${
            isAdded
              ? 'bg-emerald-600 text-white shadow-emerald-500/20'
              : 'bg-temu-orange hover:bg-temu-orange-bright text-white'
          }`}
        >
          {isAdded ? (
            <>
              <span>✓</span> Added to Cart
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}