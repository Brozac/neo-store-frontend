'use client';

import { useState } from 'react';
import PaymentModal from './PaymentModal';

// ✅ تعريف واجهة لعنصر السلة (يفضل وضعها في ملف منفصل مثل types/cart.ts)
export interface CartItem {
  id: string | number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

// ✅ تعريف واجهة لخصائص المكوّن
interface CartPageProps {
  cartItems: CartItem[];
}

export default function CartPage({ cartItems }: CartPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ الآن TypeScript يعرف أن acc من نوع number و item من نوع CartItem تلقائياً
  const totalAmount = cartItems.reduce(
    (acc: number, item: CartItem) => acc + item.price * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm p-6">
        <h1 className="text-3xl font-bold text-[#1D1E3C] mb-6">سلة التسوق</h1>

        {/* هنا تعرض عناصر السلة (Cart Items) */}
        {/* ... */}

        <div className="mt-8 border-t pt-6 flex justify-between items-center">
          <span className="text-xl font-bold text-[#1D1E3C]">
            المجموع: ${totalAmount.toFixed(2)}
          </span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#FF6B9D] text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-[#8B78C6] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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