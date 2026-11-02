🚨 اقرأني الأول — فكس زر SEARCH (laclarc-full-files-v13.zip)

واش صار: في فكس الريسبونسيف السابق (v31) زدنا كلاس "relative" على زري البحث
(زر Search + زر المسح X) باش نوسعو منطقة الصبع — بصح الكلاس هذا صارع مع
كلاس "absolute" اللي كيحدد بلاصة الزر داخل حبّة البحث، وربحو — فالزر طاح
لليسار وطلع برة الحبّة (الحالة اللي صوّرتها في السكرين).

الفكس: حيدنا "relative" الزايد من الزوج — منطقة الصبع الموسعة باقة خدامة
(العنصر الـ absolute بنفسو كيولي مرساة للـ pseudo) + PWA v32 (bump إجباري).

الطريقة الأسرع (حالتك: main = v31 "resp" تطبق ونشرت):
  1) فك الضغط فوق C:\Users\B512\Desktop\DRPS\frontend (يغطي 2 ملفات)
  2) git add -A && git commit -m "searchbtn: fix absolute/relative class conflict (sw v32)" && git push
  3) npm run cf:deploy   (ولا أوتوماتيك إلا ربطتي GitHub من قبل)
  4) البراوزر: ريفرش · الهاتف: ريفرش مرتين (PWA v32 كتلمس الكاش القديم أوتوماتيك)

بديل: laclarc-searchbtn-FROM-resp31.patch (git apply --ignore-whitespace) — نفس النتيجة بايت-بايت.

الملفات: app/components/SearchBar.tsx · public/sw.js (v32)
تم التحقق: tsc ✓ · build 135/135 ✓ · replay write-tree = 9812f383 ✓
+ برهان بصري قبل/بعد بملف CSS الإنتاجي الحي: searchbtn-proof.png
