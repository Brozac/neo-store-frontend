-- ═══════════════════════════════════════════════════════════════════
-- scripts/pg-triggers-d1-sync.sql — 100% D1 — triggers ديال PostgreSQL المحلي
-- ═══════════════════════════════════════════════════════════════════
-- 📌 كيفاش تتستعمل: فpgAdmin → laclarc_db → Query Tool → الصق الكل → Execute (F5)
--
-- واش كيدير: أي INSERT/UPDATE/DELETE فجدول products كيطلق pg_notify
-- فالقناة d1_sync_channel بالحمولة {"op":"INSERT|UPDATE|DELETE","id":N}
-- — وscripts/realtime-d1-watcher.mjs (PM2) كيسمعها وكيرسل الصف للـ edge:
--   POST https://laclarc.com/api/admin/d1-realtime-sync → D1 + purge الكاش
--
-- ⚠️ الجري مرتين آمن (idempotent): CREATE OR REPLACE + DROP TRIGGER IF EXISTS
-- ═══════════════════════════════════════════════════════════════════

-- 1) الدالة — كترجع payload JSON صغير ({op,id}) — الصف كيتبنى عند الـ watcher
CREATE OR REPLACE FUNCTION d1_sync_notify() RETURNS trigger AS $$
DECLARE
    payload text;
BEGIN
    IF TG_OP = 'DELETE' THEN
        payload := json_build_object('op', 'DELETE', 'id', OLD.id)::text;
    ELSE
        payload := json_build_object('op', TG_OP, 'id', NEW.id)::text;
    END IF;
    PERFORM pg_notify('d1_sync_channel', payload);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2) الـ trigger على products (بعد الكتابة — AFTER باش ما نعطلوش الtransaction)
DROP TRIGGER IF EXISTS trg_products_d1_sync ON products;
CREATE TRIGGER trg_products_d1_sync
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION d1_sync_notify();

-- ═══════════════════════════════════════════════════════════════════
-- 3) التحقق — جريهم من بعد الفعال:
-- ═══════════════════════════════════════════════════════════════════

-- أ) الـ trigger معمّر؟ (متوقع: trg_products_d1_sync)
-- SELECT tgname FROM pg_trigger WHERE tgrelid = 'products'::regclass AND NOT tgisinternal;

-- ب) تجربة حية صف واحد — من بعد جري هاد السطر، سجل الـ watcher خاصو يوريك:
--    [watcher] UPSERT <id> ok
-- UPDATE products SET stock_status = stock_status
-- WHERE id = (SELECT id FROM products ORDER BY id LIMIT 1);

-- ج) وقت اللي مزلت ما تفعّلش binding DB فالإنتاج، الـ watcher كيوريك:
--    [watcher] فشل UPSERT <id> (HTTP_503 ولا D1_NOT_BOUND_503) — عادي،
--    كيقاوم 3 محاولات من بعد كيعاود PM2 يقلّعو — يولي يخدم منين الـ deploy يوصل.

-- ═══════════════════════════════════════════════════════════════════
-- ملاحظات على الدور:
-- · كل كتابة وحدة = notification وحدة = POST وحدة للـ endpoint (sub-second).
-- · massSync.js bulk (آلاف الصفوف): كيعمرو backlog فالـ watcher — إلا كنت
--   كتsyncي آلاف، أسرع: فسخ الجري البدئي وجري scripts/push-local-to-d1.mjs
--   (كيفضي الكل upsert) — نفس النتيجة أسرع.
-- · الرجوع للخلف (rollback) — بلا ما تحيد الـ triggers، الـ watcher وقف:
--   pm2 delete laclarc-d1-watcher  (والإنتاج يبقى كيف هو حتى تعاود)
-- · حيد الـ triggers نهائياً إلا حبيت:
--   DROP TRIGGER IF EXISTS trg_products_d1_sync ON products;
--   DROP FUNCTION IF EXISTS d1_sync_notify();
-- ═══════════════════════════════════════════════════════════════════
