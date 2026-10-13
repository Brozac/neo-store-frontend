'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { getStoredUtm } from './UtmTracker'; // ✨ استيراد دالة التتبع

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: any[];
  totalAmount: number;
  couponCode?: string;
}

const ALL_GATEWAYS = ['stripe', 'paysera', 'crypto', 'baridimob'];

export default function PaymentModal({ isOpen, onClose, cartItems, totalAmount, couponCode }: PaymentModalProps) {
  const router = useRouter();
  const { clearCart, finalTotal } = useCart();

  const [loadingGateway, setLoadingGateway] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [manualPayment, setManualPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploaded, setReceiptUploaded] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerZip, setCustomerZip] = useState('');
  const [copied, setCopied] = useState(false);

  const [enabledGateways, setEnabledGateways] = useState<string[]>(ALL_GATEWAYS);
  const [gatewaysLoaded, setGatewaysLoaded] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

  const EXCHANGE_RATE = Number(process.env.NEXT_PUBLIC_USD_TO_DZD_RATE) || 255;
  const effectiveTotal = finalTotal > 0 ? finalTotal : totalAmount;
  const totalAmountDZD = Math.round(effectiveTotal * EXCHANGE_RATE);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/payment/gateways`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data.enabled)) {
          setEnabledGateways(data.enabled);
        }
      } catch {
        // fail-open
      } finally {
        if (!cancelled) setGatewaysLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, API_BASE_URL]);

  if (!isOpen) return null;

  const isEnabled = (key: string) => enabledGateways.includes(key);
  const noGatewaysAvailable = gatewaysLoaded && enabledGateways.length === 0;

  // 🩹 TRUST FIX — routing map: البوابات الديناميكية → المسارات الصحيحة
  //    stripe → /api/create-checkout-session (المسار الملك الوحيد — limiter + cancel-atomic + masked errors)
  //    paysera/crypto → /api/payment/{method} (كما هي)
  const PAYMENT_ROUTES: Record<string, string> = {
    stripe: '/api/create-checkout-session',
    paysera: '/api/payment/paysera',
    crypto: '/api/payment/crypto',
  };

  const handlePayment = async (method: string) => {
    setLoadingGateway(method);
    setError('');

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const utmData = getStoredUtm(); // ✨ جلب مصدر الإعلان

      const route = PAYMENT_ROUTES[method] || `/api/payment/${method}`;
      const res = await fetch(`${API_BASE_URL}${route}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cartItems,
          totalAmount: effectiveTotal,
          origin: window.location.origin,
          couponCode: couponCode || null,
          utm: utmData // ✨ تمرير كائن UTM للبوابة
        })
      });
      const data = await res.json();

      if (data.url) {
        // 🩹 M#52 — احفظ order_number للعرض في صفحة الشكر
        if (data.orderNumber) sessionStorage.setItem('last_order_number', data.orderNumber);
        window.location.href = data.url;
      } else {
        setError(data.error || `Failed to initiate ${method} payment.`);
      }
    } catch {
      setError('Server connection error. Please try again.');
    } finally {
      setLoadingGateway(null);
    }
  };

  const handleBaridiMobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiptFile) {
      setError('يرجى رفع صورة إيصال التحويل البنكي.');
      return;
    }

    setLoadingGateway('baridimob');
    setError('');

    const shippingData = {
      line1: customerAddress.trim(),
      city: customerCity.trim(),
      state: customerState.trim(),
      postal_code: customerZip.trim(),
      country: 'DZ'
    };

    try {
      const utmData = getStoredUtm(); // ✨ جلب مصدر الإعلان لبريدي موب

      const formData = new FormData();
      formData.append('receipt', receiptFile);
      formData.append('totalAmount', String(totalAmountDZD));
      formData.append('items', JSON.stringify(cartItems));
      formData.append('couponCode', couponCode || '');
      formData.append('utm', JSON.stringify(utmData)); // ✨ توثيق إعلان بريدي موب

      formData.append('customerName', customerName.trim());
      formData.append('customerPhone', customerPhone.trim());
      formData.append('customerEmail', customerEmail.trim());
      formData.append('customerAddress', JSON.stringify(shippingData));

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE_URL}/api/payment/manual`, {
        method: 'POST',
        headers,
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.orderNumber) sessionStorage.setItem('last_order_number', data.orderNumber);
        setReceiptUploaded(true);
        clearCart();
      } else {
        setError(data.error || 'Failed to submit receipt verification.');
      }
    } catch {
      setError('Server connection error.');
    } finally {
      setLoadingGateway(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-temu-sm max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>

        {!manualPayment ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-black text-temu-black">Select Payment Gateway</h2>
                <p className="text-xs text-temu-gray-light">Instant automated fulfillment upon confirmation</p>
              </div>
              <button onClick={onClose} className="text-temu-gray-light hover:text-temu-black p-1 text-sm font-bold">✕</button>
            </div>

            {error && <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-xs font-bold text-center">{error}</div>}

            {noGatewaysAvailable ? (
              <div className="bg-amber-50 text-amber-700 p-4 rounded-temu-sm text-xs font-bold text-center">
                No payment method is available at the moment. Please try again later.
              </div>
            ) : (
              <div className="space-y-3">
                {isEnabled('stripe') && (
                  <button
                    onClick={() => handlePayment('stripe')}
                    disabled={loadingGateway !== null}
                    className="w-full flex items-center justify-between p-4 border-2 border-temu-gray-border-light rounded-temu-sm hover:border-temu-orange transition cursor-pointer active:scale-95 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#635BFF]/10 text-[#635BFF] rounded-xl flex items-center justify-center font-black text-xs">
                        💳
                      </div>
                      <div>
                        <span className="font-extrabold text-temu-black text-sm block">Credit &amp; Debit Cards</span>
                        <span className="text-[11px] text-temu-gray-light">Visa, MasterCard, Apple Pay (Stripe)</span>
                      </div>
                    </div>
                    {loadingGateway === 'stripe' ? <div className="w-4 h-4 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div> : <span className="text-xs text-temu-orange font-bold">&rarr;</span>}
                  </button>
                )}

                {isEnabled('paysera') && (
                  <button
                    onClick={() => handlePayment('paysera')}
                    disabled={loadingGateway !== null}
                    className="w-full flex items-center justify-between p-4 border-2 border-temu-gray-border-light rounded-temu-sm hover:border-temu-orange transition cursor-pointer active:scale-95 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs">
                        🇪🇺
                      </div>
                      <div>
                        <span className="font-extrabold text-temu-black text-sm block">Paysera Checkout</span>
                        <span className="text-[11px] text-temu-gray-light">European SEPA &amp; Global Cards</span>
                      </div>
                    </div>
                    {loadingGateway === 'paysera' ? <div className="w-4 h-4 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div> : <span className="text-xs text-temu-orange font-bold">&rarr;</span>}
                  </button>
                )}

                                {isEnabled('crypto') && (
                  <button
                    onClick={() => handlePayment('crypto')}
                    disabled={loadingGateway !== null}
                    className="w-full flex items-center justify-between p-4 border-2 border-emerald-500/30 bg-emerald-50/30 rounded-temu-sm hover:border-emerald-500 transition cursor-pointer active:scale-95 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/15 text-emerald-600 rounded-xl flex items-center justify-center font-black text-base">
                        💎
                      </div>
                      <div>
                        <span className="font-extrabold text-temu-black text-sm block">Crypto — Stablecoins</span>
                        <span className="text-[11px] text-temu-gray-light block">
                          USDT · USDC <span className="font-bold text-emerald-600">(TRC-20 / BEP-20)</span>
                        </span>
                        <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Instant • ~$0.25 fee • No volatility
                        </span>
                      </div>
                    </div>
                    {loadingGateway === 'crypto' ? (
                      <div className="w-4 h-4 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="text-xs text-emerald-600 font-bold">&rarr;</span>
                    )}
                  </button>
                )}

                {isEnabled('baridimob') && (
                  <button
                    onClick={() => setManualPayment(true)}
                    disabled={loadingGateway !== null}
                    className="w-full flex items-center justify-between p-4 border-2 border-emerald-500/30 bg-emerald-50/20 rounded-temu-sm hover:border-emerald-500 transition cursor-pointer active:scale-95 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600/10 text-emerald-600 rounded-xl flex items-center justify-center font-black text-lg">
                        🇩🇿
                      </div>
                      <div>
                        <span className="font-extrabold text-temu-black text-sm block">BaridiMob / CCP</span>
                        <span className="text-[11px] text-emerald-700 font-bold">الدفع عبر تطبيق بريدي موب (الجزائر)</span>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-600 font-bold">&rarr;</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            <button
              onClick={() => { setManualPayment(false); setError(''); }}
              className="text-temu-orange font-bold text-xs mb-4 flex items-center gap-1 cursor-pointer active:scale-95 transition"
            >
              &larr; Back to Payment Gateways
            </button>

            {!receiptUploaded ? (
              <form onSubmit={handleBaridiMobSubmit} className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">🇩🇿</span>
                  <h2 className="text-lg font-black text-temu-black">تحويل بريدي موب / CCP</h2>
                </div>

                <input
                  type="text"
                  placeholder="الاسم واللقب الكامل *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                />

                <input
                  type="tel"
                  placeholder="رقم الهاتف للتواصل (مثال: 0555123456) *"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                />

                <input
                  type="email"
                  placeholder="البريد الإلكتروني لاستلام التتبع *"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  required
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                />

                <input
                  type="text"
                  placeholder="العنوان التفصيلي (الشارع، رقم المنزل...) *"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  required
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="البلدية / المدينة *"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                  />
                  <input
                    type="text"
                    placeholder="الولاية *"
                    value={customerState}
                    onChange={(e) => setCustomerState(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                  />
                </div>

                <input
                  type="text"
                  placeholder="الرمز البريدي (مثال: 16000) *"
                  value={customerZip}
                  onChange={(e) => setCustomerZip(e.target.value)}
                  required
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-xs focus:outline-none focus:border-temu-orange"
                />

                <div dir="rtl" className="bg-emerald-50/50 p-4 rounded-temu-sm border border-emerald-500/30 text-right">
                  <p className="text-xs text-temu-gray-text mb-2">
                    يرجى تحويل مبلغ <strong className="text-temu-error font-black text-sm">{totalAmountDZD.toLocaleString()} دج</strong> إلى الحساب:
                  </p>

                  <div className="flex items-center justify-between bg-white p-2.5 rounded border border-gray-200 gap-2">
                    <p dir="ltr" className="font-mono font-bold text-xs select-all text-gray-800">
                      RIP: 00799999 00012345678 90
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('007999990001234567890');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-bold text-white transition ${copied ? 'bg-emerald-600' : 'bg-temu-orange'}`}
                    >
                      {copied ? 'تم النسخ ✓' : 'نسخ'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-temu-black mb-1">رفع صورة إيصال التحويل *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    required
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-temu-orange file:text-white cursor-pointer"
                  />
                </div>

                {error && <div className="bg-red-50 text-temu-error p-2.5 rounded text-xs font-bold text-center">{error}</div>}

                <button
                  type="submit"
                  disabled={loadingGateway !== null}
                  className="w-full bg-temu-orange hover:bg-temu-orange-bright text-white font-extrabold p-3.5 rounded-temu-sm transition flex justify-center items-center cursor-pointer disabled:opacity-50 active:scale-95 shadow-md text-sm gap-2"
                >
                  {loadingGateway === 'baridimob' ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'تأكيد وإرسال الإيصال للمراجعة'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                  ✓
                </div>
                <h2 className="text-lg font-black text-temu-black">تم استلام طلبك بنجاح!</h2>
                <p className="text-xs text-temu-gray-text leading-relaxed">
                  سيقوم فريقنا بمراجعة وصل التحويل وإرسال رقم التتبع إلى بريدك الإلكتروني وهاتفك فور تأكيد الطلب مع CJ Dropshipping.
                </p>
                <button
                  onClick={() => { onClose(); router.push('/'); }}
                  className="bg-temu-black text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-dark transition active:scale-95 text-xs mt-4"
                >
                  العودة للمتجر
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}