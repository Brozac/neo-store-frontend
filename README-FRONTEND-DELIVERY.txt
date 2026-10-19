═══════════════════════════════════════════════════════════════════
 Kit 28 — Worldwide Live Delivery Estimator (الواجهة العالمية)
 laclarc_worldwide_delivery_kit.zip     ← يتطلب Kit 27 فالـ backend!
═══════════════════════════════════════════════════════════════════

🇲🇦 بالدارجة — شنو كيدير؟
═══════════════════════════════════════════════
قلنا: الموقع مستهدف للعالم كامل — إذن لا دولة افتراضية! هاد الكيت
كيخلي مربع "Estimated Delivery" فصفحة المنتج يولي حقيقي لكل زائر:

  1) 🌍 /api/geo (جديد) — كتحدد دولة الزائر أوتوماتيكياً من Vercel
     edge geo header (x-vercel-ip-country) — بلا خدمة خارجية، بلا كلفة
  2) 🚚 DeliveryEstimator v2 — كيطلب التقدير الحقيقي من الـ backend
     (Kit 27: freightCalculate ديال CJ + cache 6 ساعات) و كيبان:
       "Estimated Delivery to US: Feb 28 – Mar 15" (دولة الزائر!)
     والعدّاد ديال "Order within" كيبقى كما هو
  3) 🛡️ Fallback كامل — أي حاجة فشلات (geo خاوي فالمحلي، backend
     طايح، دولة غير مدعومة فالماتريكس) كيرجع للوضع القديم 7-12 يوم
     بلا حتى خطأ يبان للزائر. صفحة ما كتطيحش أبدا.

⚠️ الترتيب ضروري: **Kit 27 خاصو يكون مطبق فالـ backend أول** (ولا
   الزوار غادي يبقاو على 7-12 العادي بلا مشكل — غير ما يتحدثش شي).

📦 الملفات:
   patch_frontend_delivery.py    ← الـ patcher (جراحي + backup)
   INSTALL_FRONTEND_DELIVERY.bat ← دوبل كليك
   verify_delivery_frontend.py   ← التحقق من بعد الـ deploy
   README-FRONTEND-DELIVERY.txt  ← هاد الملف

📦 التركيب (5 دقايق):
   1. فك الـ ZIP فجذر الـ frontend (المجلد اللي فيه next.config.ts)
   2. دوبل كليك: INSTALL_FRONTEND_DELIVERY.bat
   3. npm run build  ← خاصو يدوز (سطر حماية)
   4. git add app/api/geo app/components/DeliveryEstimator.tsx "app/products/[id]/ProductDetailsClient.tsx"
      git commit -m "Kit28: worldwide live delivery estimator"
      git push   ← Vercel كيبني بوحدو (2-4 دقايق)
   5. python verify_delivery_frontend.py https://laclarc.com <pid حقيقي>

🧪 كيفاش تعرف بلي خدمت:
   - فتح صفحة منتج مع VPN ولا من بلاد مختلفة → غادي تشوف
     "Estimated Delivery to XX: ..." بدل التواريخ الثابتة
   - فالمتصفح: https://laclarc.com/api/geo → {"country":"MA"} مثلا
   - Render logs غادي يبيّن 📊 [CJ Points] من Kit 27

📊 نقاط CJ — الأثر:
   كل زائر على منتج = استدعاء estimate (10 نقاط) غير على cache-miss
   (6 ساعات/منتج×دولة). مع 1000 زائر/يوم موزعين على 20 منتج × 15 دولة
   ≈ 300 cache-miss ≈ 3,000 نقطة — ضئيل مقابل 50,000/يوم. ✓

↩️ الرجوع للخلف:
   ren app\components\DeliveryEstimator.tsx.bak-kit28 DeliveryEstimator.tsx
   ren "app\products\[id]\ProductDetailsClient.tsx.bak-kit28" ProductDetailsClient.tsx
   del app\api\geo\route.ts   (ولا خليه — ما فيه حتى ضرر)
   git add/commit/push

🇨🇳 中文说明
═══════════════════════════════════════════════
Kit 28 = 前端全球实时到货估算（依赖后端 Kit 27）：
1) 新增 app/api/geo/route.ts — 从 Vercel edge header (x-vercel-ip-country)
   自动返回访客国家（本地开发为 null），零外部服务、零成本
2) DeliveryEstimator v2 — 自动取访客国家 → 调后端 /api/shipping/estimate
   （CJ freightCalculate 实时数据 + 6h 缓存）→ 显示
   "Estimated Delivery to US: … " 真实日期区间；"Order within" 倒计时不变
3) 完整降级：任何失败（geo 为空/后端宕机/矩阵不支持）静默回退旧的
   7-12 天，页面永不报错
安装：解压到 frontend 根目录 → 双击 INSTALL_FRONTEND_DELIVERY.bat
     → npm run build → git push → Vercel 自动部署 → 跑 verify 脚本
积分影响：仅 cache-miss 消耗（每 产品×国家 6h 内 10 分），日均约 3k 分，
远低于 5 万/日上限。
注意：需先部署后端 Kit 27，否则估算保持旧文案（无害）。
