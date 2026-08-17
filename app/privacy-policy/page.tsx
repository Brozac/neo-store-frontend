import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - Laclarc',
  description: 'Learn how Laclarc collects, uses, and protects your personal information and store data.',
};

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-[#F4F3F8] py-12 px-4 font-sans">
      <div className="max-w-3xl mx-auto bg-white border border-gray-100 shadow-2xl rounded-[2rem] p-8 md:p-12">
        
        {/* الرأس */}
        <div className="text-center mb-10 border-b border-gray-100 pb-6">
          <h1 className="text-3xl font-extrabold text-[#1D1E3C] mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* المحتوى */}
        <div className="space-y-6 text-sm text-gray-600 leading-relaxed">
          
          <section>
            <h2 className="text-lg font-bold text-[#8B78C6] mb-2">1. Introduction</h2>
            <p>At Laclarc, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share your personal information when you visit, purchase, or interact with our online store.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#8B78C6] mb-2">2. Information We Collect</h2>
            <p>When you make a purchase or create an account, we collect:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Contact Information:</strong> Name, email address, phone number.</li>
              <li><strong>Shipping Address:</strong> Where you want your order delivered.</li>
              <li><strong>Payment Information:</strong> We do not store your full card details. Payments are processed securely through our payment gateways (Stripe, Paysera, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#8B78C6] mb-2">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Fulfill and process your orders through our fulfillment partners (e.g., CJ Dropshipping).</li>
              <li>Send you order confirmations, shipping updates, and tracking numbers.</li>
              <li>Respond to your customer service requests.</li>
              <li>Prevent fraud and improve our store's security.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#8B78C6] mb-2">4. Sharing Your Information</h2>
            <p>We share your information with third-party services to operate our business:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Fulfillment Partners:</strong> To ship your products, we share your name and address with CJ Dropshipping.</li>
              <li><strong>Payment Gateways:</strong> Stripe, Paysera, and NowPayments to process your transactions.</li>
              <li><strong>Email Providers:</strong> Brevo and Resend to send you order emails.</li>
            </ul>
            <p className="mt-2">We never sell your personal data to anyone.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#8B78C6] mb-2">5. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal information. If you wish to update your data or request deletion, please contact us.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-[#8B78C6] mb-2">6. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, you can contact us at:</p>
            <p className="mt-2">
              <strong>Laclarc Support</strong><br />
              Email: support@laclarc.com
            </p>
          </section>

        </div>

        {/* الزر السفلي */}
        <div className="text-center mt-10 pt-6 border-t border-gray-100">
          <Link href="/" className="inline-block bg-[#8B78C6] text-white py-3 px-8 rounded-2xl font-bold text-xs tracking-wide shadow-xl hover:bg-[#7a67b5] transition-all active:scale-95">
            Return to Store
          </Link>
        </div>

      </div>
    </main>
  );
}