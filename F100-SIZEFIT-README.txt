═══════════════════════════════════════════════════════════════════
 LACLARC F#100 — Size & Fit بجدول حقيقي (شارت المورد + chips + ملاحظات)
═══════════════════════════════════════════════════════════════════

📌 شنو كان البلاغ؟
   تاب/أكورديون «Size & Fit» كان غير جملة placeholder:
   «Standard fit. Order your typical size...» — بلا حتى جدول، بلا معلومات.
   والمطلوب: Size & Fit بجدول حقيقي.

🔍 وين جات «الجدول الحقيقي»؟
   فحصنا 50 منتج حي من الكاتالوغ — الجداول الحقيقية تاع CJ ما راهيش
   جداول HTML فالوصف، راهي **صورة شارت** جوة قسم «Size:» / «Size Information:»
   فوصف المورد (مثبت: 97753 البنطلون · 97766 البدلة · 97751 الولاعة · 97754 المغناطيس).
   + نصوص المورد الحقيقية: «Asian sizes are 1 to 2 sizes smaller...» /
   «Please allow 2-3cm differences...» — كلها كتبان دابا.
   🛡️ بلا اختراع: كنعرضو غير اللي مكتوب فالوصف فعلاً (M#45 محترم).
   الجداول القياسية المصطنعة (أرقام مخترعة) مرفوضة عمداً.

🧩 شنو تبدل (+202/−5 فوق F99، ملف واحد):
   1) Supplier size chart — صورة الشارت الحقيقية من الوصف، زوم بكامل
      الدقة (tap → fullscreen، فوق الـ lightbox z-210)
   2) Available sizes — chips تفاعية من variants الحقيقية (نفس محرك الشراء،
      الضغطة كتختار المقاس) — وإلا «Supplier size range» عرض فقط من
      صف «Size:» تاع الوصف (مثل الحلقات 5–11 · البنطلون S–XL)
   3) Supplier fit notes — ملاحظات المورد الحقيقية (≤4، بلا تكرار)
   4) How to measure — دليل قياس محايد (صدر/خصر/ورك/طول + 1 inch = 2.54 cm)
   5) الفallback الصادق — منتجات بلا حتى معلومة مقاس (الساعة، الديكور...)
      كتولي تقول «المورد ما وفّرش شارت — تواصل مع الدعم» بدل «Standard fit»
      اللي كانت وعد بلا سند
   · الأبعاد بوحدات (35cm...) ما توليش chips — بقات فجدول Specifications
   · أكورديون Size ولا pd-acc-tall (مثل Details) — الشارت الطويل ما يتقصش
   · تاب الديسكتوب + أكورديون الموبايل = نفس الـ renderer المشترك
   · SW: بلا bump (v40) — الشارت صورة runtime من CDN تاع CJ

🧪 التحقق:
   · الـ extractor متحقق على 50 وصف حي: 4 charts كلهم تحت عناوين size
     صريحة · 4 notes · بلا false positives
   · npm ci 0 ✓ · tsc --noEmit = 0 ✓ · next build ✓ (7.4s)
   · معاينة before/after بمعطيات حية: laclarc-F100-sizefit-preview.html

📦 المحتوى (الزيب تراكمي — F99 ما مازال ما تطبقش فـ GitHub):
   app/products/[id]/ProductDetailsClient.tsx  ← F99 + F100 معاً
   app/products/[id]/pd.css                    ← F99 (تفاصيل الأكورديون الطويل)
   F100-SIZEFIT-README.txt                     ← هذا الملف

🚀 طريقة التطبيق — جوج خيارات:

   ▶ الخيار A (patch — إلا طبقتي F99 من قبل):
     من جذر الـ FE repo (بعد ما يكون F99 مطبق = شجرة 687fa09c):
       git apply laclarc-frontend-sizefit-F100-FROM-687fa09c.patch
       git add -A && git commit -m "laclarc-frontend-sizefit-F100" && git push

   ▶ الخيار B (الزيب — إلا مازال ما طبقتيش F99 — الأبسط):
     فك الزيب فوق جذر الـ repo (overlay — الملفات كتغطي القديمة):
       unzip -o laclarc-frontend-F100-sizefit.zip -d <repo-root>
       git add -A && git commit -m "laclarc-frontend-detailparse-F99 + sizefit-F100" && git push

✅ المرجع المتوقع بعد التطبيق:
   · الخيار A: شجرة 2424aace فوق 687fa09c
   · الخيار B: نفس الشجرة 2424aace فوق 4f8b4ac مباشرة
   (التحقق: git write-tree بعد git add -A — ولا غير شوف الصفحة: منتج
    97766 ولا 97753 → Size & Fit → الشارت الحقيقي كيبان وكيتكبر بالضغطة)

═══════════════════════════════════════════════════════════════════
