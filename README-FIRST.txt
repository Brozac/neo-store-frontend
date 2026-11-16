════════════════════════════════════════════════════════════
 LACLARC F#101-dsaudit — 4 ملفات FROM 818b174 (colorrail)
 قرا هادا قبل أي حاجة 🙏
════════════════════════════════════════════════════════════

اللي كاين هنا (308+/19-):
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
  git add -A && git commit -m "f101-dsaudit: colorHex (21/21) + purple→fog PDC×13 + FBT phantom→\$ + Bag→Cart + aria-pressed + DESIGN.md v1.0"
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
