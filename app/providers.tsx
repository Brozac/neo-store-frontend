// app/providers.tsx
'use client';

import { CartProvider } from './context/CartContext';
import Cartwidget from './components/CartWidget';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import SpinWheel from './components/SpinWheel';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Navbar />
      {/* 
        إضافة pb-20 md:pb-0 لتوفير مساحة في الأسفل على الهواتف 
        حتى لا تتداخل الأزرار العائمة مع شريط التنقل السفلي 
      */}
      <div className="pb-20 md:pb-0">
        {children}
      </div>
      
      <Cartwidget />
      <WhatsAppButton />
      <SpinWheel />
    </CartProvider>
  );
}