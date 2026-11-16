// ════════════════════════════════════════════════════════════════
// F#101 [color-swatches] — محوّل أسماء الألوان → hex حقيقي
//
// 🔴 المشكلة (فالداتا الحية): CJ كيرجع أسماء ("Black", "Army Green",
//    "Rose Red", "Sky Blue"...) و DB مرات كتخزن hex ومرات الاسم.
//    getColorHex القديم كان كيرجع #888888 (رمادي) لأي اسم → السواتش
//    كامل رمادي واحد = الزبون ما كيفرقش بين "Black" و"White".
//
// 🆕 الحل: خريطة أسماء CJ الشائعة → hex معاير + مطابقة ذكية:
//    1. hex صالح (يبدأ بـ #) → يرجع كما هو (حقيقة المنتج، ما كنبدلوش)
//    2. مطابقة تامة بالاسم (case-insensitive)
//    3. مطابقة بالكلمة الأطول أولاً ("Army Green" قبل "Green")
//    4. لونين "Black & White" / "Black / White" → أول لون معروف
//    5. fallback رمادي محايد #888888 (موثق، ماشي مزيف)
//
// 🎨 القيم معايرة على الساتوراسيون المعتدلة (أقل من 80%) — قاعدة
//    taste-design: بلا ألوان نيون، بلا #000000 الخالص (Off-Black)
// ════════════════════════════════════════════════════════════════

const HEX_RX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** رمادي محايد موثق — لغير الأسماء المجهولة (ماشي مزيف، ماشي أسود) */
export const COLOR_FALLBACK_HEX = '#888888';

/** خريطة أسماء CJ الشائعة — الأطول/الأدق أولاً (الترتيب مهم للمطابقة) */
const NAMED: Array<[string, string]> = [
  // متعدد الكلمات — الدقة أولاً
  ['off white', '#f5f2ea'],
  ['ivory', '#f6efe3'],
  ['cream', '#f3ead9'],
  ['army green', '#6b7a4f'],
  ['olive green', '#7a7a52'],
  ['olive', '#7a7a52'],
  ['mint green', '#a8d5ba'],
  ['dark green', '#2f5d3a'],
  ['light green', '#9ccf9c'],
  ['fluorescent green', '#5fae6e'],
  ['lake blue', '#4f7fa8'],
  ['sky blue', '#8fb8d8'],
  ['navy blue', '#2b3f5c'],
  ['dark blue', '#2b3f5c'],
  ['light blue', '#a9c6e0'],
  ['royal blue', '#3b5998'],
  ['steel blue', '#5b7ea6'],
  ['dusty blue', '#8ca3c0'],
  ['rose red', '#c96a6a'],
  ['rose', '#c96a6a'],
  ['hot pink', '#d9708a'],
  ['watermelon red', '#d4635f'],
  ['dark red', '#8f3a3a'],
  ['wine red', '#7d3b4b'],
  ['burgundy', '#7d3b4b'],
  ['maroon', '#7d3b4b'],
  ['deep red', '#8f3a3a'],
  ['lemon yellow', '#e8d174'],
  ['light yellow', '#f0df9a'],
  ['dark yellow', '#d0ac48'],
  ['dark gray', '#5f6b76'],
  ['dark grey', '#5f6b76'],
  ['light gray', '#c9ced4'],
  ['light grey', '#c9ced4'],
  ['deep gray', '#4a5560'],
  ['coffee', '#6f4e37'],
  ['chocolate', '#5d4037'],
  ['camel', '#bfa06a'],
  ['watermelon', '#d4635f'],

  // كلمة واحدة — الأشيع
  ['black', '#2b2b2b'],        // Off-Black — قاعدة taste-design: بلا #000000
  ['white', '#ffffff'],
  ['beige', '#e8dcc8'],
  ['apricot', '#eec9a0'],
  ['khaki', '#b3a274'],
  ['green', '#4f8a5b'],
  ['blue', '#46648a'],
  ['cyan', '#6fb3c4'],
  ['teal', '#3f7f7f'],
  ['purple', '#7a5f96'],
  ['violet', '#7a5f96'],
  ['lavender', '#b6a8cf'],
  ['pink', '#d9a0b0'],
  ['red', '#b05c5c'],
  ['orange', '#d98a4a'],
  ['yellow', '#e0c060'],
  ['gold', '#d0ac48'],
  ['silver', '#b8bfc7'],
  ['gray', '#8a939c'],
  ['grey', '#8a939c'],
  ['brown', '#7a5a44'],
  ['tan', '#c4a97f'],
  ['coral', '#d98a8a'],
  ['salmon', '#dba090'],
  ['amber', '#d0a050'],
  ['auburn', '#8a4a3a'],
  ['charcoal', '#3d4247'],
  ['turquoise', '#4fa8a0'],
  ['magenta', '#b0608f'],
  ['plum', '#8a6076'],
  ['sapphire', '#33518f'],
  ['ruby', '#9e3d4a'],
  ['champagne', '#e5d7bc'],
  ['sand', '#d4bd94'],
  ['mauve', '#a98a9c'],
  ['peach', '#efb8a0'],
];

