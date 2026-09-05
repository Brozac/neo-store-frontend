import Image from 'next/image';
import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative bg-[#0E1020] text-white rounded-3xl overflow-hidden mb-8 border border-white/10 shadow-2xl">
      {/* Background Decorative Mesh Glow */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#8B78C6]/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#FF6B9D]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-12 lg:py-16 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          
          {/* Left Text Column */}
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">Worldwide Express Dispatch</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              Elevate Your Daily <br />
              <span className="bg-gradient-to-r from-[#8B78C6] via-[#FF6B9D] to-amber-300 bg-clip-text text-transparent">
                Lifestyle & Standards
              </span>
            </h1>

            <p className="text-sm sm:text-base text-gray-400 max-w-lg mx-auto lg:mx-0 leading-relaxed font-medium">
              Curated premium gear, electric grooming innovations, and daily lifestyle essentials. Direct worldwide fulfillment with bank-grade security.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <Link 
                href="#catalog" 
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#8B78C6] to-[#7A67B5] hover:brightness-110 text-white font-extrabold text-sm uppercase tracking-wider transition shadow-lg shadow-[#8B78C6]/30 active:scale-95 text-center"
              >
                Shop Trending Catalog &rarr;
              </Link>

              <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
                <span className="text-emerald-400 font-black">★ 4.9/5</span>
                <span>from 12,000+ Happy Customers</span>
              </div>
            </div>

            {/* Quick Micro-Trust Badges */}
            <div className="grid grid-cols-3 gap-2 pt-6 border-t border-white/10 text-[11px] text-gray-400 font-medium">
              <div>✈️ Free Worldwide Shipping</div>
              <div>🔒 256-Bit Encrypted Payments</div>
              <div>🛡️ 30-Day Guarantee</div>
            </div>
          </div>

          {/* Right Showcase Image */}
          <div className="relative aspect-4/3 sm:aspect-16/10 lg:aspect-square w-full rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl group">
            <Image
              src="/hero-image.jpg" 
              alt="Laclarc Premium Lifestyle Showcase"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-700"
            />
            {/* Floating Glass Deal Tag */}
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto bg-[#181B34]/80 backdrop-blur-md border border-white/15 p-3 rounded-xl flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="text-xs font-black text-white">Daily Curated Drops</p>
                <p className="text-[10px] text-gray-400">Up to 60% OFF On Selected Lightning Deals</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}