# 🚀 كيت الهجرة: Vercel → Cloudflare Workers + Neon → Supabase

> **MIGRATION-CF v1** — لاحقاً للتوثيق: patch `laclarc-cfkit-FROM-*.patch`
> المبدأ: **Vercel يبقى حي كامل كاحتياط حتى تتحقق من CF بعينيك** — الرجوع في أي لحظة = تبديل DNS فقط.

---

## 🗺️ خريطة الهجرة (واش كينقل، واش كيبقى)

| المكوّن | فين دابا | وين رايح | الخدمة |
|---|---|---|---|
| الفرونت (Next.js 16) | Vercel Hobby | **Cloudflare Workers** | هذا الكيت — المرحلة 1 |
| الداتابيز (Postgres) | Neon free | **Supabase free** | المرحلة 2 — غير `DATABASE_URL` في Render يتبدل |
| الباك (server.js API) | Render free | **يبقى على Render** | ما كنمسوش الشقيقة — كيخدم |
| الصور | CJ/Aliyun OSS | **تبقى فين ما هي** | `unoptimized:true` — صفر تكاليف عند أي مضيف |
| PWA / sw.js | v30 | نفسه | كيتخدم من الأصول الثابتة ديال CF |

**علاش هجرة سهلة عندك تحديداً:** الفرونت ما عندو حتى داتابيز مباشرة (كلشي عبر API الباك)، ما عندو middleware، الصور unoptimized، والصفحات ISR كاشية 24h = الـ Worker يخدم قليل ويكاشر بزاف.

---

## 💰 حدود المجاني — علاش اخترناهم

### Cloudflare Workers Free (بديل Vercel)
| الحد | القيمة | عندك |
|---|---|---|
| Requests | **100,000 / يوم** (~3 مليون/شهر) | كافي بزاف — الموقع ISR كاشي |
| Bandwidth للأصول الثابتة | **غير محدود** | ✅ |
| KV (كاش ISR) | 1GB + 100K قراءة/يوم + 1K كتابة/يوم — **بلا كارت** | ISR-BUDGET خلاّ كتابات قليلة ✅ |
| D1 (كاش الوسوم) | 5GB + 5 مليون قراءة/يوم | ✅ |
| Builds | 500/شهر | ✅ |
| CPU | 10ms/request | ⚠️ الحد الوحيد اللي راقبه — الكاش يخفّفه (شوف Troubleshooting) |

### Supabase Free (بديل Neon)
| الحد | القيمة | عندك |
|---|---|---|
| الداتابيز | **500MB** Postgres حقيقي | الكتالوج ديالك صغير ✅ |
| API requests | غير محدودة | ✅ |
| Egress | 5GB/شهر | ✅ |
| ⚠️ الخمول | المشروع يطفي بعد **أسبوع بلا اتصال** | عندك cron كل ساعة في الباك → ما يطفيش أبدا ✅ |

---

# 📦 المرحلة 1 — الفرونت → Cloudflare Workers

## الخطوة 1 — حساب + تثبيت

