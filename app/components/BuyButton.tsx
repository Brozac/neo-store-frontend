'use client';

import { useState } from 'react';
import PaymentModal from './PaymentModal';

interface BuyButtonProps {
  product: {
    id: string | number;
    title?: string;
    name?: string;
    price: number | string;
    image?: string;
    image_url?: string;
    color?: string;
    size?: string;
    quantity?: number;
    vid?: string;
  };
}

export default function BuyButton({ product }: BuyButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✨ استخراج السعر والكمية الحقيقية المحددة في الصفحة
  const safePrice = Number(product.price) || 0;
  const safeQuantity = Math.max(1, Number(product.quantity) || 1);
  const totalAmount = parseFloat((safePrice * safeQuantity).toFixed(2));

  // ✨ تمرير كافة المتغيرات المحددة بما فيها vid لحماية شحن المتغير الصحيح
  const cartItems = [{
    id: product.id,
    name: product.title || product.name || 'Product',
    price: safePrice,
    quantity: safeQuantity,
    image: product.image || product.image_url || '/placeholder.jpg',
    image_url: product.image || product.image_url || '/placeholder.jpg',
    color: product.color || '',
    size: product.size || '',
    vid: product.vid || ''
  }];

  return (
    <>
      <button 
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-linear-to-r from-fog-600 via-fog-500 to-coral-400 hover:brightness-110 text-white font-black py-4 px-6 rounded-temu-sm transition shadow-lg shadow-fog-500/25 flex justify-center items-center gap-2.5 cursor-pointer active:scale-95 touch-manipulation text-base uppercase tracking-wide"
      >
        <span></span>
        <span>Buy Now &bull; ${(totalAmount).toFixed(2)}</span>
      </button>

      <PaymentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        cartItems={cartItems}
        totalAmount={totalAmount}
      />
    </>
  );
}