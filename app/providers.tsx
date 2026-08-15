'use client';

import { useEffect } from 'react'; // ✨ تمت الإضافة
import { CartProvider } from './context/CartContext';
import Cartwidget from './components/CartWidget';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import SpinWheel from './components/SpinWheel';

export function Providers({ children }: { children: React.ReactNode }) {
  // ✨ تسجيل الـ Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('✅ Service Worker registered successfully.', registration))
        .catch(error => console.log('❌ Service Worker registration failed:', error));
    }
  }, []);

  return (
    <CartProvider>
      <Navbar />
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      
      <Cartwidget />
      <WhatsAppButton />
      <SpinWheel />
    </CartProvider>
  );
}