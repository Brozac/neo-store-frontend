'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart, getCartItemKey } from '../context/CartContext';
import PaymentModal from '../components/PaymentModal';
import GlassIcon from '@/components/ui/GlassIcon';

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, cartTotal, wheelDiscount } = useCart();
  const [isLoaded, setIsLoaded] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);
  const [appliedCouponCode, setAppliedCouponCode] = useState('');


  const [isModalOpen, setIsModalOpen] = useState(false);



  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const parsePrice = (price: number | string): number => {
    if (typeof price === 'number') return isNaN(price) ? 0 : price;
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
        setAppliedCouponCode(couponCode.trim().toUpperCase());
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

  const wheelDiscountAmount = (cartTotal * wheelDiscount) / 100;
  const totalDiscount = discount + wheelDiscountAmount;
  const finalTotalNumber = Math.max(0, cartTotal - totalDiscount);
  const finalTotalString = finalTotalNumber.toFixed(2);

  // ✨ SERENE — شريط تقدم الشحن المجاني (ship-progress تاع المعاينة — FREE = $35)
  const FREE_SHIP = 35;
  const shipRemain = Math.max(0, FREE_SHIP - finalTotalNumber);
  const shipPct = Math.min(100, (finalTotalNumber / FREE_SHIP) * 100);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const itemsForCheckout = cart.map(item => ({
    id: item.id,
    name: item.displayTitle,
    price: parsePrice(item.price),
    image_url: item.displayImage,
    quantity: item.quantity,
    vid: item.vid
  }));

  return (
    <main className="min-h-screen p-5 pb-32 font-sans">
      <div className="max-w-md mx-auto">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-fog-600 font-bold text-sm mb-5 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          Continue Shopping
        </button>

        <div className="flex items-end justify-between mb-5">
          <h1 className="text-2xl font-black text-temu-black tracking-tight">My Cart</h1>
          {cart.length > 0 && (
            <span className="text-[11px] font-bold text-fog-700 bg-fog-200 px-3 py-1 rounded-full">
              {cart.reduce((n, i) => n + (i.quantity || 1), 0)} item{cart.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ✨ SERENE — ship-progress: شريط التقدم نحو الشحن المجاني (طبق الأصل من المعاينة) */}
        {cart.length > 0 && (
          <div className="bg-white rounded-2xl border border-fog-100 shadow-[0_4px_18px_rgba(91,126,166,0.09)] px-4 py-3.5 mb-4">
            <p className="text-xs font-bold text-temu-black mb-2.5">
              {shipRemain > 0 ? (
                <>Add <b className="text-fog-600">${shipRemain.toFixed(2)}</b> more to unlock <b className="text-fog-600">free shipping</b></>
              ) : (
                <><b className="text-maroccan-tea-600">Excellent!</b> You&apos;ve unlocked free shipping</>
              )}
            </p>
            <div className="h-[7px] rounded-full bg-fog-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-linear-to-r from-fog-300 to-fog-600 transition-all duration-700"
                style={{ width: `${shipPct}%` }}
                role="progressbar"
                aria-valuenow={Math.round(shipPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {cart.length === 0 ? (
          /* ✨ REPLICA_V3 — حالة فارغة بنفس روح المعاينة: دائرة ناعمة + عنوان + تلميح + CTA */
          <div className="flex flex-col items-center text-center bg-white p-12 sm:p-16 rounded-2xl border border-fog-100 shadow-sm mb-6">
            <div className="w-20 h-20 rounded-full bg-fog-50 text-[#5B7EA6] flex items-center justify-center mb-4">
              <GlassIcon ch="🛒" size="md" />
            </div>
            <h2 className="text-lg font-black text-temu-black">Your cart is empty</h2>
            <p className="text-xs text-gray-500 leading-relaxed mt-2 max-w-xs">
              Looks like you haven&apos;t added anything yet.
              <br />
              Discover today&apos;s trending picks — free express shipping worldwide.
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-5 bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold px-8 py-3.5 rounded-xl text-xs uppercase tracking-wider transition shadow-md active:scale-95 cursor-pointer touch-manipulation"
            >
              Start Shopping &rarr;
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {cart.map((item) => {
              const safePrice = parsePrice(item.price);
              const itemKey = getCartItemKey(item);
              const qty = item.quantity || 1;

              return (
                <div key={itemKey} className="bg-white rounded-2xl border border-fog-100 shadow-sm p-3.5 flex gap-3.5">
                  {/* صورة على بئر لافندر — مفردات الموكاب */}
                  {item.displayImage && (
                    <img
                      src={item.displayImage}
                      alt={item.displayTitle}
                      className="w-20 h-20 rounded-xl object-cover bg-fog-50 ring-1 ring-fog-100 shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[13px] font-bold text-temu-black leading-snug line-clamp-2">{item.displayTitle}</h3>
                      <button
                        onClick={() => removeFromCart(itemKey)}
                        className="w-7 h-7 shrink-0 flex items-center justify-center bg-coral-100 text-coral-600 rounded-lg transition cursor-pointer active:scale-90 touch-manipulation"
                        aria-label="Remove item"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>

                    {item.color && (
                      <p className="text-[11px] text-temu-gray-light font-medium mt-0.5">
                        {item.color}{item.size ? ` · Size: ${item.size}` : ''}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2.5">
                      {/* ستيبر الكمية — نفس مفردات ستيبر صفحة المنتج */}
                      <div className="flex items-center gap-1 bg-fog-50 rounded-lg p-0.5" role="group" aria-label="Quantity">
                        <button
                          onClick={() => updateQuantity(itemKey, qty - 1)}
                          className="w-7 h-7 rounded-md bg-white border border-fog-100 text-fog-700 flex items-center justify-center text-sm font-black transition active:scale-90 cursor-pointer touch-manipulation"
                          aria-label="Decrease quantity"
                        >
                          &minus;
                        </button>
                        <span className="w-6 text-center text-xs font-black text-temu-black" aria-live="polite">{qty}</span>
                        <button
                          onClick={() => updateQuantity(itemKey, Math.min(99, qty + 1))}
                          className="w-7 h-7 rounded-md bg-white border border-fog-100 text-fog-700 flex items-center justify-center text-sm font-black transition active:scale-90 cursor-pointer touch-manipulation"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <p className="text-sm font-extrabold text-fog-600">
                        ${(safePrice * qty).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {cart.length > 0 && (
          <div className="bg-white p-6 rounded-2xl border border-fog-100 mb-6 shadow-sm">

            {wheelDiscount > 0 && (
              <div className="bg-maroccan-tea-100 text-maroccan-tea-700 p-3 rounded-xl mb-4 text-sm font-bold text-center">
                <GlassIcon ch="🎉" size="xs" /> Lucky you! You saved {wheelDiscount}% with your Spin & Win reward!
              </div>
            )}

            <div className="mb-6 pb-6 border-b border-fog-100">
              <label className="block text-sm font-bold text-temu-black mb-2">Have a coupon?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter code..."
                  disabled={couponApplied}
                  className="flex-1 bg-fog-50 border border-fog-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-fog-400 focus:bg-white transition disabled:opacity-50 touch-manipulation"
                />
                <button
                  onClick={handleApplyCoupon}
                  disabled={couponApplied}
                  className="bg-temu-black text-white font-bold px-6 py-3 rounded-xl hover:bg-temu-dark transition disabled:opacity-50 cursor-pointer whitespace-nowrap active:scale-95 touch-manipulation shadow-sm"
                >
                  Apply
                </button>
              </div>
              {couponMessage && (
                <p className={`text-xs mt-2 font-medium ${couponApplied ? 'text-maroccan-tea-600' : 'text-coral-600'}`}>
                  {couponMessage}
                </p>
              )}
            </div>

            <div className="flex justify-between items-center mb-2">
              <span className="text-temu-gray-text font-medium">Subtotal:</span>
              <span className="text-lg font-bold text-temu-black">${cartTotal.toFixed(2)}</span>
            </div>

            {wheelDiscount > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-maroccan-tea-600 font-medium">Spin & Win ({wheelDiscount}%):</span>
                <span className="text-lg font-bold text-maroccan-tea-600">-${wheelDiscountAmount.toFixed(2)}</span>
              </div>
            )}

            {discount > 0 && (
              <div className="flex justify-between items-center mb-2">
                <span className="text-maroccan-tea-600 font-medium">Coupon Discount:</span>
                <span className="text-lg font-bold text-maroccan-tea-600">-${discount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 pt-3 border-t border-fog-100">
              <span className="text-temu-gray-text font-medium">Total:</span>
              <span className="text-2xl font-black text-fog-600">${finalTotalString}</span>
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-linear-to-r from-[#5B7EA6] to-[#46648A] hover:brightness-110 text-white font-extrabold p-4 rounded-xl transition flex justify-center items-center cursor-pointer active:scale-95 touch-manipulation shadow-md shadow-fog-500/25"
            >
              Proceed to Checkout
            </button>

            <p className="text-center text-[10px] text-temu-gray-light font-semibold mt-3">
              🔒 Secure checkout · Free worldwide express shipping
            </p>
          </div>
        )}
      </div>

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartItems={itemsForCheckout}
        totalAmount={finalTotalNumber}
        couponCode={appliedCouponCode}
      />
    </main>
  );
}