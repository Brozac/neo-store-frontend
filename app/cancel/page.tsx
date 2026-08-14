import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-temu-offwhite p-4 text-center">
      <div className="bg-white p-10 rounded-temu-sm shadow-sm border border-temu-gray-border-light max-w-md w-full">
        <div className="text-temu-error text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-extrabold text-temu-black mb-2">Payment Cancelled</h1>
        <p className="text-temu-gray-text mb-8">No charges were made. You can try again whenever you are ready.</p>
        
        <Link 
          href="/cart" 
          className="inline-block w-full bg-temu-orange text-white font-bold py-4 px-6 rounded-temu-sm hover:bg-temu-orange-bright transition-colors cursor-pointer active:scale-95 touch-manipulation shadow-md"
        >
          Back to Cart
        </Link>
      </div>
    </div>
  );
}