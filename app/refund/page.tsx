import type { Metadata } from 'next';

// 🩹 SECTION 5 — metadata خاصة (كانت كتورث title الهوم + og:url الهوم — see terms/page.tsx)
export const metadata: Metadata = {
  title: 'Refund & Return Policy',
  description:
    'Laclarc return and refund policy: 30-day returns, damaged or defective items, the return process, refund timing, and order cancellation.',
  alternates: { canonical: '/refund' },
  openGraph: {
    title: 'Refund & Return Policy | Laclarc',
    description:
      'Laclarc return and refund policy: 30-day returns, damaged or defective items, the return process, refund timing, and order cancellation.',
    url: '/refund',
  },
};

export default function RefundPolicy() {
  return (
    <main className="min-h-screen bg-temu-offwhite py-12">
      <div className="max-w-3xl mx-auto px-4 bg-white p-8 rounded-temu-sm border border-temu-gray-border-light shadow-sm">
        <h1 className="text-3xl font-extrabold text-temu-black mb-6">Refund & Return Policy</h1>
        
        <div className="space-y-4 text-temu-gray-text leading-relaxed text-sm">
          <p>At Laclarc, we strive to ensure you are completely satisfied with your purchase. If you are not entirely satisfied, we offer a 30-day return policy from the date of delivery.</p>
          
          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">1. Return Eligibility</h2>
          <p>To be eligible for a return, your item must be unused, in the same condition that you received it, and in its original packaging. Proof of purchase (Order ID) is required.</p>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">2. Damaged or Defective Items</h2>
          <p>If you received a damaged, defective, or incorrect item, please contact us at support@laclarc.com within 7 days of receiving your order. We will arrange a free replacement or a full refund.</p>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">3. Return Process (Dropshipping)</h2>
          <p>As we source our products from global suppliers, returns must be sent to our supplier's warehouse. Please contact us to receive the exact return address before shipping any items back.</p>
          
          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">4. Refunds</h2>
          <p>Once your return is received and inspected, we will send you an email to notify you that we have processed your refund. The refund will be applied to your original method of payment (Credit Card/Stripe) within 5-7 business days.</p>

          <h2 className="text-xl font-bold text-temu-black mt-6 mb-2">5. Order Cancellation</h2>
          <p>Orders can be canceled within 12 hours of placement. If the order has already been processed and shipped by our supplier, it cannot be canceled and must be handled through the return process.</p>
        </div>
      </div>
    </main>
  );
}