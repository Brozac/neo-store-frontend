'use client';

// ════════════════════════════════════════════════════════════════
// GlassIcon [glassdock-v1] — سيستيم الأيقونات الزجاجية ديال LaClarc
// (Kit 29h — كل الإيموجي اللي كيشوفها الزبون كيولّيو أيقونات Lucide
//  داخل شرايح زجاج مضبّب — Glassmorphism بروح «dock»)
//
// • <GlassIcon i="truck" />                        → أيقونة مسمية داخل شريحة زجاجية
// • <GlassIcon ch="📦" />                          → من حرف إيموجي (خريطة أوتوماتيكية)
// • <GlassIcon i="zap" bare />                     → أيقونة عارية (بلا شريحة) للأزرار/الشارات
// • <GlassInline text={'⏳ Processing'} />          → نص جاي من string: كيفرقّ الإيموجي الأول
//                                                    وكيحوله لأيقونة زجاجية + باقي النص
// • إيموجي غير ممرّغ (😭 / أعلام…) → الشريحة كتحتضن الحرف نفسه — ما كاينش فقدان شخصية
// • الأعلام 🇩🇿 وما شابه ما كيتمسوش (محتوى، ماشي أيقونة)
// ════════════════════════════════════════════════════════════════

import {
  ArrowLeft, ArrowRight, Banknote, Camera, Check, CircleCheck, CircleX, Clapperboard,
  Clock, Clover, Crown, Eye, EyeOff, Factory, Flame, FlagTriangleRight, Gem, Gift, Globe,
  Heart, Hourglass, House, Link2, Lock, Luggage, MapPin, MessageCircle, Moon, Package,
  PartyPopper, Pencil, Plane, PlaneLanding, Radar, Radio, RefreshCw, Rocket, Search,
  ShieldCheck, Ship, ShoppingBag, ShoppingCart, Sparkles, Star, Stethoscope, Target,
  Timer, TriangleAlert, Trophy, Truck, Volume2, VolumeX, Wallet, X, Zap, ThumbsUp, BadgeCheck,
  type LucideIcon,
} from 'lucide-react';

type Tone = 'brand' | 'success' | 'warn' | 'danger' | 'neutral';

interface Entry { I: LucideIcon; t: Tone; bare?: boolean }

const ICONS: Record<string, LucideIcon> = {
  arrowLeft: ArrowLeft, arrowRight: ArrowRight, banknote: Banknote, camera: Camera,
  check: Check, circleCheck: CircleCheck, circleX: CircleX, clapperboard: Clapperboard,
  clock: Clock, clover: Clover, crown: Crown, eye: Eye, eyeOff: EyeOff, factory: Factory,
  flame: Flame, flag: FlagTriangleRight, gift: Gift, globe: Globe, heart: Heart,
  hourglass: Hourglass, house: House, link: Link2, lock: Lock, luggage: Luggage,
  mapPin: MapPin, message: MessageCircle, moon: Moon, package: Package,
  party: PartyPopper, pencil: Pencil, plane: Plane, planeLanding: PlaneLanding,
  radar: Radar, radio: Radio, refresh: RefreshCw, rocket: Rocket, search: Search,
  shield: ShieldCheck, ship: Ship, bag: ShoppingBag, cart: ShoppingCart,
  sparkles: Sparkles, star: Star, stethoscope: Stethoscope, target: Target,
  timer: Timer, alert: TriangleAlert, trophy: Trophy, truck: Truck,
  volume2: Volume2, volumeX: VolumeX, wallet: Wallet, x: X, zap: Zap,
  thumbsUp: ThumbsUp, badgeCheck: BadgeCheck,
};

// 🗺️ خريطة الإيموجي → أيقونة + نبرة (الإيموجي الظاهرة للزبون فموقع LaClarc)
const EMOJI_MAP: Record<string, Entry> = {
  '✓':  { I: Check, t: 'success', bare: true },
  '✅': { I: CircleCheck, t: 'success' },
  '⚡': { I: Zap, t: 'warn', bare: true },
  '⚠':  { I: TriangleAlert, t: 'warn', bare: true },
  '✕':  { I: X, t: 'neutral', bare: true },
  '✖':  { I: X, t: 'danger', bare: true },
  '❌': { I: CircleX, t: 'danger' },
  '📦': { I: Package, t: 'brand' },
  '⏳': { I: Hourglass, t: 'warn' },
  '🚚': { I: Truck, t: 'success' },
  '🎉': { I: PartyPopper, t: 'success' },
  '🔥': { I: Flame, t: 'danger' },
  '🌍': { I: Globe, t: 'brand' },
  '💰': { I: Banknote, t: 'success' },
  '💵': { I: Banknote, t: 'success' },
  '✨': { I: Sparkles, t: 'brand' },
  '⏱':  { I: Timer, t: 'neutral' },
  '🕐': { I: Clock, t: 'neutral' },
  '📍': { I: MapPin, t: 'brand' },
  '🎁': { I: Gift, t: 'brand' },
  '🏁': { I: FlagTriangleRight, t: 'brand' },
  '✈':  { I: Plane, t: 'brand' },
  '★':  { I: Star, t: 'warn', bare: true },
  '⭐': { I: Star, t: 'warn' },
  '🛒': { I: ShoppingCart, t: 'brand' },
  '🛍':  { I: ShoppingBag, t: 'brand' },
  '💎': { I: Gem, t: 'brand' },
  '🔍': { I: Search, t: 'neutral' },
  '❤':  { I: Heart, t: 'danger' },
  '🏭': { I: Factory, t: 'neutral' },
  '🛬': { I: PlaneLanding, t: 'brand' },
  '🚢': { I: Ship, t: 'brand' },
  '📷': { I: Camera, t: 'neutral' },
  '🛡':  { I: ShieldCheck, t: 'success' },
  '💬': { I: MessageCircle, t: 'brand' },
  '🔗': { I: Link2, t: 'neutral' },
  '📡': { I: Radar, t: 'neutral' },
  '↻':  { I: RefreshCw, t: 'neutral', bare: true },
  '✏':  { I: Pencil, t: 'neutral' },
  '🏆': { I: Trophy, t: 'warn' },
  '🩺': { I: Stethoscope, t: 'success' },
  '🌙': { I: Moon, t: 'neutral' },
  '🎬': { I: Clapperboard, t: 'neutral' },
  '🔇': { I: VolumeX, t: 'neutral' },
  '🔊': { I: Volume2, t: 'neutral' },
  '👑': { I: Crown, t: 'warn' },
  '🍀': { I: Clover, t: 'success' },
  '🔒': { I: Lock, t: 'success' },
  '👍': { I: ThumbsUp, t: 'success' },
  '🚀': { I: Rocket, t: 'brand' },
  '🎯': { I: Target, t: 'brand' },
  '→':  { I: ArrowRight, t: 'neutral', bare: true },
  '←':  { I: ArrowLeft, t: 'neutral', bare: true },
};

