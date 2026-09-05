'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart, getCartItemKey } from '../context/CartContext';
import PaymentModal from './PaymentModal';
import { useState } from 'react';

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, cartTotal, finalTotal, wheelDiscount, isMounted } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-md mb-4 text-3xl">
          🛒
        </div>
        <h1 className="text-2xl font-black text-temu-black mb-2">Your Shopping Cart is Empty</h1>
        <p className="text-temu-gray-text text-sm mb-6 max-w-sm">
          Looks like you haven't added anything yet. Explore our curated trending deals!
        </p>
        <button 
          onClick={() => router.push('/')}
          className="bg-temu-orange hover:bg-temu-orange-bright text-white px-8 py-3.5 rounded-temu-sm font-extrabold cursor-pointer active:scale-95 transition shadow-md text-sm"
        >
          Start Shopping &rarr;
        </button>
      </div>
    );
  }

  const payableTotal = finalTotal > 0 ? finalTotal : cartTotal;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-temu-offwhite p-4 sm:p-8 pb-32 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-temu-black">Shopping Bag</h1>
            <p className="text-xs text-temu-gray-light">{totalItemsCount} items ready for checkout</p>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="text-xs font-bold text-temu-orange hover:underline cursor-pointer"
          >
            &larr; Continue Browsing
          </button>
        </div>

        {/* Free Shipping Urgency Banner */}
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-temu-sm flex items-center gap-3 text-emerald-800 text-xs font-bold">
          <span>✈️</span>
          <span>Congratulations! You qualify for <strong>FREE Insured Worldwide Shipping</strong>.</span>
        </div>

        {/* Items List */}
        <div className="bg-white rounded-temu-sm shadow-sm p-4 sm:p-6 border border-temu-gray-border-light divide-y divide-gray-100">
          {cart.map((item) => {
            const itemKey = getCartItemKey(item);
            const itemImg = item.displayImage || item.image_url || item.image || '/placeholder.jpg';
            const itemTitle = item.displayTitle || item.title || item.name || 'Product';
            const unitPrice = Number(item.price) || 0;

            return (
              <div key={itemKey} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                
                {/* Product Info */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-temu-sm overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                    <Image src={itemImg} alt={itemTitle} fill sizes="80px" className="object-contain p-1" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${item.id}`} className="font-bold text-sm text-temu-black hover:text-temu-orange line-clamp-1 transition">
                      {itemTitle}
                    </Link>
                    
                    <div className="flex items-center gap-2 text-xs text-temu-gray-light mt-1 flex-wrap">
                      {item.color && (
                        <span className="flex items-center gap-1">
                          Color: <strong className="text-temu-black">{item.color}</strong>
                        </span>
                      )}
                      {item.size && (
                        <span className="flex items-center gap-1">
                          Size: <strong className="text-temu-black">{item.size}</strong>
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-black text-temu-error mt-1.5">
                      ${unitPrice.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Quantity & Actions */}
                <div className="flex items-center justify-between w-full sm:w-auto sm:justify-end gap-6 pt-2 sm:pt-0">
                  <div className="flex items-center border border-temu-gray-border rounded-temu-sm overflow-hidden bg-white">
                    <button 
                      onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                      className="px-3 py-1.5 text-sm font-bold text-temu-gray-text hover:bg-gray-100 active:scale-90 transition cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-3.5 py-1.5 font-bold text-xs text-temu-black border-x border-temu-gray-border">
                      {item.quantity}
                    </span>
                    <button 
                      onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                      className="px-3 py-1.5 text-sm font-bold text-temu-gray-text hover:bg-gray-100 active:scale-90 transition cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-black text-sm text-temu-black min-w-[70px] text-right">
                    ${(unitPrice * item.quantity).toFixed(2)}
                  </span>

                  <button 
                    onClick={() => removeFromCart(itemKey)}
                    className="text-gray-400 hover:text-temu-error p-1.5 transition cursor-pointer active:scale-90"
                    title="Remove item"
                  >
                    🗑️
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* Total & Checkout Section */}
        <div className="bg-white rounded-temu-sm shadow-sm p-6 border border-temu-gray-border-light space-y-4">
          <div className="space-y-2 text-xs text-temu-gray-text border-b border-gray-100 pb-4">
            <div className="flex justify-between">
              <span>Bag Subtotal:</span>
              <span className="font-bold text-temu-black">${cartTotal.toFixed(2)}</span>
            </div>

            {wheelDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Lucky Spin Reward ({wheelDiscount}% OFF):</span>
                <span>-${((cartTotal * wheelDiscount) / 100).toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Shipping & Handling:</span>
              <span className="text-emerald-600 font-bold uppercase">Free</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-1">
            <div>
              <span className="text-xs text-gray-400 block font-semibold">Total Amount:</span>
              <span className="text-2xl font-black text-temu-error">${payableTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-temu-orange hover:bg-temu-orange-bright text-white px-8 py-4 rounded-temu-sm font-extrabold text-sm transition-all shadow-lg active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              Proceed to Payment &rarr;
            </button>
          </div>
        </div>

      </div>

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartItems={cart}
        totalAmount={payableTotal}
      />
    </div>
  );
}