# MIGRATION-D1.md — 100% D1 — الكاتالوگ كامل على الحافة (لا Supabase لا Render)

> الوثيقة الأم للمرحلة 1 (sync pipeline). الوراءية المعمارية: **PostgreSQL المحلي
> (laclarc_db) هو مصدر الحقيقة — D1 هو النسخة الحية على الحافة.**

```
┌─────────────────────────── PC المحلي (Windows) ───────────────────────────┐
│  pgAdmin / massSync.js ──► PostgreSQL 18 (laclarc_db · 54,367 منتج)      │
│                                   │ AFTER INSERT/UPDATE/DELETE            │
│                                   ▼ pg_notify('d1_sync_channel')         │
│                       realtime-d1-watcher.mjs (PM2)                       │
└───────────────────────────────────│───────────────────────────────────────┘
                                    │ POST /api/admin/d1-realtime-sync
                                    │ (x-admin-password · timing-safe)
┌───────────────────────────────────▼────────────── Cloudflare Edge ───────┐
│  Worker (custom-worker.ts) → upsert/delete → D1 laclarc-catalog (DB)     │
│                              → purgeEdgeCache (revalidateTag + zone + KV)│
│  قراءات الكاتالوگ ← phase-2: /api/products … كتقرا من D1 نيشان           │
│  R2 laclarc-media (MEDIA_BUCKET) — feeds كل يوم 03:00 UTC                │
└───────────────────────────────────────────────────────────────────────────┘
```

## ملفات المرحلة 1 (جميعهم فالريبو)

| الملف | الدور |
| --- | --- |
| `migrations/d1_schema.sql` | سكيما D1 (products · orders · system_events · d1_meta) — SQLite dialect |
| `lib/d1.ts` | الجسر الوحيد للـ Worker مع D1 (getD1 · upsert · delete · count · log) |
| `lib/edge-cache.ts` | + `purgeEdgeCache()` — revalidateTag + zone purge + KV bump (debounced) |
| `app/api/admin/d1-realtime-sync/route.ts` | endpoint الكتابة الحية — auth timing-safe بـ ADMIN_PASSWORD |
| `scripts/pg-triggers-d1-sync.sql` | يلصق فpgAdmin — triggers → pg_notify d1_sync_channel |
| `scripts/realtime-d1-watcher.mjs` | LISTEN → جيب الصف → POST للـ edge (exit(1) → PM2 restart) |
| `scripts/push-local-to-d1.mjs` | الدفعة الأولى 54,367 → D1 (chunks 500 → wrangler --remote) |
| `scripts/laclarc-d1-windows.ps1` | 🔑 السكريبت الرئيسي — 9 خطوات من الـ PC (backup · D1 · schema · push · PM2) |

## التشغيل (على الـ PC)

```powershell
cd C:\Users\B512\Desktop\DRPS\frontend
# 1) عمّر المتغيرات فscripts/laclarc-d1-windows.ps1 (مرة وحدة):
#    $PgPassword · $AdminPassword
# 2) الصق scripts/pg-triggers-d1-sync.sql فpgAdmin (Query Tool → F5)
# 3) جري:
.\scripts\laclarc-d1-windows.ps1
```

السكريبت كيدير: pg_dump احتياطي → D1 creation → bindings فwrangler.jsonc →
schema → bulk push → orders export → ADMIN_PASSWORD secret → PM2 watcher →
push الـ config (سؤال y/n) → deploy.

## التحقق بعد التشغيل

```powershell
pm2 status laclarc-d1-watcher
npx wrangler d1 execute laclarc-catalog --remote --command "SELECT COUNT(*) FROM products"   # ≈ 54,367
pm2 logs laclarc-d1-watcher --lines 30 --nostream
# تجربة: عدّل شي منتج فpgAdmin → UPSERT ok فالسجل ف<1 ثانية
```

## المرحلة 2 (بعد ما D1 يتحقق ≈54,367 والـ watcher مستقر)

- قراءات الكاتالوگ (`/api/products` · PDP · sitemap · feeds) تقلب على `env.DB`
  مع fallback للمسارات الحالية — ثم تفعيل Hyperdrive وSupabase نهائياً.
- حذف `hyperdrive` من wrangler.jsonc + تنظيف `lib/db-ro.ts` / `lib/cron-db.ts`.
- الشيكاوت/الطلبات على D1 (phase-3) — جدول orders جاهز فالسكيما.

## Rollback

- وقف الـ sync: `pm2 delete laclarc-d1-watcher` — الإنتاج يبقى كيف هو.
- حيد triggers: شوف آخر مقطع ف`scripts/pg-triggers-d1-sync.sql`.
- wrangler.jsonc: ارجع بالـ marker (`// { "binding": "DB" ...`) ولا git revert.


---

## ✅ phase-2 منجرة (2026-11-28) — القراءات على D1

- `lib/d1-catalog.ts` (جديد): 14 قراءة كاملة من `env.DB` بنفس أشكال الباك —
  `lib/db-reads.ts` كيجرّب D1 الأول، Hyperdrive/Supabase ولى fallback.
- facets محسوبة مسبقاً (`facet_colors` · `facet_sizes` · `swatch_raw`) —
  backfill كامل 54,367/54,367 عبر REST (backfill_facets.py) · الكتابة الجديدة
  كتحسبهم فـ `shapeProductRow` (lib/d1.ts) — الفلاتر بلا json_each (7429-safe).
- categories · store_settings · category_images: الجداول كاينين فالـ D1،
  الداتا كتدخل بـ `node scripts/push-categories-settings.mjs` من الـ PC
  (مرة وحدة، idempotent). قبل الدفع: /api/settings ترجع {} (defaults) و
  /api/categories كيبقى بالسلوك القديم.
- mosaic: md5 → hash رقمي deterministic (D1 ما فيهاش md5) — نفس الهدف (تنويع).
- Hyperdrive مازال مربوط (fallback) — الحذف النهائي من بعد ما الكل يتحقق أخضر.
