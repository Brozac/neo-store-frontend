import { permanentRedirect } from 'next/navigation';

// /track → /track-order — مسار تتبع واحد كانوني — 308 يحفظ الروابط القديمة
export default function TrackRedirect() {
  permanentRedirect('/track-order');
}