/** تطبيع الاسم: مسافات، شرطات، علامات — للمطابقة الآمنة */
const norm = (s: string) =>
  s.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();

// 🩹 code-review F#102: includes الخام كتخلط — "Bordered" فيها "red" → حمراء مزورة!
// المطابقة دابا بالكلمات الكاملة: كل كلمة ديال الاسم خاصها تكون كلمة مستقلة فالاسم المبحوث.
const wordSet = (s: string) => new Set(s.split(/[^a-z]+/).filter(Boolean));

/** توسيط hex قصير #abc → #aabbcc (كنرجعو دايماً بصيغة موحدة صغيرة للـ CSS) */
const expandHex = (hex: string): string => {
  const m = hex.replace('#', '').toLowerCase();
  if (m.length === 3 || m.length === 4) {
    return '#' + m.slice(0, 3).split('').map((c) => c + c).join('');
  }
  return '#' + m.slice(0, 6);
};

/**
 * محوّل الاسم → hex حقيقي للسواتش.
 * الترتيب: hex صالح → مطابقة تامة → بدون مسافات → كلمة الأطول → fallback.
 */
export const getColorHex = (raw?: string | null): string => {
  if (!raw) return COLOR_FALLBACK_HEX;
  const s = String(raw).trim();
  if (!s) return COLOR_FALLBACK_HEX;

  // 1) hex حقيقي من الداتا — نرجعوه كما هو (نormalizيه غير الصيغة)
  if (HEX_RX.test(s)) return expandHex(s);

  const n = norm(s);

  // 2) مطابقة تامة
  for (const [name, hex] of NAMED) {
    if (n === name) return hex;
  }

  // 2.5) مركب بلا مسافات — "SkyBlue" / "ArmyGreen" (صيغة CJ شائعة)
  const squashed = n.replace(/ /g, '');
  for (const [name, hex] of NAMED) {
    if (name.includes(' ') && squashed === name.replace(/ /g, '')) return hex;
  }

  // 3) مطابقة بالكلمات الكاملة — الكلمة الأطول أولاً ("Army Green" قبل "Green")
  //    "Bordered" ما كتطابقش "red" — الكلمة خاصها تكون مستقلة
  const ws = wordSet(n);
  const hits = NAMED.filter(([name]) => {
    const parts = name.split(' ');
    return parts.every((w) => ws.has(w));
  });
  if (hits.length > 0) {
    hits.sort((a, b) => b[0].length - a[0].length);
    return hits[0][1];
  }

  // 4) fallback موثق — رمادي محايد (ماشي أسود مزيف)
  return COLOR_FALLBACK_HEX;
};

/** هل هاد الاسم كيمثل لون حقيقي معروف؟ (للعرض الشرطي فالواجهة) */
export const isKnownColor = (raw?: string | null): boolean => {
  if (!raw) return false;
  const s = String(raw).trim();
  if (HEX_RX.test(s)) return true;
  const n = norm(s);
  // نفس منطق getColorHex — كلمات كاملة (بلا includes الخام)
  const ws = wordSet(n);
  if (NAMED.some(([name]) => name.split(' ').every((w) => ws.has(w)))) return true;
  const squashed = n.replace(/ /g, '');
  return NAMED.some(([name]) => name.includes(' ') && squashed === name.replace(/ /g, ''));
};
