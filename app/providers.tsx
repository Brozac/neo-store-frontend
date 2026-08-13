// app/providers.tsx
'use client';

import { CartProvider } from './context/CartContext';
import Cartwidget from './components/CartWidget';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import SpinWheel from './components/SpinWheel'; // ✨ استيراد عجلة الحظ

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Navbar />
      {children}
      <Cartwidget />
      <WhatsAppButton />
      <SpinWheel /> {/* ✨ وضعها هنا داخل الـ CartProvider */}
    </CartProvider>
  );
}