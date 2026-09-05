'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CartProvider } from './context/CartContext';
import CartWidget from './components/CartWidget';
import Navbar from './components/Navbar';
import WhatsAppButton from './components/WhatsAppButton';
import SpinWheel from './components/SpinWheel';

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // ✨ التحقق مما إذا كانت الصفحة الحالية تابعة للوحة تحكم الأدمن
  const isAdminRoute = pathname?.startsWith('/admin');

  // ✨ تسجيل Service Worker في بيئة الإنتاج فقط لتفادي مشاكل الكاش أثناء التطوير
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('✅ Service Worker registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.warn('Service Worker registration skipped/failed:', error);
          });
      });
    }
  }, []);

  return (
    <CartProvider>
      {/* عرض الهيدر فقط للمشترين وليس داخل لوحة تحكم الأدمن */}
      {!isAdminRoute && <Navbar />}

      <div className={!isAdminRoute ? 'pb-20 md:pb-0' : ''}>
        {children}
      </div>
      
      {/* المكونات العائمة تظهر فقط في صفحات المتجر للزبائن */}
      {!isAdminRoute && (
        <>
          <CartWidget />
          <WhatsAppButton />
          <SpinWheel />
        </>
      )}
    </CartProvider>
  );
}