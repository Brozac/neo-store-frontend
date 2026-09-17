'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useCart } from '../context/CartContext';
import { IMG } from '@/lib/imageOptimizer';

interface Product {
  id: string | number;
  title: string;
  price: number | string;
  original_price?: number | string;
  image?: string;
  image_url?: string;
  vid?: string;
}

interface FrequentlyBoughtTogetherProps {
  currentProduct: Product;
  relatedProducts: Product[];
}

const BUNDLE_DISCOUNT_PERCENT = 15;

export default function FrequentlyBoughtTogether({ 
  currentProduct, 
  relatedProducts = [] 
}: FrequentlyBoughtTogetherProps) {
  const { addToCart } = useCart(); // ✨ Mission #15 fix — applyWheelDiscount حُذفت (تسرب مالي)
  
  const bundlePartner = relatedProducts.length > 0 ? relatedProducts[0] : null;
  const [includePartner, setIncludePartner] = useState(true);
  const [addedSuccess, setAddedSuccess] = useState(false);

  if (!bundlePartner) return null;

  const currentPrice = Number(currentProduct.price) || 0;
  const partnerPrice = Number(bundlePartner.price) || 0;

  // ✨ الإصلاح المالي (Mission #15):
  // قبل: applyWheelDiscount(15) كانت تطبق 15% على السلة كاملة + تبقى حية 
  //      حتى بعد حذف المكمل → تسرب مالي مزدوج.
  // بعد: الخصم يسكن مع سعر السطر نفسه — عزل تام، لا تراكب، لا تسرب.
  const partnerFinalPrice = includePartner 
    ? parseFloat((partnerPrice * (1 - BUNDLE_DISCOUNT_PERCENT / 100)).toFixed(2)) 
    : 0;
  const discountedCombinedPrice = includePartner
    ? parseFloat((currentPrice + partnerFinalPrice).toFixed(2))
    : currentPrice;

  const currentImg = currentProduct.image_url || currentProduct.image || '/placeholder.jpg';
  const partnerImg = bundlePartner.image_url || bundlePartner.image || '/placeholder.jpg';

  const handleAddBundleToCart = () => {
    // 1. المنتج الأساسي — سعره الكامل
    addToCart({
      id: currentProduct.id,
      title: currentProduct.title,
      name: currentProduct.title,
      price: currentPrice,
      quantity: 1,
      image: currentImg,
      image_url: currentImg,
      vid: currentProduct.vid || ''
    }, 1);

    // 2. المكمل — بسعره المخفض مباشرة
    if (includePartner) {
      addToCart({
        id: bundlePartner.id,
        title: bundlePartner.title,
        name: bundlePartner.title,
        price: partnerFinalPrice,
        quantity: 1,
        image: partnerImg,
        image_url: partnerImg,
        vid: bundlePartner.vid || ''
      }, 1);
    }

    setAddedSuccess(true);
    setTimeout(() => setAddedSuccess(false), 2200);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm my-8 space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2 border-b border-gray-100 pb-3">
        <h3 className="text-base font-black text-[#1D1E3C] flex items-center gap-2">
          <span>🤝</span> Frequently Bought Together
        </h3>
        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full">
          Bundle & Save 15%
        </span>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        
        {/* صور المنتجين مع علامة الزائد (+) */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
          {/* المنتج الأول */}
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden shrink-0 shadow-sm">
            <Image 
              src={IMG.card(currentImg)} 
              alt={currentProduct.title} 
              fill 
              sizes="96px" 
              className="object-contain p-1.5" 
            />
          </div>

          <span className="text-xl font-black text-[#8B78C6]">+</span>

          {/* المنتج الثاني المكمل */}
          <div className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gray-50 border-2 overflow-hidden shrink-0 shadow-sm transition ${
            includePartner ? 'border-[#8B78C6]' : 'border-gray-200 opacity-40'
          }`}>
            <Image 
              src={IMG.card(partnerImg)} 
              alt={bundlePartner.title} 
              fill 
              sizes="96px" 
              className="object-contain p-1.5" 
            />
          </div>
        </div>

        {/* خانة تحديد المنتجات والأسعار */}
        <div className="flex-1 min-w-0 space-y-2 text-xs w-full">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={true} disabled className="rounded text-[#8B78C6]" />
            <span className="font-bold text-gray-900 truncate">
              This item: <span className="text-[#8B78C6]">{currentProduct.title}</span> (${currentPrice.toFixed(2)})
            </span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={includePartner} 
              onChange={(e) => setIncludePartner(e.target.checked)} 
              className="rounded text-[#8B78C6] cursor-pointer" 
            />
            <span className="font-bold text-gray-900 truncate">
              Add-on item: <span className="text-[#8B78C6]">{bundlePartner.title}</span> (${partnerPrice.toFixed(2)})
            </span>
          </label>
        </div>

        {/* صندوق السعر والزر الفوري */}
        <div className="flex flex-col items-center sm:items-end gap-2 shrink-0 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100">
          <div className="text-center sm:text-right">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Combined Bundle Price:</span>
            <div className="flex items-baseline gap-2 justify-center sm:justify-end">
              <span className="text-xl font-black text-[#FF6B9D]">
                ${discountedCombinedPrice.toFixed(2)}
              </span>
              {includePartner && (
                <span className="text-xs text-gray-400 line-through">
                  ${originalCombinedPriceRaw(currentPrice, partnerPrice, includePartner).toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddBundleToCart}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer ${
              addedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white shadow-[#8B78C6]/20'
            }`}
          >
            {addedSuccess ? (
              <><span>✓</span> Both Added to Bag (15% OFF Saved)!</>
            ) : (
              <><span>⚡</span> {includePartner ? 'Add Both to Cart (Save 15%)' : 'Add Item to Cart'}</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

// ✨ helper — المجموع الخام (لخط الشطب) — خارج JSX للنقاء
function originalCombinedPriceRaw(current: number, partner: number, includePartner: boolean): number {
  return includePartner ? current + partner : current;
}