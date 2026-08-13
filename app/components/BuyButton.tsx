'use client';

import { useState } from 'react';
import PaymentModal from './PaymentModal';

interface BuyButtonProps {
  // تأكد من تمرير المنتج الحالي كمصفوفة لتتوافق مع PaymentModal
  product: any; 
}

export default function BuyButton({ product }: BuyButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // تحويل المنتج الواحد إلى صيغة عناصر السلة
  const cartItems = [{
    id: product.id,
    name: product.title,
    price: product.price,
    quantity: 1,
    image: product.image_url
  }];

  const totalAmount = product.price;

  return (
    <>
      <button 
        onClick={() => setIsModalOpen(true)}
        className="bg-[#FF6B9D] text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-[#8B78C6] transition-all shadow-lg hover:shadow-xl w-full"
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