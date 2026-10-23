import type { Metadata } from 'next';

// 🩹 SECTION 5 — metadata خاصة (كانت كتورث title الهوم + og:url الهوم — see terms/page.tsx)
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Laclarc collects, uses, and protects your personal information — order data, secure Stripe payments, cookies, and how to contact us.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy | Laclarc',
    description:
      'How Laclarc collects, uses, and protects your personal information — order data, secure Stripe payments, cookies, and how to contact us.',
    url: '/privacy',
  },
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen py-12">
      <div className="max-w-3xl mx-auto px-4 bg-white p-8 rounded-temu-sm border border-temu-gray-border-light shadow-sm">
        <h1 className="text-3xl font-extrabold text-temu-black mb-6">Privacy Policy</h1>
        
        <div className="space-y-4 text-temu-gray-text leading-relaxed text-sm">
          <p>Laclarc ("we", "us", or "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you visit our website.</p>
          
          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">1. Information We Collect</h2>
          <p>We collect personal information that you voluntarily provide to us when making a purchase, including your name, email address, shipping address, and phone number.</p>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">2. How We Use Your Information</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>To process and fulfill your orders (we share your name and shipping address with our fulfillment partners).</li>
            <li>To process payments securely via Stripe.</li>
            <li>To send you order confirmations and shipping updates.</li>
            <li>To provide customer support.</li>
          </ul>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">3. Payment Processing</h2>
          <p>We do not store your credit card information. All payments are processed securely through Stripe, a PCI-DSS compliant payment gateway.</p>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">4. Cookies</h2>
          <p>We use cookies to enhance your shopping experience, remember your cart, and analyze website traffic.</p>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">5. Contact Us</h2>
          <p>If you have any questions about our Privacy Policy, please contact us at support@laclarc.com.</p>
        </div>
      </div>
    </main>
  );
}