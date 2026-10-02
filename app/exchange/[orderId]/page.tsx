// app/exchange/[orderId]/page.tsx — server wrapper: reads orderId + token from the URL
import { Suspense } from 'react';
import ExchangeClient from '../ExchangeClient';

export const metadata = { title: 'Product Exchange | Laclarc', robots: { index: false } };

export default async function ExchangePage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { orderId } = await params;
  const { t } = await searchParams;
  return (
    <Suspense fallback={null}>
      <ExchangeClient orderId={Number(orderId)} token={t ?? ''} />
    </Suspense>
  );
}