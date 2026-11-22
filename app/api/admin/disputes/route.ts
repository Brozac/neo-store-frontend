// GET /api/admin/disputes — Phase I: بروكسي CJ /disputes/getDisputeList
// العقد الحي المثبت: data.list[] — status كودات رقمية 100-800 → أسماء اللوحة
// الرد {data:{list:[{id,status,disputeReason,money,createDate}]}} — نفس شكل الباك
import { NextResponse } from 'next/server';
import { adminGuard } from '@/lib/admin-auth';
import { cjFetch } from '@/lib/cf-cj';

export const dynamic = 'force-dynamic';

/** كودات CJ → أسماء اللوحة (النشطة: Processing/Pending — الباقي مقفلة) */
function statusName(code: unknown): string {
  const c = Number(code);
  switch (c) {
    case 100: return 'Pending';
    case 200: return 'Processing';
    case 300: return 'Resolved';
    case 400: return 'Rejected';
    case 500: return 'Closed';
    case 600: return 'Cancelled';
    case 700: return 'Expired';
    case 800: return 'Finalized';
    default: return `Unknown (${c})`;
  }
}

interface CjDispute {
  disputeId?: string;
  status?: string;
  disputeReason?: string;
  refundMoney?: number | string | null;
  orderMoney?: number | string | null;
  createDate?: string | number | null;
}

export async function GET(request: Request) {
  const denied = await adminGuard(request);
  if (denied) return denied;

  try {
    const res = await cjFetch('/disputes/getDisputeList', {
      query: { pageNum: 1, pageSize: 50 },
    });
    const env = res.data;
    if (!env || env.code !== 200) {
      return NextResponse.json(
        { error: env?.message || 'CJ disputes unavailable' },
        { status: 502 },
      );
    }
    const d = (env.data ?? {}) as { list?: CjDispute[] };
    const list = Array.isArray(d.list) ? d.list : [];
    return NextResponse.json({
      data: {
        list: list.map((x) => ({
          id: x.disputeId ?? '',
          status: statusName(x.status),
          disputeReason: x.disputeReason ?? '',
          money: Number(x.refundMoney ?? x.orderMoney ?? 0),
          createDate:
            x.createDate != null
              ? new Date(Number(x.createDate)).toISOString()
              : '',
        })),
      },
    });
  } catch (e) {
    console.warn('[admin-disputes] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'CJ disputes unavailable' }, { status: 502 });
  }
}
