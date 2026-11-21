// lib/pb/pb-fulfill.ts — Phase F: إطلاق الحجز تاع الطلبات العادية على rpc
// rpc /api/orders/fulfill (X-PhaseC-Key) — نفس سر الجسر الموجود فالـ worker
import 'server-only';
import { getPbRuntime, pbVar } from './pb-env';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.laclarc.com';

export async function pbFulfillRegularOrder(orderId: number): Promise<boolean> {
  try {
    const { env, waitUntil } = await getPbRuntime();
    const key = pbVar(env, 'PHASEC_BRIDGE_KEY');
    if (!key || !Number.isInteger(orderId) || orderId <= 0) return false;
    const req = fetch(`${RPC_URL}/api/orders/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PhaseC-Key': key },
      body: JSON.stringify({ orderId }),
      signal: AbortSignal.timeout(15000),
    });
    // fire-and-forget — الرد موثق لكن ما كيحبسش المسار
    waitUntil(
      req
        .then((r) => {
          if (!r.ok) console.warn('[pb-fulfill] rpc returned', r.status);
        })
        .catch((e: unknown) =>
          console.warn('[pb-fulfill] rpc failed:', e instanceof Error ? e.message : e),
        ),
    );
    return true;
  } catch (e) {
    console.warn('[pb-fulfill] failed:', e instanceof Error ? e.message : e);
    return false;
  }
}
