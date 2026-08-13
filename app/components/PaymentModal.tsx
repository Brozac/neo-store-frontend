'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';

interface CartItem {
  id: string | number;
  name: string;
  price: number | string;
  image_url?: string;
  quantity: number;
  vid?: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalAmount: number;
}

export default function PaymentModal({ isOpen, onClose, cartItems, totalAmount }: PaymentModalProps) {
  const router = useRouter();
  const { clearCart } = useCart();
  
  const [loadingGateway, setLoadingGateway] = useState<string | null>(null);
  const [error, setError] = useState('');

  // حالات الدفع اليدوي (BaridiMob)
  const [manualPayment, setManualPayment] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploaded, setReceiptUploaded] = useState(false);

  // حالات معلومات العميل (الخاصة بـ BaridiMob)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState(''); // الولاية
  const [customerZip, setCustomerZip] = useState(''); // الرمز البريدي

  const EXCHANGE_RATE = 255; // سعر الصرف الموازي
  const totalAmountDZD = Math.round(totalAmount * EXCHANGE_RATE);

  if (!isOpen) return null;

  // ✨ دالة موحدة لبوابات الدفع التلقائية (Stripe, Paysera, Crypto)
  const handlePayment = async (method: string) => {
    setLoadingGateway(method);
    setError('');
    
    try {
      // ✨ جلب التوكن لإرساله مع الطلب
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`https://neo-store-backend.onrender.com/api/payment/${method}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ items: cartItems, totalAmount })
      });
      const data = await res.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || `Failed to initiate ${method} payment.`);
      }
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setLoadingGateway(null);
    }
  };

  // ✨ دالة الدفع اليدوي (BaridiMob)
  const handleBaridiMobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!receiptFile) {
      setError('Please upload your receipt image.');
      return;
    }

    setLoadingGateway('baridimob');
    setError('');

    const shippingData = {
      line1: customerAddress,
      city: customerCity,
      state: customerState,
      postal_code: customerZip,
      country: 'DZ'
    };

    try {
      const formData = new FormData();
      formData.append('receipt', receiptFile);
      formData.append('totalAmount', String(totalAmount));
      formData.append('items', JSON.stringify(cartItems));
      
      formData.append('customerName', customerName);
      formData.append('customerPhone', customerPhone);
      formData.append('customerEmail', customerEmail);
      formData.append('customerAddress', JSON.stringify(shippingData));

      // ✨ جلب التوكن وإرساله حتى في الدفع اليدوي
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('https://neo-store-backend.onrender.com/api/payment/manual', {
        method: 'POST',
        headers, // لا نضع Content-Type هنا لأنه FormData
        body: formData
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        setReceiptUploaded(true);
        clearCart();
      } else {
        setError(data.error || 'Failed to submit order.');
      }
    } catch (err) {
      setError('Server connection error.');
    } finally {
      setLoadingGateway(null);
    }
  };

  // قائمة بوابات الدفع مع الشعارات
  const paymentMethods = [
    { 
      id: 'stripe', 
      name: 'Stripe', 
      desc: 'Visa, Mastercard, Apple Pay',
      logo: 'https://z-cdn-media.chatglm.cn/files/358c145a-fb8b-48f2-95d5-b49a648a8c44.png?auth_key=1886044937-1c4f7f5aa4e44fe0800391a8a31fbcb7-0-12366c60569641acdfcc752fca0a7810',
      enabled: false // معطل حالياً كما ذكرت
    },
    { 
      id: 'paysera', 
      name: 'Paysera', 
      desc: 'Visa, Mastercard',
      logo: 'https://z-cdn-media.chatglm.cn/files/92ad2a9b-cec3-4e63-aa05-25664f7cf882.png?auth_key=1886044937-b3f8d967c7084db7a1abde152a184b2a-0-8d978b6aa5c9d0c8d55e3d70f3b086f0',
      enabled: true
    },
    { 
      id: 'crypto', 
      name: 'Crypto', 
      desc: 'USDT, USDC',
      logo: 'https://z-cdn-media.chatglm.cn/files/9137a979-4aed-450a-920c-f95aa4998a4e.png?auth_key=1886044937-78f8864fc9bc452d8c78ba8570d91b5b-0-84ad63af9d91b74a678f8bcbef0da8b4',
      enabled: true
    },
    { 
      id: 'manual', 
      name: 'BaridiMob / CCP', 
      desc: 'Algeria Only',
      logo: 'https://z-cdn-media.chatglm.cn/files/3e22e910-6040-4fdc-8395-89205324f443.png?auth_key=1886044937-8d9c5237137f42778451e6c9a7d0896d-0-747c3859e4e50dbe496c05f8d2343c2b',
      enabled: true  
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-temu-sm max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        {!manualPayment ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Select Payment Method</h2>
              <button onClick={onClose} className="text-temu-gray-light hover:text-temu-black cursor-pointer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {error && <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-sm font-medium text-center">{error}</div>}

            <div className="space-y-3">
              {paymentMethods.filter(method => method.enabled).map((method) => (
                <button 
                  key={method.id} 
                  onClick={() => {
                    setError('');
                    if (method.id === 'manual') setManualPayment(true);
                    else handlePayment(method.id);
                  }} 
                  disabled={loadingGateway !== null} 
                  className="w-full flex items-center justify-between p-4 border-2 border-temu-gray-border-light rounded-temu-sm hover:border-temu-orange transition cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <img src={method.logo} alt={method.name} className="h-8 w-8 object-contain rounded-full" />
                    <div className="flex flex-col items-start text-left">
                      <span className="font-bold text-temu-black">{method.name}</span>
                      <span className="text-xs text-temu-gray-light">{method.desc}</span>
                    </div>
                  </div>
                  {loadingGateway === method.id && (
                    <div className="w-5 h-5 border-2 border-temu-orange border-t-transparent rounded-full animate-spin"></div>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          /* واجهة الدفع اليدوي (BaridiMob) */
          <div>
            <button onClick={() => { setManualPayment(false); setError(''); }} className="text-temu-orange font-bold text-sm mb-4 flex items-center gap-1 cursor-pointer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Back to Payment Methods
            </button>

            {!receiptUploaded ? (
              <form onSubmit={handleBaridiMobSubmit}>
                <div className="flex items-center gap-3 mb-4">
                  <img src="https://z-cdn-media.chatglm.cn/files/3e22e910-6040-4fdc-8395-89205324f443.png?auth_key=1886044937-8d9c5237137f42778451e6c9a7d0896d-0-747c3859e4e50dbe496c05f8d2343c2b" alt="BaridiMob" className="h-10 w-10 object-contain" />
                  <h2 className="text-xl font-extrabold text-temu-black">BaridiMob / CCP</h2>
                </div>
                
                {/* حقول معلومات الشحن المفصلة */}
                <div className="space-y-3 mb-4">
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number (e.g., 0555...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                  />
                  <input 
                    type="email" 
                    placeholder="Email Address"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                  />
                  <input 
                    type="text" 
                    placeholder="Address (Street, Building, House No...)"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    required
                    className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                  />
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="City / Commune"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      required
                      className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                    />
                    <input 
                      type="text" 
                      placeholder="State / Wilaya"
                      value={customerState}
                      onChange={(e) => setCustomerState(e.target.value)}
                      required
                      className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Zip Code (e.g., 16000)"
                    value={customerZip}
                    onChange={(e) => setCustomerZip(e.target.value)}
                    required
                    className="w-full bg-white border border-temu-gray-border rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange"
                  />
                </div>

                <div className="bg-temu-offwhite p-4 rounded-temu-sm mb-4 border border-temu-gray-border-light">
                  <p className="text-sm text-temu-gray-text mb-2">
                    يرجى تحويل مبلغ <span className="font-extrabold text-temu-error text-lg">{totalAmountDZD} DZD</span> 
                    <span className="block text-xs text-temu-gray-light">(ما يعادل ${totalAmount.toFixed(2)})</span>
                    إلى الحساب التالي:
                  </p>
                  <p className="font-bold text-temu-black">RIP: 00799999 00012345678 90</p>
                </div>
                
                <p className="text-sm text-temu-gray-text mb-3">Upload the receipt image below:</p>

                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-temu-black mb-4 file:mr-4 file:py-2 file:px-4 file:rounded-temu-sm file:border-0 file:text-sm file:bg-temu-orange file:text-white hover:file:bg-temu-orange-bright transition cursor-pointer"
                />
                
                {error && <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-sm font-medium text-center">{error}</div>}
                
                <button type="submit" disabled={loadingGateway !== null} className="w-full bg-temu-orange text-white font-bold p-4 rounded-temu-sm hover:bg-temu-orange-bright transition flex justify-center items-center cursor-pointer disabled:opacity-50">
                  {loadingGateway === 'baridimob' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Confirm Payment Sent'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                <svg className="mx-auto mb-4 h-16 w-16 text-temu-green" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <h2 className="text-xl font-bold text-temu-black mb-2">Order Submitted!</h2>
                <p className="text-temu-gray-text text-sm mb-6">Thank you! Your order is pending verification. We will process it shortly.</p>
                <button onClick={() => { onClose(); router.push('/'); }} className="bg-temu-black text-white font-bold py-2 px-6 rounded-temu-sm hover:bg-temu-dark transition cursor-pointer">
                  Back to Home
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}