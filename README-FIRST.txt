================================================================
  LACLARC — AURORA · ROSE DUO EDITION · FINAL FULL FILES v5 — OWNER COLORS + CLEAN SWEEP
  الحل النهائي الأضمن — بلا git apply خلاص
================================================================

شنو هذا؟
--------
هذا الـ ZIP فيه النسخة النهائية الكاملة (63 ملفاً) من كل
التحديثات اللي درناها من البداية حتى اليوم:

  1. Serene fog v2.0        (تحويل الألوان الأول)
  2. Aurora Edition v1.0    (البنفسجي اللافندر طبق الأصل)
  3. FLY_TO_CART_V1         (الشارة تطير للدوك)
  4. REPLICA_V3             (hero tags + timeline pulse + empty states + success ring)
  5. REPLICA_V4             (sticky CTA + حلقة الأقسام + بطاقات الطلبات pills)
  6. REPLICA_V5             (شريط الثقة في الرئيسية)
  7. ROSE DUO               (البنفسجي + الوردي من الصورة تاعك)
  8. ROSE DUO scales        (أخضر maroccan-tea + ذهبي butter-up + 9 سكيلات)
  9. MERGE_MOCKUP           (Flash Sale نظيف + Best Selling + بانر + Read More/ستيبر المنتج)
 10. OWNER COLORS + CLEAN SWEEP (جديد): لونك اللي صيفطتهم بالبكسل ولّاو رسميين
     — خلفية #F5F2FB ووردي فاتح #FFE1EB — + السلة معاودة نقية بستيبر الكمية
     + الأقسام كروت نظيفة + البروفايل شرائح أيقونات + PWA v10.

⚠️ هذه النسخة v5 — تحل مكان أي ZIP قديم عندك.

كيفاش تخدم بيه (PowerShell داخل مجلد الـ repo):
-----------------------------------------------
  1. حط الملف laclarc-aurora-FINAL-full-files-v5.zip في مجلد الـ repo

  2. فك الضغط فوق الملفات مباشرة:
       Expand-Archive -Path laclarc-aurora-FINAL-full-files-v5.zip -DestinationPath . -Force

  3. سجل وادفع:
       git add -A
       git commit -m "Aurora + ROSE duo + MERGE_MOCKUP + OWNER COLORS - full final v5"
       git push

  4. صبر على النشر، من بعد حل الـ PWA في الهاتف
     — الـ Service Worker جديد (v10) يمسح الكاش القديم بوحدو.

ملاحظات مهمة:
-------------
 * الـ ZIP ما فيه حتى git apply — فقط فك الضغط، الملفات تتكتب فوق
   القديمة بالن(''س'')النهائية. تتقدر تطبقه حتى لو طبقت patches قبل.
 * ما تغيرتش حتى package.json — ما تحتاجش npm install.
 * إذا درت تعديلات يدوية خاصة بيك في هذي الملفات، الـ ZIP غادي يكتبهم
   فوق — احفظ نسخة قبل.
 * بعدها تنسى ملفات الـ patches القديمة — الـ ZIP هو المرجع النهائي.

قائمة الملفات (63):
-------------------
  app/(home)/HomeClient.tsx
  app/admin/advanced/page.tsx
  app/admin/baridimob/page.tsx
  app/admin/disputes/page.tsx
  app/admin/failed-orders/page.tsx
  app/admin/login/page.tsx
  app/admin/manage/page.tsx
  app/admin/page.tsx
  app/admin/payment-settings/page.tsx
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
  app/components/BestSelling.tsx
  app/components/PromoBanner.tsx
  app/categories/page.tsx
  app/categories/CategoriesClient.tsx
