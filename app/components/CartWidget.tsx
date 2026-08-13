'use client';

import { useCart } from '../context/CartContext';
import { useState } from 'react';
import PaymentModal from './PaymentModal';

export default function CartWidget() {
  // ✨ جلب finalTotal و wheelDiscount من Context
  const { cart, removeFromCart, updateQuantity, finalTotal, wheelDiscount } = useCart(); 
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // حساب إجمالي عدد القطع
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <PaymentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        cartItems={cart} 
        totalAmount={finalTotal} // ✨ تمرير المبلغ بعد الخصم
      />

      {isOpen && (
        <div className="bg-white border border-gray-100 shadow-2xl rounded-2xl p-4 mb-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h3 className="text-lg font-extrabold text-[#1D1E3C]">Your Cart</h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-[#1D1E3C] cursor-pointer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {cart.map((item, index) => (
            <div key={`${item.id}-${item.color}-${item.size}-${index}`} className="flex justify-between items-start mb-4 gap-2">
              <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-md shrink-0" />
              
              <div className="grow overflow-hidden">
                <p className="text-sm font-semibold text-[#1D1E3C] line-clamp-1">{item.name}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                  {item.color && (
                    <span className="inline-block w-2 h-2 rounded-full border border-gray-300" style={{ backgroundColor: item.color }}></span>
                  )}
                  {item.size && <span>Size: {item.size}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1, item.color, item.size)}
                    className="w-6 h-6 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-[#1D1E3C] flex items-center justify-center text-sm font-bold transition cursor-pointer"
                  >−</button>
                  <span className="text-sm font-bold text-[#1D1E3C] w-6 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1, item.color, item.size)}
                    className="w-6 h-6 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-[#1D1E3C] flex items-center justify-center text-sm font-bold transition cursor-pointer"
                  >+</button>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between h-14">
                <button 
                  onClick={() => removeFromCart(item.id, item.color, item.size)}
                  className="text-gray-300 hover:text-red-500 transition cursor-pointer"
                  title="Remove item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <p className="text-sm font-bold text-[#8B78C6]">${(Number(item.price) * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}

          <div className="border-t pt-3 mt-2">
            {/* ✨ رسالة الخصم التهنئية */}
            {wheelDiscount > 0 && (
              <div className="bg-green-50 text-green-600 text-xs font-bold p-2 rounded-md mb-3 text-center animate-pulse">
                🎉 You saved {wheelDiscount}% with your Spin & Win reward!
              </div>
            )}

            <div className="flex justify-between font-extrabold text-lg mb-4 text-[#1D1E3C]">
              <span>Total:</span>
              {wheelDiscount > 0 ? (
                <div className="text-right">
                  {/* حساب السعر الأصلي قبل الخصم لعرضه مشطوب */}
                  <span className="text-gray-400 line-through text-sm">${(finalTotal / (1 - wheelDiscount/100)).toFixed(2)}</span>
                  <span className="text-[#FF6B9D] ml-2">${finalTotal.toFixed(2)}</span>
                </div>
              ) : (
                <span>${finalTotal.toFixed(2)}</span>
              )}
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-[#FF6B9D] text-white py-3 rounded-xl font-bold hover:bg-[#8B78C6] transition cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#1D1E3C] text-white p-4 rounded-full shadow-2xl hover:scale-105 transition flex items-center justify-center gap-2 cursor-pointer relative"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
            {totalItems}
          </span>
        )}
      </button>
    </div>
  );
}