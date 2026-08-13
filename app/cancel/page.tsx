import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-red-50 p-4 text-center">
      <div className="bg-white p-10 rounded-[2rem] shadow-xl max-w-md w-full">
        <div className="text-red-500 text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-extrabold text-[#1D1E3C] mb-2">Payment Cancelled</h1>
        <p className="text-[#9A9AB0] mb-8">No charges were made. You can try again whenever you are ready.</p>
        
        <Link 
          href="/cart" 
          className="inline-block w-full bg-[#8B78C6] text-white font-bold px-6 py-4 rounded-2xl hover:bg-[#7a68af] transition-colors cursor-pointer"
        >
          Back to Cart
        </Link>
      </div>
    </div>
  );
}