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
  const EXCHANGE_RATE = 255; 
  const totalAmountDZD = Math.round(totalAmount * EXCHANGE_RATE);

  if (!isOpen) return null;

  const handlePayment = async (method: string) => {
    setLoadingGateway(method);
    setError('');
    
    try {
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

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('https://neo-store-backend.onrender.com/api/payment/manual', {
        method: 'POST',
        headers, 
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

  const paymentMethods = [
    { 
      id: 'stripe', 
      name: 'Stripe', 
      desc: 'Visa, Mastercard, Apple Pay',
      logo: 'https://z-cdn-media.chatglm.cn/files/358c145a-fb8b-48f2-95d5-b49a648a8c44.png?auth_key=1886044937-1c4f7f5aa4e44fe0800391a8a31fbcb7-0-12366c60569641acdfcc752fca0a7810',
      enabled: true 
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
      {/* ✨ إضافة scrollbar-hide touch-pan-y للسحب السلس باللمس داخل المودال */}
      <div className="bg-white rounded-temu-sm max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-hide touch-pan-y" onClick={(e) => e.stopPropagation()}>
        
        {!manualPayment ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-temu-black">Select Payment Method</h2>
              {/* ✨ زر الإغلاق مع تأثير الضغط */}
              <button 
                onClick={onClose} 
                className="text-temu-gray-light hover:text-temu-black cursor-pointer active:scale-90 transition touch-manipulation"
              >
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
                  className="w-full flex items-center justify-between p-4 border-2 border-temu-gray-border-light rounded-temu-sm hover:border-temu-orange transition cursor-pointer disabled:opacity-50 active:scale-95 touch-manipulation"
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
          <div>
            {/* ✨ زر الرجوع مع تأثير الضغط */}
            <button 
              onClick={() => { setManualPayment(false); setError(''); }} 
              className="text-temu-orange font-bold text-sm mb-4 flex items-center gap-1 cursor-pointer active:scale-95 transition touch-manipulation w-fit"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              Back to Payment Methods
            </button>

            {!receiptUploaded ? (
              <form onSubmit={handleBaridiMobSubmit}>
                <div className="flex items-center gap-3 mb-4">
                  <img src="https://z-cdn-media.chatglm.cn/files/3e22e910-6040-4fdc-8395-89205324f443.png?auth_key=1886044937-8d9c5237137f42778451e6c9a7d0896d-0-747c3859e4e50dbe496c05f8d2343c2b" alt="BaridiMob" className="h-10 w-10 object-contain" />
                  <h2 className="text-xl font-extrabold text-temu-black">BaridiMob / CCP</h2>
                </div>
                
                {/* ✨ توحيد خلفيات وحدود حقول الإدخال + إضافة touch-manipulation */}
                <div className="space-y-3 mb-4">
                  <input 
                    type="text" 
                    placeholder="Full Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                  />
                  <input 
                    type="tel" 
                    placeholder="Phone Number (e.g., 0555...)"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                  />
                  <input 
                    type="email" 
                    placeholder="Email Address"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                  />
                  <input 
                    type="text" 
                    placeholder="Address (Street, Building, House No...)"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                  />
                  <div className="flex gap-3">
                    <input 
                      type="text" 
                      placeholder="City / Commune"
                      value={customerCity}
                      onChange={(e) => setCustomerCity(e.target.value)}
                      required
                      className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                    />
                    <input 
                      type="text" 
                      placeholder="State / Wilaya"
                      value={customerState}
                      onChange={(e) => setCustomerState(e.target.value)}
                      required
                      className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                    />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Zip Code (e.g., 16000)"
                    value={customerZip}
                    onChange={(e) => setCustomerZip(e.target.value)}
                    required
                    className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-temu-sm px-4 py-3 text-sm focus:outline-none focus:border-temu-orange transition touch-manipulation" 
                  />
                </div>

                {/* ✨ صندوق رقم الـ RIP مع زر النسخ (RTL للنص العربي) */}
<div dir="rtl" className="bg-temu-offwhite p-4 rounded-temu-sm mb-4 border border-temu-gray-border-light">
  <p className="text-sm text-temu-gray-text mb-3">
    يرجى تحويل مبلغ <span className="font-extrabold text-temu-error text-lg">{totalAmountDZD} DZD</span> 
    <span className="block text-xs text-temu-gray-light">(ما يعادل ${totalAmount.toFixed(2)})</span>
    إلى الحساب التالي:
  </p>
  
  <div className="flex items-center justify-between bg-white p-3 rounded-temu-sm border border-temu-gray-border-light gap-2">
  {/* ✨ إضافة whitespace-nowrap و truncate لضمان بقاء الأرقام في سطر واحد */}
  <p dir="ltr" className="font-bold text-temu-black text-sm sm:text-base select-all whitespace-nowrap overflow-hidden text-ellipsis">RIP : 00799999 00012345678 90</p>
  
  <button 
    type="button"
    onClick={() => {
      navigator.clipboard.writeText('007999990001234567890');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }}
    // ✨ تعديل الحشوة (padding) لتناسب الأيقونة
    className={`p-2 rounded-temu-sm transition active:scale-95 touch-manipulation cursor-pointer shrink-0 flex items-center justify-center text-white ${
      copied ? 'bg-temu-green' : 'bg-temu-orange'
    }`}
    aria-label="Copy RIP"
  >
    {copied ? (
      // أيقونة علامة الصح عند نجاح النسخ
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    ) : (
      // أيقونة النسخ التي أرسلتِها (تم تعديل اللون ليكون أبيض ليتناسب مع الزر)
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <g>
          <path d="M6.59961 11.3974C6.59961 8.67119 6.59961 7.3081 7.44314 6.46118C8.28667 5.61426 9.64432 5.61426 12.3596 5.61426H15.2396C17.9549 5.61426 19.3125 5.61426 20.1561 6.46118C20.9996 7.3081 20.9996 8.6712 20.9996 11.3974V16.2167C20.9996 18.9429 20.9996 20.306 20.1561 21.1529C19.3125 21.9998 17.9549 21.9998 15.2396 21.9998H12.3596C9.64432 21.9998 8.28667 21.9998 7.44314 21.1529C6.59961 20.306 6.59961 18.9429 6.59961 16.2167V11.3974Z"/>
          <path d="M4.17157 3.17157C3 4.34315 3 6.22876 3 10V12C3 15.7712 3 17.6569 4.17157 18.8284C4.78913 19.446 5.6051 19.738 6.79105 19.8761C6.59961 19.0353 6.59961 17.8796 6.59961 16.2167V11.3974C6.59961 8.6712 6.59961 7.3081 7.44314 6.46118C8.28667 5.61426 9.64432 5.61426 12.3596 5.61426H15.2396C16.8915 5.61426 18.0409 5.61426 18.8777 5.80494C18.7403 4.61146 18.4484 3.79154 17.8284 3.17157C16.6569 2 14.7712 2 11 2C7.22876 2 5.34315 2 4.17157 3.17157Z" opacity=".5"/>
        </g>
      </svg>
    )}
  </button>
</div>
</div>
                
                <p className="text-sm text-temu-gray-text mb-3">Upload the receipt image below:</p>

                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-temu-black mb-4 file:mr-4 file:py-2 file:px-4 file:rounded-temu-sm file:border-0 file:text-sm file:bg-temu-orange file:text-white hover:file:bg-temu-orange-bright transition cursor-pointer touch-manipulation"
                />
                
                {error && <div className="bg-red-50 text-temu-error p-3 rounded-temu-sm mb-4 text-sm font-medium text-center">{error}</div>}
                
                {/* ✨ زر التأكيد مع تأثير الضغط ومؤشر التحميل */}
                <button 
                  type="submit" 
                  disabled={loadingGateway !== null} 
                  className="w-full bg-temu-orange text-white font-bold p-4 rounded-temu-sm hover:bg-temu-orange-bright transition flex justify-center items-center cursor-pointer disabled:opacity-50 active:scale-95 touch-manipulation shadow-md gap-2"
                >
                  {loadingGateway === 'baridimob' ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'Confirm Payment Sent'}
                </button>
              </form>
            ) : (
              <div className="text-center py-6">
                <svg className="mx-auto mb-4 h-16 w-16 text-temu-green" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                <h2 className="text-xl font-bold text-temu-black mb-2">Order Submitted!</h2>
                <p className="text-temu-gray-text text-sm mb-6">Thank you! Your order is pending verification. We will process it shortly.</p>
                {/* ✨ زر العودة مع تأثير الضغط */}
                <button 
                  onClick={() => { onClose(); router.push('/'); }} 
                  className="bg-temu-black text-white font-bold py-3 px-6 rounded-temu-sm hover:bg-temu-dark transition cursor-pointer active:scale-95 touch-manipulation shadow-md"
                >
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