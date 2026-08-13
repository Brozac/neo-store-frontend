'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import PaymentModal from '../components/PaymentModal';

interface CartItem {
  id: string | number;
  name: string;
  price: number | string;
  quantity: number;
  image?: string;
  color?: string;
  size?: string;
  vid?: string;
}

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, cartTotal, wheelDiscount } = useCart();
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  
  // حالة لفتح وإغلاق نافذة الدفع
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return price;
    const cleanedPrice = String(price).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleanedPrice);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    setCouponMessage('');
    try {
      const res = await fetch('https://neo-store-backend.onrender.com/api/validate-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, cartTotal: cartTotal })
      });
      const data = await res.json();

      if (res.ok) {
        setDiscount(Number(data.discount));
        setCouponApplied(true);
        setCouponMessage(data.message);
      } else {
        setDiscount(0);
        setCouponApplied(false);
        setCouponMessage(data.error);
      }
    } catch (err) {
      setCouponMessage('Server error.');
    }
  };

  const handleCheckout = () => {
    setIsModalOpen(true);
  };

  // ✨ حساب الخصومات معاً (عجلة الحظ + الكوبون)
  const wheelDiscountAmount = (cartTotal * wheelDiscount) / 100;
  const totalDiscount = discount + wheelDiscountAmount;
  const finalTotalNumber = Math.max(0, cartTotal - totalDiscount);
  const finalTotalString = finalTotalNumber.toFixed(2);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // تجهيز البيانات لتمريرها لنافذة الدفع (PaymentModal)
  const itemsForCheckout = cart.map(item => ({
    id: item.id,
    name: item.name,
    price: parsePrice(item.price),
    image_url: item.image,
    quantity: item.quantity,
    vid: item.vid 
  }));

  return (
    <main className="min-h-screen bg-temu-offwhite p-6 pb-32 font-sans">
      <div className="max-w-md mx-auto">
        <button onClick={() => router.push('/')} className="text-temu-orange font-bold mb-6">
          ← Continue Shopping
        </button>
        
        <h1 className="text-3xl font-extrabold text-temu-black mb-6">My Cart</h1>

        {cart.length === 0 ? (
          <div className="bg-white p-8 rounded-temu-sm border border-temu-gray-border-light text-center mb-6">
            <p className="text-temu-black font-semibold mb-2">Your cart is currently empty.</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {cart.map((item: CartItem, idx: number) => {
              const safePrice = parsePrice(item.price);
              const uniqueKey = `${item.id}-${item.color}-${item.size}-${idx}`;
              
              return (
                <div key={uniqueKey} className="bg-white p-4 rounded-temu-sm border border-temu-gray-border-light flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {item.image && (
                      <img src={item.image} alt={item.name} className="w-16 h-16 rounded-temu-sm object-cover" />
                    )}
                    <div>
                      <h3 className="font-bold text-temu-dark">{item.name || 'Product'}</h3>
                      {item.color && <p className="text-xs text-temu-gray-light">Color: {item.color} | Size: {item.size}</p>}
                      <p className="text-temu-error font-semibold">
                        ${safePrice.toFixed(2)} x {item.quantity || 1}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id, item.color, item.size)}
                    className="w-8 h-8 flex items-center justify-center bg-red-50 text-temu-error rounded-temu-sm hover:bg-red-100 transition cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {cart.length > 0 && (
          <div className="bg-white p-6 rounded-temu-sm border border-temu-gray-border-light mb-6">
            
            {/* ✨ رسالة الخصم التهنئية لعجلة الحظ */}
            {wheelDiscount > 0 && (
              <div className="bg-green-50 text-green-600 p-3 rounded-temu-sm mb-4 text-sm font-bold text-center">
                🎉 Lucky you! You saved {wheelDiscount}% with your Spin & Win reward!
              </div>
            )}

            <div className="mb-6 pb-6 border-b border-temu-gray-border-light">
              <label className="block text-sm font-bold text-temu-black mb-2">Have a coupon?</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={couponCode} 
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter code..."
                  disabled={couponApplied}
                  className="flex-1 bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange disabled:opacity-50"
                />
                <button 
                  onClick={handleApplyCoupon} 
                  disabled={couponApplied}
                  className="bg-temu-black text-white font-bold px-6 rounded-temu-sm hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  Apply
                </button>
              </div>
              {couponMessage && (
                <p className={`text-xs mt-2 font-medium ${couponApplied ? 'text-temu-green' : 'text-temu-error'}`}>
                  {couponMessage}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center mb-2">
              <span className="text-temu-gray-text font-medium">Subtotal:</span>
              <span className="text-lg font-bold text-temu-black">${cartTotal.toFixed(2)}</span>
            </div>
            
            {/* ✨ إظهار خصم عجلة الحظ */}
            {wheelDiscount > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-temu-green font-medium">Spin & Win ({wheelDiscount}%):</span>
                <span className="text-lg font-bold text-temu-green">-${wheelDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            {/* ✨ إظهار خصم الكوبون */}
            {discount > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-temu-green font-medium">Coupon Discount:</span>
                <span className="text-lg font-bold text-temu-green">-${discount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 pt-2 border-t">
              <span className="text-temu-gray-text font-medium">Total:</span>
              <span className="text-2xl font-bold text-temu-error">${finalTotalString}</span>
            </div>

            <button 
              onClick={handleCheckout}
              className="w-full bg-temu-orange text-white font-bold p-4 rounded-temu-sm hover:bg-temu-orange-bright transition flex justify-center items-center cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>

      {/* ✨ نافذة الدفع المنبثقة (تستخدم المبلغ النهائي بعد كل الخصومات) */}
      <PaymentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        cartItems={itemsForCheckout} 
        totalAmount={finalTotalNumber} 
      />
    </main>
  );
}