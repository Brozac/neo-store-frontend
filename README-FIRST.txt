════════════════════════════════════════════════════════════
 LACLARC F#101→F#104 — 15 ملف FROM 818b174 (colorrail)
 قرا هادا قبل أي حاجة 🙏
════════════════════════════════════════════════════════════

اللي كاين هنا (738+/62-):
  DESIGN.md                                   (جديد — عقد الهوية البصرية v1.0)
  lib/colorHex.ts                             (جديد — أسماء CJ → hex حقيقي، مختبَر 21/21)
  app/components/FrequentlyBoughtTogether.tsx (phantom-15% → $ حقيقي + Bag→Cart + نجاح شرطي)
  app/products/[id]/ProductDetailsClient.tsx  (colorHex wiring + بنفسج→fog ×13 + aria-pressed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 الطريق أ — patch (الموصى بها):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  git checkout main
  git pull                      # خاصك تكون على 818b174 laclarc-frontend-F101-colorrail
  git apply --check laclarc-f101-dsaudit-FROM-colorrail.patch   # تأكد قبل
  git apply laclarc-f101-dsaudit-FROM-colorrail.patch
  git add -A && git commit -m "f101-f104: colorHex (21/21) + purple→fog + FBT $ + reviews-fix + reviewstability + skeleton system (37/37)"
  git push origin main

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 الطريق ب — نسخ الملفات يدويين (إلا الـ patch ما طبقش):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  نسخ الملفات الـ 4 من هنا فوق الشجرة ديالك بنفس المسارات (over-write).
  المسارات:
    DESIGN.md
    lib/colorHex.ts
    app/components/FrequentlyBoughtTogether.tsx
    app/products/[id]/ProductDetailsClient.tsx

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 التحقق من بعد التطبيق:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  npm install (إلا node_modules خاوية) ثم:
  npx tsc --noEmit              # خاصو يخرج بلا أخطاء فالملفات الـ 4
                                  (أخطاء @opennextjs/cloudflare = عادي بلا node_modules كاملة)
  npm run build                 # أو الـ deploy ديال Vercel مباشرة

  اختبار السواتشات: حلو أي منتج فيه ألوان بالأسماء ("Black", "Army Green",
  "Rose Red"...) — خاصك تشوف ألوان حقيقية ماشي رمادي موحد #888888.
  "Black" = #2b2b2b (off-black) · "Army Green" = #6b7a4f · "Sky Blue" = #8fb8d8.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ملاحظات:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • الـ patch محسوب على 818b174 بالبايت — إلا الـ main ديالك تزاد من بعد، الطريق ب آمن.
  • DESIGN.md = العقد الرسمي للهوية — كل كومبونونت جديد كيتبع به (قسم 4).
  • سكيلات purple-s-baby-sister / violet-heaven فـ globals.css = legacy — ما تستعملوش فكود جديد.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 v2 (F#102 code-review) — نفس الـ patch تطوّر:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • 🩹 المطابقة بالكلمات الكاملة: "Bordered" ما كتوليش حمراء (includes الخام كتخلط)
  • ✨ المركب بلا مسافات خدّام: "SkyBlue" / "ArmyGreen"
  • الاختبارات: 21/21 ✓ — الـ patch كيتطبق على 818b174 بحال قبل (327+/19-)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 v3 (F#103 reviews-fix) — قسم الـ Reviews تصلح:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • 🩹 التقييمات المكررة حيدو (نفس النص حرفياً + نفس النهار + نفس الدولة → تقييم واحد)
    — 9 المزعومة كتولي 7 حقيقيين (العدد صادق حسب المحذوف)
  • 🩹 "Russian Federation (the)" → "Russia" · "Korea (the Republic of)" → "South Korea"
    (+ fallback عام كينضف "(the)" من أي دولة)
  • 🩹 النص الطويل ما بقاش كيطيح خارج البطاقة: min-w-0 + overflow-hidden + break-words
  • ✨ النجوم clamp 1..5 + truncate للاسم الطويل
  • الملفات ولاو 5 (زدوا pd.css) — الاختبارات: 21/21 colorHex + 13/13 reviews

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 v4 (F#103b reviewstability) — استقرار العرض ديال المراجعات:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • 🩹 نجوم الموبايل ولاو محصورين 1..5 (الكارت السطحية كانت محصورة، الموبايل لا —
    rating سالب كان يرمي RangeError ويطيح شبكة المراجعات كاملة · rating>5 كان overflow)
  • 🩹 المتوسط آمن: قيم CJ التالفة (null/string) ما كتعرضش "NaN" فالواجهة
  • 🩹 التاريخ: "Invalid Date" عمرو ما كيبان — فراغ بدل نص مكسور
  • الاختبارات: 13→30/30 reviews + 21/21 colorHex — الـ patch دابا 444+/40-
  • ملف واحد تبدل: ProductDetailsClient.tsx (الباقي كيف كيف)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 v5 (F#104 skeleton) — skeleton loading نظام كامل:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • ✨ app/components/Skeleton.tsx جديد — 10 سكيلتات بنفس geometry الحقيقي (zero CLS)
  • ✨ .sk fog shimmer فـ globals.css — fog-100 بلوك + موجة fog-200 1.4s
  • ♿ prefers-reduced-motion إجباري — الحركة كتوقف، البلوك fog-200 ثابت
  • 🦴 الهوم: grid skeleton بدل spinner (loading + الفيد اللانهائي + Suspense fallback)
  • 🦴 PDP: loading.tsx جديد (كانت route transition خاوية — fetch فيه retry + 700ms)
      + صفوف سكيلت وقت fetch المراجعات (غير إلا SSR ما جاب والو)
  • 🦴 كارت/فوفوري/كاتيݣوري/شيكاوت/review: سكيلتات خاصة بدل spinners
  • 🎨 spinners بلون خارج العقد #5F8271 → fog-600 (الباقي ديال ثيم Sage = backlog موثق)
  • الملفات ولاو 15 — الاختبارات: 37/37 skeleton + 30/30 reviews + 21/21 colorHex
  • العقد الكامل فـ DESIGN.md §4.4
