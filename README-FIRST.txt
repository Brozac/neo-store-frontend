================================================================
  LACLARC — AURORA EDITION · FINAL FULL FILES
  الحل النهائي الأضمن — بلا git apply خلاص
================================================================

شنو هذا؟
--------
هذا الـ ZIP فيه النسخة النهائية الكاملة (55 ملفاً) من كل
التحديثات اللي درناها من البداية حتى اليوم:

  1. Serene fog v2.0        (تحويل الألوان الأول)
  2. Aurora Edition v1.0    (البنفسجي اللافندر طبق الأصل)
  3. FLY_TO_CART_V1         (الشارة تطير للدوك)
  4. REPLICA_V3             (hero tags + timeline pulse + empty states + success ring)
  5. REPLICA_V4             (sticky CTA + حلقة الأقسام + بطاقات الطلبات pills)
  6. REPLICA_V5             (شريط الثقة في الرئيسية)
  7. PWA cache v6           (الهاتف يجيب النسخة الجديدة أوتوماتيك)

كيفاش تخدم بيه (PowerShell داخل مجلد الـ repo):
-----------------------------------------------
  1. حط الملف laclarc-aurora-FINAL-full-files.zip في مجلد الـ repo
     (نفس البلاصة فين جربت git apply)

  2. فك الضغط فوق الملفات مباشرة:
       Expand-Archive -Path laclarc-aurora-FINAL-full-files.zip -DestinationPath . -Force

  3. سجل وادفع:
       git add -A
       git commit -m "Aurora Edition - full final (fly + v3 + v4 + v5 trust bar)"
       git push

  4. صبر على النشر (Vercel/النشر التلقائي)، من بعد حل الـ PWA في الهاتف
     — الـ Service Worker جديد (v6) يمسح الكاش القديم بوحدو.

ملاحظات مهمة:
-------------
 * الـ ZIP ما فيه حتى git apply — فقط فك الضغط، الملفات تتكتب فوق
   القديمة بالن('{{س}}')النهائية. تتقدر تطبقه حتى لو طبقت patches قبل.
 * ما تغيرتش حتى package.json — ما تحتاجش npm install.
 * إذا درت تعديلات يدوية خاصة بيك في هذي الملفات، الـ ZIP غادي يكتبهم
   فوق — احفظ نسخة قبل.
 * بعدها تنسى ملفات الـ patches القديمة — الـ ZIP هو المرجع النهائي.

قائمة الملفات (55):
-------------------
  app/(home)/HomeClient.tsx
  app/admin/disputes/page.tsx
  app/admin/failed-orders/page.tsx
  app/admin/manage/page.tsx
  app/admin/page.tsx
  app/all-products/page.tsx
  app/auth/page.tsx
  app/auth/reset-password/page.tsx
  app/cancel/page.tsx
  app/cart/page.tsx
  app/category/[...slug]/CategoryClient.tsx
  app/cj-product/[pid]/page.tsx
  app/components/AIChatWidget.tsx
  app/components/BuyButton.tsx
  app/components/CartWidget.tsx
  app/components/CountdownTimer.tsx
  app/components/DeliveryEstimator.tsx
  app/components/ExitIntentPopup.tsx
  app/components/FlyToCart.tsx
  app/components/Footer.tsx
  app/components/FrequentlyBoughtTogether.tsx
  app/components/GlassDock.tsx
  app/components/HeroSection.tsx
  app/components/LightningDeals.tsx
  app/components/MultiStepRegister.tsx
  app/components/Navbar.tsx
  app/components/PaymentModal.tsx
  app/components/ProductCard.tsx
  app/components/ReviewForm.tsx
  app/components/SearchBar.tsx
  app/components/ShipTruthJourney.tsx
  app/components/ShoppableReels.tsx
  app/components/SpinWheel.tsx
  app/components/TiltCard.tsx
  app/components/floating/FloatingSupport.tsx
  app/components/icon.tsx
  app/components/icons/LaclarcIcons.tsx
  app/components/kit30-diag/ProductCard.after.tsx
  app/components/ui/GlassDock.tsx
  app/components/ui/GlassIcon.tsx
  app/context/CartContext.tsx
  app/exchange/ExchangeClient.tsx
  app/favorites/page.tsx
  app/globals.css
  app/layout.tsx
  app/manifest.ts
  app/opengraph-image.tsx
  app/orders/page.tsx
  app/products/[id]/ProductDetailsClient.tsx
  app/profile/page.tsx
  app/providers.tsx
  app/review/[orderId]/page.tsx
  app/success/page.tsx
  app/track-order/page.tsx
  public/sw.js
