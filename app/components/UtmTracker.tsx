'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

export interface StoredUtm {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  click_id?: string;
  captured_at?: number;
}

// 🆕 v1.1 — TTL: سنة واحدة · أقدم = مصدر ملوث يُهمل (attribution hygiene)
const UTM_TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ✨ الدالة المسؤولة عن إعطاء بيانات الإعلانات للسلة والـ Checkout
export function getStoredUtm(): StoredUtm {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem('laclarc_utm') || localStorage.getItem('laclarc_utm');
    if (raw) {
      const parsed = JSON.parse(raw);
      // 🆕 TTL enforcement — بيانات أقدم من سنة = تلوث، تُهمل وتُمسح
      if (parsed.captured_at && Date.now() - parsed.captured_at > UTM_TTL_MS) {
        localStorage.removeItem('laclarc_utm');
        sessionStorage.removeItem('laclarc_utm');
        return {};
      }
      const { captured_at, ...utm } = parsed;
      return utm as StoredUtm;
    }
  } catch (e) {
    // JSON فاسد أو storage محظور — صفر attribution، لا تأثير على المسار المالي
  }
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
        captured_at: Date.now(), // 🆕 v1.1 — للـ TTL enforcement
      };

      try {
        const payload = JSON.stringify(utmData);

        // 🆕 v1.1 — first-click wins مع تجديد لنفس المصدر:
        // مصدر جديد ≠ يطمس القديم إلا إذا الـ localStorage فارغ أو انتهى صلاحيته
        const stored = getStoredUtm();
        const sameSourceRepeat = stored.click_id && clickId && stored.click_id === clickId;

        sessionStorage.setItem('laclarc_utm', payload); // دائماً — الجلسة الحالية هي الحقيقة اللحظية

        if (!stored.click_id || sameSourceRepeat || stored.captured_at === undefined) {
          localStorage.setItem('laclarc_utm', payload); // التاريخي — محروس من التلوث
        }
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