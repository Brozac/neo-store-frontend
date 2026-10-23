'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GlassIcon from '@/components/ui/GlassIcon';

export default function Footer() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(() => {
        setDeferredPrompt(null);
      });
    } else {
      // إظهار إرشادات التثبيت المخصصة لهواتف آبل والمتصفحات الأخرى
      setShowIosGuide(true);
    }
  };

  return (
    <footer className="bg-[#141418] text-gray-300 border-t border-white/10 mt-16 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12 mb-12">
          
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-block">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-wider">Laclarc</span>
            </Link>
            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed max-w-sm">
              Your global flagship store for curated lifestyle gear, electric grooming innovations, and verified daily essentials. Fully automated worldwide fulfillment with bank-grade security.
            </p>
            <div className="pt-2 flex items-center gap-3 text-xs text-maroccan-tea-400 font-bold">
              <span><GlassIcon ch="🛡️" size="xs" /> 100% Buyer Protection Guaranteed</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">Storefront</h3>
            <ul className="space-y-2.5 text-xs text-gray-400 font-medium">
              <li><Link href="/" className="hover:text-white transition">Trending Home</Link></li>
              <li><Link href="/categories" className="hover:text-white transition">All Departments</Link></li>
              <li><Link href="/track-order" className="hover:text-white transition">Track Shipment</Link></li>
              <li><Link href="/favorites" className="hover:text-white transition">Saved Wishlist</Link></li>
              <li><Link href="/cart" className="hover:text-white transition">Shopping Bag</Link></li>
            </ul>
          </div>

          {/* Customer Support & Policies */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">Trust & Policies</h3>
            <ul className="space-y-2.5 text-xs text-gray-400 font-medium">
              <li><Link href="/refund" className="hover:text-white transition">Refund & Return Policy</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition">Privacy Policy (GDPR)</Link></li>
              <li><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></li>
              <li className="pt-2">
                <a href="mailto:support@laclarc.com" className="text-gray-300 hover:text-[#7FA1C4] font-bold transition flex items-center gap-1.5">
                  <span><GlassIcon ch="✉️" size="xs" /></span> support@laclarc.com
                </a>
              </li>
              <li className="text-[11px] text-gray-500">24/7 Automated & AI Support</li>
            </ul>
          </div>

          {/* PWA App Install */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-white mb-4">Install Store App</h3>
            <p className="text-[11px] text-gray-400 mb-4">Install our app for instant order tracking and lightning speed.</p>
            
            <div className="flex flex-col gap-2.5">
              {/* Google Play / Android PWA Button */}
              <button 
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-3 bg-[#24334A] border border-white/10 rounded-xl px-4 py-2.5 hover:border-[#5B7EA6] transition cursor-pointer active:scale-95 text-left shadow-sm"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 20.5V3.5C3 2.91 3.34 2.39 3.84 2.15L13.69 12L3.84 21.85C3.34 21.61 3 21.09 3 20.5Z" fill="#42A5F5"/>
                  <path d="M16.81 15.12L6.05 21.34L14.54 12.85L16.81 15.12Z" fill="#FFC107"/>
                  <path d="M20.16 10.81C20.5 11.08 20.75 11.5 20.75 12C20.75 12.5 20.53 12.9 20.18 13.18L17.89 14.5L15.39 12L17.89 9.5L20.16 10.81Z" fill="#FF3D00"/>
                  <path d="M6.05 2.66L16.81 8.88L14.54 11.15L6.05 2.66Z" fill="#4CAF50"/>
                </svg>
                <div>
                  <p className="text-[8px] text-gray-400 uppercase leading-none font-bold">Install App on</p>
                  <p className="text-xs font-black text-white leading-tight mt-0.5">Google Play &bull; Android</p>
                </div>
              </button>
              
              {/* Apple Store / iOS PWA Button */}
              <button 
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-3 bg-[#24334A] border border-white/10 rounded-xl px-4 py-2.5 hover:border-[#5B7EA6] transition cursor-pointer active:scale-95 text-left shadow-sm"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09 22C7.77 22.05 6.8 20.68 5.96 19.47C4.25 17 2.94 12.45 4.7 9.35C5.58 7.78 7.21 6.83 9 6.79C10.29 6.77 11.5 7.63 12.29 7.63C13.07 7.63 14.55 6.59 16.07 6.75C16.7 6.78 18.5 7 19.66 8.66C19.57 8.72 17.5 9.94 17.52 12.34C17.55 15.27 20.1 16.13 20.13 16.14C20.1 16.21 19.71 17.6 18.71 19.5ZM13 3.5C13.73 2.7 14.94 2.6 15.5 2.58C15.58 3.21 15.35 4.5 14.7 5.3C14.1 6.05 13.13 6.6 12.27 6.53C12.17 5.83 12.47 4.65 13 3.5Z"/>
                </svg>
                <div>
                  <p className="text-[8px] text-gray-400 uppercase leading-none font-bold">Add to Screen</p>
                  <p className="text-xs font-black text-white leading-tight mt-0.5">Apple iOS &bull; Safari</p>
                </div>
              </button>
            </div>
          </div>

        </div>

        {/* Payment Methods Trust Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-[11px] text-gray-400 font-medium">
            &copy; {new Date().getFullYear()} <strong className="text-white">Laclarc</strong>. All rights reserved. Powered by Stripe, Paysera, and NowPayments.
          </p>

          <div className="flex items-center gap-4 text-xs font-semibold text-gray-400 flex-wrap justify-center">
            <span> Visa & MasterCard</span>
            <span> Apple Pay</span>
            <span> USDT & Crypto</span>
          </div>
        </div>

      </div>

      {/* iOS & Browser PWA Guide Modal */}
      {showIosGuide && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" 
          onClick={() => setShowIosGuide(false)}
        >
          <div 
            className="bg-[#141418] border border-white/20 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-fog-500/20 text-[#5B7EA6] rounded-2xl flex items-center justify-center text-2xl mx-auto">
              <GlassIcon ch="📲" size="xs" />
            </div>
            <h3 className="text-base font-black text-white">How to Install Laclarc App</h3>
            <div className="text-xs text-gray-300 space-y-2 text-left bg-[#24334A] p-4 rounded-xl border border-white/5">
              <p><strong>On iPhone (Safari):</strong> Tap the <strong>Share</strong> button <span className="text-lg"><GlassIcon ch="⎋" size="xs" /></span> at the bottom of Safari, then choose <strong>&ldquo;Add to Home Screen&rdquo;</strong>.</p>
              <p className="pt-1"><strong>On Android / Chrome:</strong> Tap the 3 dots (menu) at the top right, then select <strong>&ldquo;Install App&rdquo;</strong>.</p>
            </div>
            <button 
              onClick={() => setShowIosGuide(false)}
              className="w-full bg-[#5B7EA6] hover:bg-[#46648A] text-white font-extrabold py-3 rounded-xl text-xs uppercase tracking-wider transition active:scale-95"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </footer>
  );
}