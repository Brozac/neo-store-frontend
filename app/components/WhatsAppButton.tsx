'use client';

import { useEffect, useState } from 'react';

export default function WhatsAppButton() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const phoneNumber = process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '213555000000';
  const message = 'Hello Laclarc Support, I have a question about an order / product.';

  if (!isMounted) return null;

  return (
    <aside aria-label="Customer Support Channel">
      <a
        href={`https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        /* ✨ موبايل: فوق زر AI Chat مباشرة • ديسكتوب: الموضع الأصلي */
        className="fixed bottom-[10.5rem] right-4 md:bottom-6 md:left-5 md:right-auto z-[61] w-11 h-11 group cursor-pointer"
        title="Chat with us on WhatsApp"
        aria-label="WhatsApp Support"
      >
        {/* الجسم — أصغر (w-11 h-11 بدل w-14 h-14) */}
        <span className="relative w-11 h-11 rounded-full bg-linear-to-br from-[#25D366] to-[#128C7E] shadow-xl flex items-center justify-center border-2 border-white/25 transition-transform duration-300 group-hover:scale-110 group-active:scale-90">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>

          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-300 rounded-full border-2 border-white" />
        </span>

        {/* Tooltip ديسكتوب */}
        <span className="hidden md:block absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#1D1E3C] text-white text-[11px] font-bold py-2 px-3.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-xl pointer-events-none border border-white/10">
          Need help? Chat with us 💬
        </span>
      </a>
    </aside>
  );
}