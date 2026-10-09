'use client';

import { useId } from 'react';

/**
 * ═══════════════════════════════════════════════════════════
 * 🎨 Laclarc Duotone Icons — مخصص للمتجر (v1.1)
 * أسلوب: filled + accent layer (طبقتان) — يتفاعل مع النشاط
 * كل أيقونة تقبل active state وتضيء بطبقة بنفسجية/وردية
 * v1.1: useId لكل gradient — تضارب SVG IDs محسوم (P1)
 * ═══════════════════════════════════════════════════════════
 */

interface IconProps {
  size?: number;
  active?: boolean; // الحالة النشطة — ملء بنفسجي/وردي
}

// 🏠 Home — بيت بأساس مملوء
export function HomeIcon({ size = 24, active = false }: IconProps) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* الطبقة المملوءة — تظهر عند النشط */}
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9.5z"
        fill={active ? `url(#${gradId})` : 'transparent'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? '' : 'transition-colors'}
      />
      {active && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#8B78C6" />
            <stop offset="100%" stopColor="#FF6B9D" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

// 🔍 Search — عدسة بلمعة (rgba مباشر — النمط بلا gradients)
export function SearchIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="10.5" cy="10.5" r="6.5"
        fill={active ? 'rgba(139,120,198,0.2)' : 'transparent'}
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <circle cx="8.5" cy="8.5" r="2.5" fill={active ? 'rgba(255,107,157,0.4)' : 'transparent'} />
      <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth={active ? 2.6 : 2.2} strokeLinecap="round" />
    </svg>
  );
}

// 🛍️ ShoppingBag — حقيبة كاملة بقلب
export function BagIcon({ size = 24, active = false }: IconProps & { badge?: boolean }) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M5 8h14l-1.2 12a1.5 1.5 0 01-1.5 1.35H7.7a1.5 1.5 0 01-1.49-1.35L5 8z"
        fill={active ? `url(#${gradId})` : 'transparent'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        strokeLinejoin="round"
      />
      <path
        d="M8.5 8V6.5a3.5 3.5 0 017 0V8"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* قلب صغير في وسط الحقيبة — لمسة Laclarc */}
      <path
        d="M12 13.2c.6-.9 2-.9 2.3.2.2.8-.4 1.5-2.3 2.6-1.9-1.1-2.5-1.8-2.3-2.6.3-1.1 1.7-1.1 2.3-.2z"
        fill={active ? '#fff' : 'rgba(255,107,157,0.5)'}
      />
      {active && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FF6B9D" />
            <stop offset="100%" stopColor="#8B78C6" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

// 📦 Track — صندوق + قمر صناعي (شحن عالمي)
export function TrackIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x="3.5" y="7" width="13" height="13" rx="2"
        fill={active ? 'rgba(139,120,198,0.25)' : 'transparent'}
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path d="M3.5 11h13" stroke="currentColor" strokeWidth={1.6} />
      <path d="M8 7v-1.5A1.5 1.5 0 019.5 4h8A1.5 1.5 0 0119 5.5V17a1.5 1.5 0 01-1.5 1.5H16.5"
        stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={active ? 1 : 0.6} />
      {/* نقطة تتبع متحركة */}
      <circle cx="10" cy="14.5" r="1.8" fill={active ? '#FF6B9D' : 'rgba(139,120,198,0.4)'} />
    </svg>
  );
}

// 👤 Profile — شخص مع حلقة حالة
export function ProfileIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12" cy="8" r="4"
        fill={active ? 'rgba(255,107,157,0.25)' : 'transparent'}
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
      />
      <path
        d="M4.5 20.5c.8-3.6 3.9-5.5 7.5-5.5s6.7 1.9 7.5 5.5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        fill={active ? 'rgba(139,120,198,0.15)' : 'transparent'}
      />
    </svg>
  );
}

// ❤️ Wishlist — قلب ممتلئ مع نبضة
export function HeartIcon({ size = 24, active = false }: IconProps) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={active ? 'animate-fab-ring-once' : ''}>
      <path
        d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"
        fill={active ? `url(#${gradId})` : 'transparent'}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.8}
        strokeLinejoin="round"
      />
      {active && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FF6B9D" />
            <stop offset="100%" stopColor="#8B78C6" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

// ✨ AI — Sparkles متوهج (الوحيد الثلاثي النجوم)
export function AIIcon({ size = 24, active = false }: IconProps) {
  const gradId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        fill={active ? `url(#${gradId})` : 'rgba(139,120,198,0.35)'}
        stroke={active ? 'none' : 'currentColor'}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"
        fill={active ? '#FF6B9D' : 'rgba(255,107,157,0.5)'} />
      <path d="M5.5 16l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z"
        fill={active ? '#8B78C6' : 'rgba(139,120,198,0.5)'} />
      {active && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FF6B9D" />
            <stop offset="100%" stopColor="#8B78C6" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

// 🟢 WhatsApp — يبقى مخصصًا (خارج الـ dock)
export function WhatsAppGlyph({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
// ── Function Icons Pack (الموضع الدائم) ──

// 🛡️ Buyer Protection — درع بنفسجي بسلّم
export function ShieldCheckIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5l8-3z"
        fill={active ? 'rgba(139,120,198,0.25)' : 'rgba(139,120,198,0.08)'}
        stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke={active ? '#8B78C6' : 'currentColor'}
        strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 🌍 Global Shipping — كرة أرضية بمدار
export function GlobeShippingIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9"
        fill={active ? 'rgba(139,120,198,0.15)' : 'transparent'}
        stroke="currentColor" strokeWidth={1.8} />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z"
        stroke="currentColor" strokeWidth={1.4} opacity={0.7} />
      <circle cx="17" cy="6" r="2" fill="#FF6B9D" />
      <path d="M15 8l3-3" stroke="#FF6B9D" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}

// ↩️ Returns — سهم دائري (v1.1: العنصر الميت حيد + ternary المكرر صلح)
export function ReturnsIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9 14l-4-4 4-4" stroke="currentColor" strokeWidth={1.9}
        strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M5 10h9a5 5 0 015 5v1" stroke="currentColor" strokeWidth={1.9}
        strokeLinecap="round" fill="none" />
      <circle cx="19" cy="16" r="1.5" fill={active ? '#FF6B9D' : 'rgba(139,120,198,0.4)'} />
    </svg>
  );
}

// 🔒 SSL Lock — قفل بـ keyhole
export function LockIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5"
        fill={active ? 'rgba(139,120,198,0.25)' : 'rgba(139,120,198,0.08)'}
        stroke="currentColor" strokeWidth={1.8} />
      <path d="M8 10.5V8a4 4 0 018 0v2.5" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.6" fill={active ? '#FF6B9D' : 'rgba(255,107,157,0.6)'} />
      <path d="M12 16.5v2" stroke={active ? '#FF6B9D' : 'rgba(255,107,157,0.6)'}
        strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

// 💳 Cards — بطاقتان متراكبتان
export function CardsIcon({ size = 24, active = false }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="15" height="10" rx="2" transform="rotate(-8 10 11)"
        fill={active ? 'rgba(255,107,157,0.2)' : 'rgba(139,120,198,0.1)'}
        stroke="currentColor" strokeWidth={1.6} />
      <rect x="6" y="9" width="15" height="10" rx="2"
        fill={active ? 'rgba(139,120,198,0.25)' : 'rgba(255,255,255,0.9)'}
        stroke="currentColor" strokeWidth={1.8} />
      <path d="M6 13h7" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx="17.5" cy="16" r="1.3" fill={active ? '#FF6B9D' : '#8B78C6'} />
    </svg>
  );
}