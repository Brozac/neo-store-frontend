'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CartProvider } from './context/CartContext';
import CartWidget from './components/CartWidget';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import UtmTracker from './components/UtmTracker';
import SessionBridge from './components/SessionBridge';
import FlyToCart from './components/FlyToCart'; // ✨ FLY_TO_CART_V1 — حركة الطيران للدوك

// 🚀 PERF (Task 20) — الويدجت العائمة الثقيلة ولّاو lazy (dynamic + ssr:false):
// كانو static imports فالـ providers = JS ديالهم كيتحمل فـ **كل صفحة** (حتى admin/auth).
// دابا كيتحمّلو غير ملي المتصفح يحتاجهم — صفر تكلفة فأول paint (ما كيبانوش فالـ SSR أصلاً).
const ExitIntentPopup = dynamic(() => import('./components/ExitIntentPopup'), { ssr: false });
const AIChatWidget = dynamic(() => import('./components/AIChatWidget'), { ssr: false });
const GlassDock = dynamic(() => import('./components/GlassDock'), { ssr: false });
const FloatingSupport = dynamic(() => import('./components/floating/FloatingSupport'), { ssr: false }); // 🆕 يحتوي WhatsApp + AI FAB

// 🎡 WHEEL_MOUNT_GATE — import dynamic جاهز: ملي تكامل wheel-token يكمل،
// شعل غير سطر <SpinWheel /> تحت — وماش حتاج تبدل الـ import.
const SpinWheel = dynamic(() => import('./components/SpinWheel'), { ssr: false });


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
      <SessionBridge />

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
          <FlyToCart /> {/* ✨ FLY_TO_CART_V1 — مستمع حركة الطيران */}
        </>
      )}
    </CartProvider>
  );
}