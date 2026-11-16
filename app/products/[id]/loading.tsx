// F#104 [skeleton] — كتبان وقت الـ SSR fetch ديال المنتج (getProduct فيه retry + 700ms pause)
// بدل صفحة خاوية فالانتقال — نفس geometry ديال PDP الحقيقية (zero CLS)
import { PdpSkeleton } from '@/components/Skeleton';

export default function Loading() {
  return <PdpSkeleton />;
}
