import postgres from 'postgres';

export default {
  async fetch(req, env, ctx) {
    const cs = env.RW_DATABASE_URL;
    const out = {};
    const opts = { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 };

    // A) النمط الحالي فـ pb-db.ts — end() مسجل فـ waitUntil (كيبدا فوراً)
    {
      const t0 = Date.now();
      try {
        const sql = postgres(cs, opts);
        ctx.waitUntil(sql.end({ timeout: 5 }).catch(() => {}));
        const rows = await sql.unsafe('SELECT current_user, 1 as one');
        out.eager_end = { ok: true, rows, ms: Date.now() - t0 };
      } catch (e) {
        out.eager_end = { ok: false, err: String((e && e.message) || e), code: e && e.code, ms: Date.now() - t0 };
      }
    }
    // B) بلا end نهائياً — idle_timeout كيسد وحدو
    {
      const t0 = Date.now();
      try {
        const sql = postgres(cs, { ...opts, idle_timeout: 5 });
        const rows = await sql.unsafe('SELECT current_user, 2 as two');
        out.no_end = { ok: true, rows, ms: Date.now() - t0 };
      } catch (e) {
        out.no_end = { ok: false, err: String((e && e.message) || e), code: e && e.code, ms: Date.now() - t0 };
      }
    }
    // C) end() متأخر — setTimeout داخل waitUntil (5s)
    {
      const t0 = Date.now();
      try {
        const sql = postgres(cs, opts);
        ctx.waitUntil(new Promise((res) => setTimeout(() => { sql.end({ timeout: 3 }).catch(() => {}); res(); }, 5000)));
        const rows = await sql.unsafe('SELECT current_user, 3 as three');
        out.deferred_end = { ok: true, rows, ms: Date.now() - t0 };
      } catch (e) {
        out.deferred_end = { ok: false, err: String((e && e.message) || e), code: e && e.code, ms: Date.now() - t0 };
      }
    }
    return Response.json(out);
  },
};
