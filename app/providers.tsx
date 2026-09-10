'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CartProvider } from './context/CartContext';
import CartWidget from './components/CartWidget';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import SpinWheel from './components/SpinWheel';
import ExitIntentPopup from './components/ExitIntentPopup';
import AIChatWidget from './components/AIChatWidget';
import Footer from './components/Footer';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ✨ التحقق مما إذا كانت الصفحة الحالية تابعة للوحة تحكم الأدمن
  const isAdminRoute = pathname?.startsWith('/admin');

  // ✨ تسجيل Service Worker في الإنتاج فقط
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      // ✨ Guard: إلا فات حدث load قبل الـ mount (hydration بطيء) — نسجل مباشرة
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
      {/* عرض الهيدر فقط للمشترين وليس داخل لوحة تحكم الأدمن */}
      {!isAdminRoute && <Navbar />}

      <div className={!isAdminRoute ? 'pb-20 md:pb-0' : ''}>
        {children}
      </div>

      {/* ✨ Footer انضم للعزل — كيبان فقط في واجهة المتجر */}
      {!isAdminRoute && <Footer />}

      {/* المكونات العائمة تظهر فقط في صفحات المتجر للزبائن */}
      {!isAdminRoute && (
        <>
          <CartWidget />
          <WhatsAppButton />
          <AIChatWidget />
          <SpinWheel />
          <ExitIntentPopup />
        </>
      )}
    </CartProvider>
  );
}