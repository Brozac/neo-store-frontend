LACLARC — CF-KIT NOR2 (KV edition) — 3 files replacement
==========================================================
إلا رفض `git apply laclarc-cfkit-nor2-KV-FROM-cfkit.patch` (مشكل CRLF في ويندوز):

1. فك هاد الـ ZIP فوق جذر الريبو (DRPS\frontend) — كيعوّض 3 ملفات كاملة:
   - open-next.config.ts   (R2 → KV)
   - wrangler.jsonc        (r2_buckets → kv_namespaces)
   - MIGRATION-CF.md       (الدليل محدّث)

2. من بعد:
   git add -A
   git commit -m "cfkit nor2: ISR cache R2 to KV (no card needed)"
   git push

3. رجع للدليل MIGRATION-CF.md — الخطوة 2 ولّات:
   npx wrangler kv namespace create NEXT_INC_CACHE_KV
   (انسخ الـ id وعوّض REPLACE_WITH_KV_ID_FROM_kv_namespace_create في wrangler.jsonc)

الأساس المتوقع: commit d05e6f1 (cfkit) — إلا كنتي قبل منو، طبق cfkit أولاً.
