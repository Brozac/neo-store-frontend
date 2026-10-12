'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CartProvider } from './context/CartContext';
import CartWidget from './components/CartWidget';
import Navbar from './components/Navbar';
import SpinWheel from './components/SpinWheel';
import ExitIntentPopup from './components/ExitIntentPopup';
import AIChatWidget from './components/AIChatWidget';
import Footer from './components/Footer';
import UtmTracker from './components/UtmTracker';
import GlassDock from './components/GlassDock';
import FloatingSupport from './components/floating/FloatingSupport'; // 🆕 يحتوي WhatsApp + AI FAB

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAdminRoute = pathname?.startsWith('/admin');

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('✅ Service Worker registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.warn('Service Worker registration skipped/failed:', error);
          });
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW, { once: true });
        return () => window.removeEventListener('load', registerSW);
      }
    }
  }, []);

  return (
    <CartProvider>
      {/* ✨ التقاط UTM */}
      <UtmTracker />

      {/* ✨ Navbar — للزبائن فقط */}
      {!isAdminRoute && <Navbar />}

      <div className={!isAdminRoute ? 'pb-20 md:pb-0' : ''}>
        {children}
      </div>

      {/* ✨ Footer — للزبائن فقط */}
      {!isAdminRoute && <Footer />}

      {/* ✨ المكونات العائمة — للزبائن فقط */}
      {!isAdminRoute && (
        <>
          <CartWidget />
          {/* 🆕 FloatingSupport يحتوي WhatsApp FAB + AI Chat FAB */}
          <FloatingSupport />
          <AIChatWidget />       {/* نافذة الشات — بدون FAB مكرر */}
          {/* 🩹 WHEEL_MOUNT_GATE — مؤقتاً مقفول: العجلة كتوعد بخصم ما كانش كيتنفذ (M#47 probe).
              يتفعل بعد بناء wheel-token integration كامل + أول بيانات حملة.
              Backend /api/wheel/claim جاهز — غير رد هاد السطر. */}
          {/* <SpinWheel /> */}
          <ExitIntentPopup />
          <GlassDock />
        </>
      )}
    </CartProvider>
  );
}