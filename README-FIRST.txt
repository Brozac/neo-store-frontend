================================================================
  LACLARC — SERENE v2 + BRAND ICON · FINAL FULL FILES v7
  الحل النهائي الأضمن — بلا git apply خلاص
================================================================

شنو هذا؟
--------
النسخة الكاملة النهائية لكل التحديثات من أول الجولة حتى اليوم:

  1..8  كل جولات AURORA/ROSE/MERGE السابقة (نفس v6)
  9.  SERENE V2 (ضباب أزرق #5B7EA6): خطوط Tajawal+Marcellus مستضافة محلياً،
      نافبار زجاجي، GlassDock pills، كروت منتجات نظيفة، أسعار fog، blobs
 10. OWNER COLORS + CLEAN SWEEP: السلة/الأقسام/البروفايل بنفس الروح
 11. BRAND ICON (جديد v7): أيقونتك الرسمية (مونوغرام LL) ولّى:
      - فالنافبار بلاصة المربع البنفسجي بحرف L
      - كلمة SERENE EDITION تمسحت من تحت LACLARC
      - أيقونة PWA (الهاتف) 512+192+maskable كلهم بالأيقونة الجديدة
      - صفحة تسجيل الدخول والهيرو رثاوها أوتوماتيك
      PWA cache ولّى v12.

كيفاش تخدم بيه (PowerShell داخل مجلد الـ repo):
-----------------------------------------------
  1. حط laclarc-aurora-FINAL-full-files-v7.zip في مجلد الـ repo

  2. فك الضغط فوق الملفات مباشرة:
       Expand-Archive -Path laclarc-aurora-FINAL-full-files-v7.zip -DestinationPath . -Force

  3. سجل وادفع:
       git add -A
       git commit -m "SERENE v2 + BRAND ICON - full final v7"
       git push

  4. صبر على النشر. PWA فالهاتف: حل الموقع مرتين باش الـ sw الجديد (v12) يتسجل
     ويمسح الكاش القديم بوحدو.

ملاحظات:
--------
 * بلا git apply — فك الضغط فقط، الملفات تتكتب فوق القديمة بالن النهائية.
 * الخطوط (public/fonts) والأيقونات (public/icon-*) داخلين في الـ ZIP.
 * ما تبدلتش package.json — ما تحتاجش npm install.
 * إذا عندك تعديلات يدوية في نفس الملفات، احفظ نسخة قبل.

قائمة الملفات:
--------------
  app/(home)/HomeClient.tsx
  app/admin/failed-orders/page.tsx
  app/admin/page.tsx
  app/all-products/page.tsx
  app/auth/page.tsx
  app/auth/reset-password/page.tsx
  app/cancel/page.tsx
  app/cart/page.tsx
  app/categories/CategoriesClient.tsx
  app/categories/page.tsx
  app/category/[...slug]/CategoryClient.tsx
  app/checkout/page.tsx
  app/cj-product/[pid]/page.tsx
  app/components/AIChatWidget.tsx
  app/components/BestSelling.tsx
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
  app/components/ProductCard.tsx
  app/components/PromoBanner.tsx
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
  app/exchange/ExchangeClient.tsx
  app/favorites/page.tsx
  app/globals.css
  app/layout.tsx
  app/manifest.ts
  app/opengraph-image.tsx
  app/orders/page.tsx
  app/privacy/page.tsx
  app/products/[id]/ProductDetailsClient.tsx
  app/profile/page.tsx
  app/refund/page.tsx
  app/review/[orderId]/page.tsx
  app/success/page.tsx
  app/terms/page.tsx
  app/track-order/page.tsx
  public/fonts/marcellus-latin-400.woff2
  public/fonts/marcellus-latin-ext-400.woff2
  public/fonts/tajawal-arabic-400.woff2
  public/fonts/tajawal-arabic-500.woff2
  public/fonts/tajawal-arabic-700.woff2
  public/fonts/tajawal-arabic-800.woff2
  public/fonts/tajawal-latin-400.woff2
  public/fonts/tajawal-latin-500.woff2
  public/fonts/tajawal-latin-700.woff2
  public/fonts/tajawal-latin-800.woff2
  public/icon-192.png
  public/icon-512-maskable.png
  public/icon-512.png
  public/sw.js
