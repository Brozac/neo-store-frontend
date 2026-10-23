'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GlassIcon from '@/components/ui/GlassIcon';

export default function CancelPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#FBFAFE] p-4 sm:p-6 text-center font-sans">
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full space-y-6">
        
        {/* Reassurance Badge */}
        <div className="w-16 h-16 bg-butter-up-50 text-butter-up-500 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner ring-8 ring-butter-up-50/50">
          <GlassIcon ch="⚠️" size="xs" />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#17171A]">Checkout Incomplete</h1>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">
            No charges were made to your account. Your cart items are still safely reserved for you.
          </p>
        </div>

        {/* Helpful Alternatives Box */}
        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs text-left space-y-2 text-gray-600">
          <p className="font-bold text-gray-800 mb-1">Encountered an issue?</p>
          <p>&bull; <strong>Card declined?</strong> You can try an alternative card, Paysera, or Crypto.</p>
          <p>&bull; <strong>In Algeria?</strong> You can pay directly via BaridiMob / CCP.</p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <Link 
            href="/cart" 
            className="block w-full bg-linear-to-r from-[#6B3DB4] to-[#5B2F9E] hover:brightness-110 text-white font-extrabold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-[#6B3DB4]/20 active:scale-95"
          >
            Review Cart & Try Again &rarr;
          </Link>

          <Link 
            href="/" 
            className="block w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-xl text-xs uppercase tracking-wider transition active:scale-95"
          >
            Continue Shopping
          </Link>
        </div>

        <div className="pt-2 border-t border-gray-100 text-[11px] text-gray-400">
          Need assistance? Reach our 24/7 team at{' '}
          <a href="mailto:support@laclarc.com" className="text-[#6B3DB4] font-bold hover:underline">
            support@laclarc.com
          </a>
        </div>

      </div>
    </main>
  );
}