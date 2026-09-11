'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export interface StoredUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  click_id?: string;
}

// ✨ الدالة المسؤولة عن إعطاء بيانات الإعلانات للسلة والـ Checkout
export function getStoredUtm(): StoredUtm {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem('laclarc_utm') || localStorage.getItem('laclarc_utm');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

function UtmCaptureLogic() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const source = searchParams.get('utm_source');
    const medium = searchParams.get('utm_medium');
    const campaign = searchParams.get('utm_campaign');
    // دعم نقرات تيك توك، فيسبوك، وجوجل
    const clickId = searchParams.get('ttclid') || searchParams.get('fbclid') || searchParams.get('gclid');

    if (source || campaign || clickId) {
      const utmData: StoredUtm = {
        utm_source: (source || (clickId?.startsWith('fb') ? 'facebook' : clickId ? 'ad_network' : 'campaign')).slice(0, 100),
        utm_medium: (medium || 'paid').slice(0, 100),
        utm_campaign: (campaign || 'direct_ad').slice(0, 150),
        click_id: clickId || undefined,
      };

      try {
        sessionStorage.setItem('laclarc_utm', JSON.stringify(utmData));
        localStorage.setItem('laclarc_utm', JSON.stringify(utmData));
      } catch (e) {}
    }
  }, [searchParams]);

  return null;
}

export default function UtmTracker() {
  return (
    <Suspense fallback={null}>
      <UtmCaptureLogic />
    </Suspense>
  );
}