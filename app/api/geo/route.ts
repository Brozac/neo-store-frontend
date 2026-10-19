// app/api/geo/route.ts — Kit 28: دولة الزائر (Vercel edge geo)
// كيرجع ISO-2 (مثلا MA) ولا null فالتطوير المحلي — الواجهة كتعالج الجوج
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw =
    req.headers.get('x-vercel-ip-country') ||
    req.headers.get('cf-ipcountry') ||
    '';
  return NextResponse.json(
    { country: raw ? raw.toUpperCase().slice(0, 2) : null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
