'use client';

import { useCart } from '../context/CartContext';
import { useState } from 'react';
import PaymentModal from './PaymentModal';

export default function Cartwidget() {
  const { cart, removeFromCart, updateQuantity, finalTotal, wheelDiscount } = useCart(); 
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <PaymentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        cartItems={cart} 
        totalAmount={finalTotal} 
      />

      {isOpen && (
        <div className="bg-white border border-temu-gray-border-light shadow-2xl rounded-temu-sm p-4 mb-4 w-80 max-h-96 overflow-y-auto scrollbar-hide touch-pan-y">
          <div className="flex justify-between items-center mb-4 border-b border-temu-gray-border-light pb-2">
            <h3 className="text-lg font-extrabold text-temu-black">Your Cart</h3>
            <button onClick={() => setIsOpen(false)} className="text-temu-gray-light hover:text-temu-black cursor-pointer active:scale-90 transition">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          {cart.map((item, index) => (
            <div key={`${item.id}-${item.color}-${item.size}-${index}`} className="flex justify-between items-start mb-4 gap-2">
              <img src={item.image} alt={item.name} className="w-14 h-14 object-cover rounded-temu-sm shrink-0" />
              
              <div className="grow overflow-hidden">
                <p className="text-sm font-semibold text-temu-black line-clamp-1">{item.name}</p>
                <div className="flex items-center gap-1 text-xs text-temu-gray-light mb-2">
                  {item.color && (
                    <span className="inline-block w-2 h-2 rounded-full border border-temu-gray-border" style={{ backgroundColor: item.color }}></span>
                  )}
                  {item.size && <span>Size: {item.size}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1, item.color, item.size)}
                    className="w-7 h-7 rounded-temu-sm border border-temu-gray-border text-temu-gray-text hover:bg-temu-offwhite hover:text-temu-black flex items-center justify-center text-sm font-bold transition cursor-pointer active:scale-90 touch-manipulation"
                  >−</button>
                  <span className="text-sm font-bold text-temu-black w-6 text-center">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1, item.color, item.size)}
                    className="w-7 h-7 rounded-temu-sm border border-temu-gray-border text-temu-gray-text hover:bg-temu-offwhite hover:text-temu-black flex items-center justify-center text-sm font-bold transition cursor-pointer active:scale-90 touch-manipulation"
                  >+</button>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between h-14">
                <button 
                  onClick={() => removeFromCart(item.id, item.color, item.size)}
                  className="text-temu-gray-light hover:text-temu-error transition cursor-pointer active:scale-90"
                  title="Remove item"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <p className="text-sm font-bold text-temu-orange">${(Number(item.price) * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}

          <div className="border-t border-temu-gray-border-light pt-3 mt-2">
            {wheelDiscount > 0 && (
              <div className="bg-temu-green-light/10 text-temu-green text-xs font-bold p-2 rounded-temu-sm mb-3 text-center animate-pulse">
                🎉 You saved {wheelDiscount}% with your Spin & Win reward!
              </div>
            )}

            <div className="flex justify-between font-extrabold text-lg mb-4 text-temu-black">
              <span>Total:</span>
              {wheelDiscount > 0 ? (
                <div className="text-right">
                  <span className="text-temu-gray-light line-through text-sm">${(finalTotal / (1 - wheelDiscount/100)).toFixed(2)}</span>
                  <span className="text-temu-error ml-2">${finalTotal.toFixed(2)}</span>
                </div>
              ) : (
                <span>${finalTotal.toFixed(2)}</span>
              )}
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-temu-error text-white py-3 rounded-temu-sm font-bold hover:bg-temu-orange-bright transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="bg-temu-black text-white p-4 rounded-full shadow-2xl hover:scale-105 transition flex items-center justify-center gap-2 cursor-pointer relative active:scale-90 touch-manipulation"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 bg-temu-error text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white">
            {totalItems}
          </span>
        )}
      </button>
    </div>
  );
}