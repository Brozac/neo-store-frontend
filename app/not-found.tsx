import Link from 'next/link';

// v28 [total-vanish] — صفحة 404 موحدة وهادئة (Sérénité)
// هي اللي كتبان دابا على: الروابط الميتة + الفروع المخفية من الأدمن
// (الـ middleware كيعاود لـ /__vanished__ = مسار غير موجود = هاد الصفحة 404)
export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="bg-white border border-temu-gray-border-light rounded-2xl shadow-sm p-10 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-serene-mint flex items-center justify-center text-2xl">
          🌫️
        </div>
        <h1 className="text-lg font-black text-temu-black">Page not found</h1>
        <p className="text-sm text-temu-gray-text leading-relaxed">
          This page doesn&apos;t exist or is no longer available. Everything else is still open — welcome back anytime.
        </p>
        <p className="text-xs text-temu-gray-text leading-relaxed" dir="rtl" lang="ar">
          هاد الصفحة غير موجودة — بقية المتجر مفتوحة وعاكلة.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#5F8271] hover:bg-[#4E6F60] text-white font-extrabold text-xs uppercase tracking-wider px-6 py-3 rounded-xl transition active:scale-95"
        >
          Back to the store
        </Link>
      </div>
    </main>
  );
}
