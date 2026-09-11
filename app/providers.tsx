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
import UtmTracker from './components/UtmTracker'; // ✨ تم إضافة الاستيراد لمنع خطأ البناء

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // ✨ عزل مسارات لوحة تحكم الأدمن
  const isAdminRoute = pathname?.startsWith('/admin');

  // ✨ تسجيل Service Worker في بيئة الإنتاج فقط
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
      {/* ✨ التقاط معلمات إعلانات فيسبوك وتيك توك تلقائياً */}
      <UtmTracker />

      {/* عرض الهيدر فقط للمشترين (مرة واحدة فقط) */}
      {!isAdminRoute && <Navbar />}

      <div className={!isAdminRoute ? 'pb-20 md:pb-0' : ''}>
        {children}
      </div>

      {/* ✨ الفوتر محمي ومعزول — يظهر فقط في صفحات المتجر للزبائن */}
      {!isAdminRoute && <Footer />}

      {/* المكونات التفاعلية العائمة تظهر فقط لزبائن المتجر */}
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