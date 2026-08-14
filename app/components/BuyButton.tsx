'use client';

import { useState } from 'react';
import PaymentModal from './PaymentModal';

interface BuyButtonProps {
  product: any; 
}

export default function BuyButton({ product }: BuyButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✨ أمان الأرقام: التأكد من أن السعر رقم صحيح
  const safePrice = Number(product.price) || 0;

  // تحويل المنتج الواحد إلى صيغة عناصر السلة
  const cartItems = [{
    id: product.id,
    name: product.title,
    price: safePrice,
    quantity: 1,
    image: product.image || product.image_url
  }];

  const totalAmount = safePrice;

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        // ✨ توحيد الألوان، الحواف، وإضافة تأثير اللمس
        className="w-full bg-temu-error text-white font-extrabold py-4 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition-all shadow-md flex justify-center items-center gap-2 cursor-pointer active:scale-95 touch-manipulation text-lg"
      >
        Buy Now 
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