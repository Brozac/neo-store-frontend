'use client'; // ✨ ضروري لتفعيل النافذة المنبثقة للتثبيت
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      alert('To install the app: Open your browser menu and select "Add to Home Screen".');
    }
  };

  return (
    <footer className="bg-white border-t border-temu-gray-border-light mt-12">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* عمود المتجر */}
          <div>
            <h3 className="text-xl font-extrabold text-temu-black mb-4">Laclarc</h3>
            <p className="text-sm text-temu-gray-text leading-relaxed">
              Your trusted destination for quality products. We provide worldwide shipping and secure payment methods.
            </p>
          </div>

          {/* عمود الدعم والتواصل */}
          <div>
            <h3 className="text-lg font-bold text-temu-black mb-4">Customer Support</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-temu-gray-text">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <a href="mailto:support@neostore.com" className="hover:text-temu-orange transition">support@laclarc.com</a>
              </li>
              <li className="text-temu-gray-text">Available 24/7 for your inquiries</li>
            </ul>
          </div>

          {/* عمود السياسات القانونية */}
          <div>
            <h3 className="text-lg font-bold text-temu-black mb-4">Policies</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/refund" className="text-temu-gray-text hover:text-temu-orange transition">Refund & Return Policy</Link></li>
              <li><Link href="/privacy" className="text-temu-gray-text hover:text-temu-orange transition">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-temu-gray-text hover:text-temu-orange transition">Terms of Service</Link></li>
            </ul>
          </div>

          {/* عمود تحميل التطبيق */}
          <div>
            <h3 className="text-lg font-bold text-temu-black mb-4">Download Our App</h3>
            <div className="flex flex-col gap-3">
              {/* ✨ ربط الزر بحدث التثبيت */}
              <a href="#" onClick={handleInstallClick} className="flex items-center gap-3 bg-temu-black rounded-xl px-4 py-2.5 hover:bg-temu-dark transition cursor-pointer active:scale-95 w-full max-w-45">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5Z" fill="#42A5F5"/>
                  <path d="M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12Z" fill="#FFC107"/>
                  <path d="M20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81Z" fill="#FF3D00"/>
                  <path d="M6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z" fill="#4CAF50"/>
                </svg>
                <div className="text-left">
                  <p className="text-[9px] text-gray-400 leading-none">GET IT ON</p>
                  <p className="text-sm font-bold text-white leading-tight">Google Play</p>
                </div>
              </a>
              
              {/* ✨ ربط الزر بحدث التثبيت */}
              <a href="#" onClick={handleInstallClick} className="flex items-center gap-3 bg-temu-black rounded-xl px-4 py-2.5 hover:bg-temu-dark transition cursor-pointer active:scale-95 w-full max-w-45">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09 22C7.77 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.35C5.58 7.78 7.21 6.83 9 6.79C10.29 6.77 11.5 7.63 12.29 7.63C13.07 7.63 14.55 6.59 16.07 6.75C16.7 6.78 18.5 7 19.66 8.66C19.57 8.72 17.5 9.94 17.52 12.34C17.55 15.27 20.1 16.13 20.13 16.14C20.1 16.21 19.71 17.6 18.71 19.5ZM13 3.5C13.73 2.7 14.94 2.6 15.5 2.58C15.58 3.21 15.35 4.5 14.7 5.3C14.1 6.05 13.13 6.6 12.27 6.53C12.17 5.83 12.47 4.65 13 3.5Z"/>
                </svg>
                <div className="text-left">
                  <p className="text-[9px] text-gray-400 leading-none">Download on the</p>
                  <p className="text-sm font-bold text-white leading-tight">App Store</p>
                </div>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-temu-gray-border-light pt-6 text-center">
          <p className="text-xs text-temu-gray-light">
            © {new Date().getFullYear()} Laclarc. All rights reserved. Powered by Stripe Secure Payments.
          </p>
        </div>
      </div>
    </footer>
  );
}