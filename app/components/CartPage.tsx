'use client';

import { useState } from 'react';
import PaymentModal from './PaymentModal';

export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

interface CartPageProps {
  cartItems: CartItem[];
}

export default function CartPage({ cartItems }: CartPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalAmount = cartItems.reduce(
    (acc: number, item: CartItem) => acc + item.price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-temu-offwhite p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-temu-sm shadow-sm p-6 border border-temu-gray-border-light">
        <h1 className="text-3xl font-bold text-temu-black mb-6">سلة التسوق</h1>

        {/* هنا تعرض عناصر السلة (Cart Items) */}
        {/* ... */}

        <div className="mt-8 border-t border-temu-gray-border-light pt-6 flex justify-between items-center">
          <span className="text-xl font-bold text-temu-black">
            المجموع: ${totalAmount.toFixed(2)}
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-temu-error text-white px-10 py-4 rounded-temu-sm font-bold text-lg hover:bg-temu-orange-bright transition-all shadow-md transform hover:-translate-y-0.5 active:scale-95 touch-manipulation cursor-pointer"
          >
            إتمام الشراء
          </button>
        </div>
      </div>

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartItems={cartItems}
        totalAmount={totalAmount}
      />
    </div>
  );
}