export type GlassTone = Tone;
export type GlassSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<GlassSize, { chip: string; icon: number; text: string }> = {
  xs: { chip: 'w-5 h-5 rounded-md', icon: 12, text: 'text-[11px]' },
  sm: { chip: 'w-7 h-7 rounded-lg', icon: 15, text: 'text-[13px]' },
  md: { chip: 'w-9 h-9 rounded-xl', icon: 19, text: 'text-[16px]' },
  lg: { chip: 'w-12 h-12 rounded-2xl', icon: 26, text: 'text-[22px]' },
};

const TONES: Record<Tone, string> = {
  brand: '#5B7EA6',
  success: '#059669',
  warn: '#D97706',
  danger: '#5B7EA6',
  neutral: '#64748B',
};

// ✨ الشريحة الزجاجية — التوقيع البصري ديال GlassDock
const GLASS_CHIP =
  'relative inline-flex items-center justify-center shrink-0 border border-white/70 ' +
  'bg-gradient-to-b from-white/85 to-white/40 backdrop-blur-md ' +
  'shadow-[0_2px_10px_-2px_rgba(91,126,166,0.30),inset_0_1px_0_0_rgba(255,255,255,0.85)]';

export interface GlassIconProps {
  i?: string;          // اسم الأيقونة (truck, zap, package…)
  ch?: string;         // ولا حرف إيموجي — كيتمرّر للخريطة أوتوماتيكياً
  tone?: Tone;         // نبرة اللون (كتغلب النبرة الافتراضية)
  size?: GlassSize;
  bare?: boolean;      // أيقونة عارية بلا شريحة (داخل أزرار/شارات موجودة)
  className?: string;
}

export default function GlassIcon({ i, ch, tone, size = 'sm', bare = false, className = '' }: GlassIconProps) {
  const key = ch ? ch.replace(/\uFE0F/g, '') : undefined;
  const hit = key ? EMOJI_MAP[key] : undefined;
  const Ico = i ? ICONS[i] : hit?.I;
  const t: Tone = tone || hit?.t || 'brand';
  const color = TONES[t];
  const s = SIZES[size] || SIZES.sm;

  if (bare || !Ico) {
    if (Ico) {
      return <Ico size={s.icon} strokeWidth={2.4} style={{ color }} className={className} aria-hidden="true" />;
    }
    // إيموجي غير ممرّغ (😭 / أعلام / غيرها) → الشريحة كتحتضن الحرف نفسه
    if (ch) {
      return (
        <span className={`${GLASS_CHIP} ${s.chip} ${s.text} ${className}`} style={{ color }} aria-hidden="true">
          {ch}
        </span>
      );
    }
    return null;
  }

  return (
    <span className={`${GLASS_CHIP} ${s.chip} ${className}`} aria-hidden="true">
      <Ico size={s.icon} strokeWidth={2.4} style={{ color }} />
    </span>
  );
}

// 🧩 GlassInline — نص جاي من string (labels/statuses/badges): إلا بدا بإيموجي
// ممرّغ، كيولّي [شريحة زجاجية + باقي النص]؛ إلا لا → النص كيف ما هو.
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MAP_KEYS = Object.keys(EMOJI_MAP).sort((a, b) => b.length - a.length).map(escapeRe);
const LEAD_RE = new RegExp(`^(${MAP_KEYS.join('|')})\uFE0F?`);

export function GlassInline({ text, tone, size = 'xs', className = '' }: {
  text: string; tone?: Tone; size?: GlassSize; className?: string;
}) {
  const s = String(text ?? '');
  const m = s.match(LEAD_RE);
  if (!m) return <>{s}</>;
  const rest = s.slice(m[0].length);
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${className}`}>
      <GlassIcon ch={m[0]} tone={tone} size={size} />
      {rest ? <span>{rest}</span> : null}
    </span>
  );
}