1. أنشئ حساب في [dash.cloudflare.com](https://dash.cloudflare.com) (مجاني، بلا كarta — الكارت فقط كان بغيت دومين جديد).
2. طبّق الپتش ثم داخل `DRPS\frontend`:

```powershell
npm install
```
(الپتش زاد `@opennextjs/cloudflare` + `wrangler` في devDependencies — الـ install يجيبهم)

## الخطوة 2 — اصنع الموارد (دقائق)

```powershell
# الدخول — كيفتح المتصفح
npx wrangler login

# كاش ISR (KV) — الاسم مطابق لـ wrangler.jsonc — بلا كارت، يخدم مباشرة
# (R2 رفضناه: كيتطلب تفعيل بالكارت من الداشبورد)
npx wrangler kv namespace create NEXT_INC_CACHE_KV

# كاش الوسوم (D1) — ⚠️ انسخ من النتيجة "database_id" (UUID)
npx wrangler d1 create laclarc-tag-cache
```

**افتح `wrangler.jsonc` وعوّض المكانين:**
1. `REPLACE_WITH_KV_ID_FROM_kv_namespace_create` → بالـ **id** ديال KV اللي خرج.
2. `REPLACE_WITH_D1_UUID_FROM_d1_create` → بالـ **database_id** (UUID) اللي خرج.

## الخطوة 3 — السرّات (مرة واحدة)

```powershell
npx wrangler secret put REVALIDATE_SECRET
# → نفس قيمة REVALIDATE_SECRET اللي في Vercel env (هي اللي كيعرفها الباك)

npx wrangler secret put AUTH_SECRET
# → نفس AUTH_SECRET ديال Vercel (ولّا ولّد جديد: openssl rand -base64 32)

npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
# → نفس قيم Google OAuth ديال Vercel
```

## الخطوة 4 — تجربة محلية (اختيارية ولكن مفيدة)

```powershell
npm run cf:preview
```
كيبني وكيشغّل الـ Worker محلياً — جرب الرئيسية والمنتجات من المتصفح.

## الخطوة 5 — النشر التجريبي على workers.dev

```powershell
npm run cf:deploy
```
النتيجة: `https://laclarc.<subdomain>.workers.dev` — **دومين تجريبي، لا يمس laclarc.com إطلاقاً**.

## الخطوة 6 — ✅ تشيك ليست التحقق (على workers.dev)

| # | الاختبار | كيفاش |
|---|---|---|
| 1 | الرئيسية تفتح | متصفح — المنتجات كيبانو؟ |
| 2 | صفحة منتج | فتح منتج من الشبكة |
| 3 | الأقسام + فرز/فلترة | Sort By يبدل الترتيب فعلاً |
| 4 | إعادة التوليد | `curl "https://laclarc.<sub>.workers.dev/api/revalidate?secret=<السر>&path=/"` → `{"ok":true}` |
| 5 | Google login | سجل دخول — ⚠️ قبلها زيد في **Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs** الرابط: `https://laclarc.<sub>.workers.dev/api/auth/callback/google` |
| 6 | PWA | DevTools → Application → Service Workers → v30 |
| 7 | Console نقي | ما فيهش أخطاء حمرا (تحذيرات Sentry عادية) |

## الخطوة 7 — الدومين الحقيقي laclarc.com (الخطوة اللا رجعة فيها إلا بدّلت DNS)

1. Cloudflare Dashboard → **Add a site** → `laclarc.com` (Free plan).
2. CF كيعطيك **زوج nameservers** (بحال `xxx.ns.cloudflare.com`).
3. روح عند مسجّل الدومين متاعك → بدّل الـ nameservers ديالهم بنتائج CF.
   - ⏳ الانتشار من دقائق حتى 24 ساعة.
4. في CF: **Workers & Pages → laclarc → Settings → Domains & Routes → Add → Custom Domain** → `laclarc.com`.
5. جرب تشيك ليست الخطوة 6 على `https://laclarc.com` نفسها.

### 🔙 خطة الرجوع (طالما Vercel حي)
- Vercel project ما تنقصو والو — النشر الأوتوماتيكي كل push باقي خدام.
- الرجوع: عند مسجّل الدومين، رجّع الـ nameservers/سجلات DNS ديال Vercel (A/CNAME).
- `vercel.app` الرابط القديم يبقى خدام طول الوقت = نسخة احتياطية جاهزة.
- ⚠️ **Google OAuth**: خلي URI ديال laclarc.com + workers.dev + vercel.app كلهم في القائمة — أي بيئة تقدر تستقبل.

---

# 🗄️ المرحلة 2 — Neon → Supabase (الباك على Render)

> الباقي كلو بيديك يتبدل **غير سطر واحد** في env ديال Render: `DATABASE_URL`.
> Neon يبقى حي حتى تتحقق — الرجوع = رجّع السطر القديم.

## الخطوة 1 — أنشئ مشروع Supabase

1. [supabase.com](https://supabase.com) → New project → اسم `laclarc` + password قوي (سجلو!).
2. **Region: اختار الأقرب لـ region ديال Render service** (كان الباك في Frankfurt → `eu-central-1`) — الاتصال يولي أسرع.
3. كيولّد ليك Project Settings → Database → **Connection string**:
   - للباك الطويل على Render: استعمل **Session pooler (port 5432)** — الشكل:
     `postgresql://postgres.<ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   - أضف `?sslmode=require` إلا ما كانش.

## الخطوة 2 — الصب البيانات من Neon

من جهاز فيه `pg_dump` (PostgreSQL install ولا WSL):

```bash
# 1) الصب من Neon (الرابط ديال Neon من dashboard.neon.tech)
pg_dump --no-owner --no-privileges --no-comments \
  -d "postgresql://<user>:<pass>@<host>.neon.tech/<db>?sslmode=require" \
  -F c -f laclarc.dump

# 2) رجّو في Supabase
pg_restore --no-owner --no-privileges \
  -d "postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
  laclarc.dump
```

> ما عندكش pg_dump؟ قولي — نعطيك طريقة GitHub Actions (بلا تثبيت محلي) ولا نديرو سكريبت.

## الخطوة 3 — بدّل Render

Render Dashboard → الخدمة متاعك → **Environment** → `DATABASE_URL` = رابط Supabase (الخطوة 1) → **Save** (كيعاود يشغّل السيرفر).

## الخطوة 4 — تحقق

- Render logs: ما فيهش `ECONNREFUSED` / auth errors.
- الموقع: منتجات كيبانو، طلب تجريبي (checkout) يخدم.
- ⚠️ **النقطة الحساسة**: بعد تبديل `DATABASE_URL`، البيانات الجديدة (طلبات/تعديلات) تمشي لـ Supabase — **ما ترجعش لـ Neon بعد نقطة هادي** كان بغيت ضياع داتا. الرجوع ممكن قبل أول طلب حقيقي فقط.

## الخطوة 5 — أغلق الأسبوع الكاحول

- خلّي Neon project حي أسبوع (ما يتبنىش — النطاق الحر كيتجدّد وحدو).
- بعد أسبوع بلا مشاكل: Neon → Settings → Pause (ولا خليه — 0.5GB + ساعات مجانية كافية كان بغيتو كنسخة أرشيف).
- Supabase: ما يطفيش حيت الباك كيضربو كل ساعة (cron) — تأكد cron باقي خدام.

---

# 🧯 Troubleshooting — مشاكل معروفة وحلولها

| العرض | السبب | الحل |
|---|---|---|
| `wrangler deploy` رفض: D1 `database_id` غالط | ما عمّرتش الـ UUID | الخطوة 2 — عوّض في `wrangler.jsonc` |
| البيلد طاح عند Sentry | `withSentryConfig` فبيئة جديدة | نبعثلي الإيرور — پتش سطرين جاهز عندي |
| `redirect_uri_mismatch` في Google | الـ callback ما مسجلش | Google Console → أضف `https://<domain>/api/auth/callback/google` |
| `unauthorized` من `/api/revalidate` | السر ما حطيتوش | `npx wrangler secret put REVALIDATE_SECRET` |
| صفحات قديمة ما تتبدلش | كاش ISR في KV قديم | نفس curl ديال التحقق #4 بالوسوم |
| `Worker exceeded CPU time` (نادر) | route تقيلة SSR | قولي — نفعّلو `withRegionalCache` ولا نحبو الـ route |
| Supabase `too many connections` | استعملت direct بلا pooler | استعمل رابط **pooler** (5432/6543) ماشي `db.<ref>.supabase.co` |

---

# 📝 ملاحظات تقنية (للأرشيف)

- الكونفيغ كامل مبني على دوك OpenNext الرسمية: `defineCloudflareConfig` + KV incremental cache + DO queue + D1 tag cache (وصفة "small site with revalidation").
- `initOpenNextCloudflareForDev()` في `next.config.ts` — تنشط غير في `next dev`، ما كتأثر لا على Vercel build لا على CF build.
- Vercel يقدر يبقى مضيف أساسي حتى لل أبَد — هاد الكيت ما يحيد والدو شي حاجة منه.
- `public/_headers`: كاش immutable للأصول + sw.js بلا كاش (تحديث PWA فوري) — نفس سلوك Vercel.
- أي push جديد من بعد هاد الپتش = Vercel ينشر أوتوماتيك (كما هو)، وCF تحتاج `npm run cf:deploy` يدوي — كي جات راك الأوتوماتيكة الكاملة، نربطو GitHub → Workers (Workers Builds) في 5 دقايق.
