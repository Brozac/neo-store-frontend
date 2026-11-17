🚦 laclarc-visibility-v27-kit — الحفظ الدائم بنمط payment-settings
════════════════════════════════════════════════════════════════════

شنو كان المشكل (الحقيقة الكاملة):
  · الباكند كان منشور من قبل في Render (الكوميت 812cc97 فيه الرقعة) —
    لهذا الـ push ديال اليوم لقى "nothing to commit". الباكند سليم.
  · صفحة Visibility في الفرونت كانت كتحاول تخزن في Workers KV
    (/api/site-config) — هاد التخزين ما خدامش → الحفظ يضيع و كل مرة
    كترجع لقيته رجع.
  · دابا: التخزين في قاعدة بيانات الباكند (store_settings) — نفس نمط
    payment-settings بالضبط: adminApi.get للقراءة + adminApi.put للحفظ.
    جوج طلبات: hidden_routes + hidden_sections. نقطة.

التركيب (دقيقتين):
────────────────────────────────────────────
  1) فكّ ضغط الكيت
  2) من Git Bash، نسخ جوج ملفات فوق نسخة الريبو ديالك:

       cd ~/Desktop/DRPS/frontend
       cp ~/Downloads/laclarc-visibility-v27-kit/lib/siteConfig.ts lib/siteConfig.ts
       cp ~/Downloads/laclarc-visibility-v27-kit/app/admin/visibility/page.tsx app/admin/visibility/page.tsx

  3) دفع:

       git add lib/siteConfig.ts app/admin/visibility/page.tsx
       git commit -m "visibility v27: persist via backend store_settings (payment-settings style)"
       git push

  4) الـ Deploy كيتبنى أوتوماتيكياً (~2-3 دقايق)

التحقق (بالترتيب — تشوف بعينيك):
────────────────────────────────────────────
  أ) قبل: curl https://neo-store-backend.onrender.com/api/settings
  ب) دخل /admin/visibility → حبس فرع (مثلاً Favorites) → Save & Publish
     → خاصك تشوف: ✅ Saved to the database
  ج) سد التاب و عاود دخّل للغرفة → Favorites مازال مخفي ✓ (محفوظ في الداتابيز)
  د) عاود الـ curl → المفروض تشوف hidden_routes:["/favorites"] ✓
  هـ) الموقع في نافذة خاصة (بلا login):
       · /favorites كتطلع "Temporarily unavailable" ✓
       · اللينك ديالها زاحف من النافبار و الدوك ✓
  و) رجّع الزر (شعل Favorites) → Save → كلشي رجع كما كان ✓

ملاحظات:
────────────────────────────────────────────
  · أول Save كيصايب الصفوف في الداتابيز أوتوماتيكياً (ما كاين ما تدير بيدك).
  · الزوار يشوفو التغيير خلال ≤ دقيقة (كاش القراءة 60 ثانية).
  · الريلز كتتزامن مع مفتاح show_reels أوتوماتيكياً عند الحفظ.
  · /api/site-config و siteConfigStore بقاو في الريبو بصح ولّاو ميت كود —
    حتى واحد ما كيستعملهم من بعد اليوم. تقدر تحيدهم من بعد إلا بغيتي.
  · الأخطاء اللي شفتي في لوگ Render (CJ cron integer + auth timeout)
    قديمة و مستقلة — ما عندهم حتى علاقة بالظهور.
