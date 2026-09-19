'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart, getCartItemKey } from '../context/CartContext';
import PaymentModal from './PaymentModal';
import { useState, useEffect, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL; // ✅ Tenet #4 — بلا hardcoded URLs

const isHexColor = (v?: string) => !!v && /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(v);

export default function CartPage() {
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, cartTotal, finalTotal, wheelDiscount, isMounted } = useCart();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✨ حالة الكوبون — كنخزنو غير الكود، والخصم كيجي ديما من السيرفر
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponInfo, setCouponInfo] = useState<{ discount: number; message: string } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const skipRevalidate = useRef(false);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const payableTotal = finalTotal > 0 ? finalTotal : cartTotal;

  // ✨ إعادة التصادق تلقائياً ملي كيتبدل المجموع (تبديل الكمية/الحذف) — debounced
  useEffect(() => {
    if (!couponCode) return;
    if (skipRevalidate.current) {
      skipRevalidate.current = false;
      return;
    }
    const t = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await fetch(`${API_URL}/api/validate-coupon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponCode, cartTotal: payableTotal }),
        });
        if (res.ok) {
          const data = await res.json();
          setCouponInfo({ discount: Number(data.discount) || 0, message: data.message || 'Coupon applied!' });
          setCouponError(null);
        } else {
          // الكوبون تبعطل ولا تسala — كنحيدوه بصمت مع رسالة
          setCouponCode(null);
          setCouponInfo(null);
          setCouponError('Your coupon is no longer valid for this cart.');
        }
      } catch {
        // شبكة معطلة — كانخليو الكوبون القديم مؤقتاً
      } finally {
        setValidating(false);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponCode, payableTotal]);
    // ✨ استرجاع كوبون Exit-Intent تلقائياً — تجربة بضغطة وحدة
  useEffect(() => {
    const saved = sessionStorage.getItem('laclarc_coupon');
    if (saved && !couponCode) {
      setCouponInput(saved);
      // تطبيق مباشر عبر نفس مسار التصادق الموحد
      const apply = async () => {
        try {
          const res = await fetch(`${API_URL}/api/validate-coupon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: saved, cartTotal: payableTotal }),
          });
          if (res.ok) {
            const data = await res.json();
            setCouponCode(saved);
            setCouponInfo({ discount: Number(data.discount) || 0, message: data.message });
          }
        } catch {}
      };
      apply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCoupon = () => {
    const trimmed = couponInput.trim().toUpperCase();
    if (!trimmed || validating) return;
    skipRevalidate.current = false;
    setCouponCode(trimmed);   // ✨ الـ effect هو اللي كيصادق — مسار واحد للكود
    setCouponInfo(null);
    setCouponError(null);
  };

  const removeCoupon = () => {
    skipRevalidate.current = false;
    setCouponCode(null);
    setCouponInfo(null);
    setCouponError(null);
    setCouponInput('');
  };

  // ✨ الخصم النهائي — كنحسبو على payableTotal (بعد خصم العجلة) مع سقف أمان
  const couponDiscount = couponInfo
    ? Math.min(couponInfo.discount, payableTotal)
    : 0;
  const grandTotal = parseFloat((payableTotal - couponDiscount).toFixed(2));

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-temu-offwhite flex flex-col justify-center items-center p-6 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md mb-4 text-3xl">🛒</div>
        <h1 className="text-2xl font-black text-temu-black mb-2 tracking-tight">Your Shopping Cart is Empty</h1>
        <p className="text-temu-gray-text text-sm mb-6 max-w-sm">
          Looks like you haven&apos;t added anything yet. Explore our curated trending deals!
        </p>
        <button
          onClick={() => router.push('/')}
          className="bg-temu-orange hover:bg-temu-orange-bright text-white px-8 py-3.5 rounded-temu-sm font-extrabold cursor-pointer active:scale-95 transition shadow-lg shadow-temu-orange/30 text-sm touch-manipulation"
        >
          Start Shopping &rarr;
        </button>
      </div>
    );
  }

  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-temu-offwhite p-4 sm:p-8 pb-36 sm:pb-32 font-sans">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex justify-between items-start sm:items-center flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-temu-black tracking-tight">Shopping Bag</h1>
            <p className="text-xs text-temu-gray-light mt-0.5">{totalItemsCount} items ready for checkout</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-xs font-bold text-temu-orange hover:underline cursor-pointer py-2 touch-manipulation"
          >
            &larr; Continue Browsing
          </button>
        </div>

        {/* Free Shipping Urgency Banner */}
        <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-temu-sm flex items-center gap-3 text-emerald-800 text-xs font-bold">
          <span className="text-base shrink-0">✈️</span>
          <span>Congratulations! You qualify for <strong>FREE Insured Worldwide Shipping</strong>.</span>
        </div>

        {/* Items List — كارت مستقل لكل منتج */}
        <div className="space-y-3">
          {cart.map((item) => {
            const itemKey = getCartItemKey(item);
            const itemImg = item.displayImage || item.image_url || item.image || '/placeholder.jpg';
            const itemTitle = item.displayTitle || item.title || item.name || 'Product';
            const unitPrice = Number(item.price) || 0;

            return (
              <div
                key={itemKey}
                className="bg-white rounded-2xl shadow-sm border border-temu-gray-border-light p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex gap-3.5 min-w-0 flex-1">
                  <Link href={`/products/${item.id}`} className="shrink-0" aria-label={itemTitle}>
                    <div className="relative w-[76px] h-[76px] sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                      <Image src={itemImg} alt={itemTitle} fill sizes="80px" className="object-contain p-1" />
                    </div>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${item.id}`}
                      className="font-bold text-sm text-temu-black hover:text-temu-orange line-clamp-2 sm:line-clamp-1 transition leading-snug"
                    >
                      {itemTitle}
                    </Link>

                    {(item.color || item.size) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {item.color && (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-temu-gray-text bg-temu-offwhite border border-temu-gray-border-light px-2 py-0.5 rounded-full">
                            {isHexColor(item.color) ? (
                              <>
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-gray-300 shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                Color
                              </>
                            ) : (
                              <>Color: <strong className="text-temu-black">{item.color}</strong></>
                            )}
                          </span>
                        )}
                        {item.size && (
                          <span className="text-[10px] font-bold text-temu-gray-text bg-temu-offwhite border border-temu-gray-border-light px-2 py-0.5 rounded-full">
                            Size: <strong className="text-temu-black">{item.size}</strong>
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-sm font-black text-temu-error mt-1.5">${unitPrice.toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5">
                  <div className="flex items-center border border-temu-gray-border rounded-temu-sm overflow-hidden bg-white shrink-0">
                    <button
                      onClick={() => updateQuantity(itemKey, item.quantity - 1)}
                      aria-label="Decrease quantity"
                      className="w-9 h-9 flex items-center justify-center text-base font-bold text-temu-gray-text hover:bg-gray-100 active:bg-gray-200 active:scale-90 transition cursor-pointer touch-manipulation"
                    >
                      −
                    </button>
                    <span className="w-9 text-center font-bold text-xs text-temu-black border-x border-temu-gray-border">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(itemKey, item.quantity + 1)}
                      aria-label="Increase quantity"
                      className="w-9 h-9 flex items-center justify-center text-base font-bold text-temu-gray-text hover:bg-gray-100 active:bg-gray-200 active:scale-90 transition cursor-pointer touch-manipulation"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right min-w-[70px]">
                    <span className="font-black text-sm text-temu-black block">
                      ${(unitPrice * item.quantity).toFixed(2)}
                    </span>
                    {item.quantity > 1 && (
                      <span className="text-[10px] text-temu-gray-light font-semibold">
                        ${unitPrice.toFixed(2)} each
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeFromCart(itemKey)}
                    aria-label="Remove item"
                    title="Remove item"
                    className="w-9 h-9 rounded-full text-gray-400 hover:text-temu-error hover:bg-temu-error/10 flex items-center justify-center transition cursor-pointer active:scale-90 touch-manipulation shrink-0"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ✨ Coupon Section — مربوط بالـ endpoint الحقيقي */}
        <div className="bg-white rounded-2xl shadow-sm border border-temu-gray-border-light p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🎟️</span>
            <h2 className="text-sm font-black text-temu-black">Have a coupon?</h2>
          </div>

          {/* ✅ flex + min-w-0 + shrink-0 = الزر ماكيخرجش برا أبداً */}
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
              placeholder="Enter code..."
              disabled={!!couponCode}
              className="flex-1 min-w-0 h-11 px-4 rounded-temu-sm border border-temu-gray-border bg-temu-offwhite text-sm font-medium text-temu-black uppercase placeholder:text-gray-400 placeholder:normal-case focus:outline-none focus:border-temu-orange focus:ring-2 focus:ring-temu-orange/20 transition disabled:opacity-60"
            />
            {couponCode ? (
              <button
                onClick={removeCoupon}
                className="shrink-0 h-11 px-5 rounded-temu-sm bg-temu-error/10 text-temu-error text-xs font-extrabold uppercase tracking-wider active:scale-95 transition touch-manipulation"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={applyCoupon}
                disabled={validating || !couponInput.trim()}
                className="shrink-0 h-11 px-6 rounded-temu-sm bg-temu-black text-white text-xs font-extrabold uppercase tracking-wider active:scale-95 transition touch-manipulation disabled:opacity-50"
              >
                {validating ? '...' : 'Apply'}
              </button>
            )}
          </div>

          {/* رسائل الحالة */}
          {couponError && (
            <p className="text-[11px] font-bold text-temu-error mt-2.5">❌ {couponError}</p>
          )}
          {couponInfo && couponCode && (
            <div className="flex items-center justify-between mt-2.5 bg-emerald-50 border border-emerald-200 rounded-temu-sm px-3 py-2">
              <span className="text-[11px] font-black text-emerald-700 uppercase">
                🎟️ {couponCode} — you saved ${couponDiscount.toFixed(2)}
              </span>
              {validating && <span className="text-[10px] text-gray-400">updating...</span>}
            </div>
          )}
        </div>

                {/* Total & Checkout Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-temu-gray-border-light p-5 sm:p-6 space-y-4">
          {/* قائمة المبالغ — نظيفة فقط */}
          <div className="space-y-2 text-xs text-temu-gray-text border-b border-dashed border-temu-gray-border pb-4">
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

            {couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Coupon ({couponCode}):</span>
                <span>-${couponDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span>Shipping &amp; Handling:</span>
              <span className="text-emerald-600 font-bold uppercase">Free</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-1">
            <div>
              <span className="text-xs text-gray-400 block font-semibold">Total Amount:</span>
              <span className="text-3xl font-black text-temu-error">${grandTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto bg-temu-orange hover:bg-temu-orange-bright text-white px-8 py-4 rounded-temu-sm font-extrabold text-sm transition-all shadow-lg shadow-temu-orange/30 active:scale-95 cursor-pointer uppercase tracking-wider touch-manipulation text-center"
            >
              Proceed to Payment &rarr;
            </button>
          </div>

          {/* 🆕 Trust strip — تحت زر الدفع، خارج قائمة المبالغ */}
          <div className="flex items-center justify-center gap-4 text-[10px] text-gray-400 pt-2 border-t border-dashed border-temu-gray-border">
            <span>🔒 SSL Secure</span>
            <span>💳 Visa · MC · Apple Pay</span>
            <span>↩️ 30-Day Returns</span>
          </div>
        </div>

      </div>

      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cartItems={cart}
        totalAmount={grandTotal}
        couponCode={couponCode || undefined}   // ✨ كنصيفطو الكود للسيرفر باش يتصادق مرة أخرى
      />
    </div>
  );
}