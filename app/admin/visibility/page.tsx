'use client';

/**
 * ═══════════════════════════════════════════════════════════════════
 * 👁️ LACLARC VISIBILITY CONTROL — التحكم في الظهور (F#93 · OpCenter)
 * ═══════════════════════════════════════════════════════════════════
 * ثلاث مجموعات تحكم من مكان واحد:
 *   1. 🏠 أقسام الصفحة الرئيسية — 5 مفاتيح فورية (Hero · Rail · Deals · Reels · Trending)
 *   2. 🗂️ أقسام المنتوجات (categories) — الشجرة الحية من GET /api/categories:
 *      إخفاء قسم = يختفي من الشريط/الدليل + منتجاته كيتصفوا من كل الخلاصات
 *   3. 🌿 فروع الموقع (الصفحات) — 16 فرع: من القوائم + الصفحة كتولي
 *      "غير متاح مؤقتاً" للزوار
 *
 * الحفظ: PUT /api/site-config (نفس الدومين) — الجلسة كيتحقق منها الباك الحي.
 * التخزين: bindings تاع الـ Worker (KV/R2 الموجودين) — صفر endpoint باك جديد.
 *
 * مبادئ:
 *   · كل التغييرات محلية حتى "Save & Publish" — مفيش ونص حفظ بالصدفة
 *   · الرد كيعرض الحقيقة: storage + edgePurged + revalidated (لا أخضر زائف)
 *   · الفروع الخطرة (صفحات المنتوجات) كتطلب تأكيد صريح
 *   · Reels مزدوج: كيتزامن مع مفتاح الباك show_reels (best-effort + تقرير)
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import adminApi from '../../utils/adminApi';
import AdminShell from '../_shell/AdminShell';
import {
  SECTION_META, BRANCHES,
  DEFAULT_CONFIG, sanitizeConfig,
  type SiteVisibilityConfig, type BranchId, type HomeSectionsConfig,
} from '@/lib/siteConfig';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com';

interface CatNode {
  id: number;
  name: string;
  slug: string;
  slugPath: string;
  image_url?: string | null;
  children?: CatNode[];
}

function flattenCats(nodes: CatNode[], prefix = '', depth = 0): { name: string; slugPath: string; depth: number; image_url?: string | null }[] {
  const out: { name: string; slugPath: string; depth: number; image_url?: string | null }[] = [];
  for (const n of nodes || []) {
    const slugPath = prefix ? `${prefix}/${n.slug}` : n.slug;
    out.push({ name: n.name || n.slug, slugPath, depth, image_url: n.image_url ?? null });
    if (n.children?.length) out.push(...flattenCats(n.children, slugPath, depth + 1));
  }
  return out;
}

export default function VisibilityControlPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cfg, setCfg] = useState<SiteVisibilityConfig | null>(null);   // المحفوظة الحية
  const [draft, setDraft] = useState<SiteVisibilityConfig | null>(null); // الشغل المحلي
  const [source, setSource] = useState<string>('—');

  // الأقسام الحية من الباك
  const [cats, setCats] = useState<{ name: string; slugPath: string; depth: number; image_url?: string | null }[] | null>(null);
  const [catsError, setCatsError] = useState(false);
  const [catQuery, setCatQuery] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDanger, setConfirmDanger] = useState(false); // فرع products مخفي في الدفت؟

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setMessage('');
    try {
      const res = await fetch('/api/site-config', { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      const parsed = sanitizeConfig(json?.config) ?? { ...DEFAULT_CONFIG };
      setCfg(parsed);
      setDraft(parsed);
      setSource(String(json?.source ?? '—'));
    } catch {
      setLoadError('Could not reach /api/site-config — visibility state UNKNOWN (nothing is changed).');
      setCfg({ ...DEFAULT_CONFIG });
      setDraft({ ...DEFAULT_CONFIG });
    } finally {
      setLoading(false);
    }

    // شجرة الأقسام — public endpoint (نفس مصدر manage)
    try {
      const res = await adminApi.get('/categories');
      const flat = flattenCats(Array.isArray(res.data) ? res.data : []);
      setCats(flat);
      setCatsError(false);
    } catch (err: any) {
      if (err.response?.status === 401 || err.response?.status === 403) { router.push('/admin/login'); return; }
      setCatsError(true);
    }
  }, [router]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const dirty = useMemo(() => cfg && draft && JSON.stringify(cfg) !== JSON.stringify(draft), [cfg, draft]);
  const hiddenCount = draft?.hiddenCategories.length ?? 0;
  const hiddenBranchCount = draft ? BRANCHES.filter(b => draft.branches[b.id] === false).length : 0;
  const hiddenSectionCount = draft ? SECTION_META.filter(s => draft.sections[s.key] === false).length : 0;
  const productsHidden = draft?.branches['products'] === false;

  const toggleSection = (key: keyof HomeSectionsConfig) => {
    if (!draft) return;
    setMessage('');
    setDraft({ ...draft, sections: { ...draft.sections, [key]: !draft.sections[key] } });
  };

  const toggleBranch = (id: BranchId) => {
    if (!draft) return;
    setMessage('');
    setDraft({ ...draft, branches: { ...draft.branches, [id]: !draft.branches[id] } });
  };

  const toggleCat = (slugPath: string) => {
    if (!draft) return;
    setMessage('');
    const set = new Set(draft.hiddenCategories);
    if (set.has(slugPath)) set.delete(slugPath);
    else {
      // ولّي ناسك: بنحيّد الأبادر ديالو (l1, l1/l2...) — slugPath الكامل هو الحاكم
      set.add(slugPath);
    }
    setDraft({ ...draft, hiddenCategories: [...set].sort() });
  };

  const catIsHidden = (slugPath: string) => draft?.hiddenCategories.includes(slugPath) ?? false;

  const filteredCats = useMemo(() => {
    if (!cats) return null;
    const q = catQuery.trim().toLowerCase();
    if (!q) return cats.filter(c => c.depth <= 1); // الافتراضي: جذور + أبناء مباشرين
    return cats.filter(c => c.slugPath.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [cats, catQuery]);

  const save = async () => {
    if (!draft || !cfg) return;
    if (productsHidden && !confirmDanger) {
      setConfirmDanger(true);
      setMessage('⚠️ Product detail pages are hidden in this draft — customers cannot buy anything. Press Save again to confirm, or re-enable /products.');
      return;
    }
    setConfirmDanger(false);
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/site-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ config: draft }),
      });
      const json = await res.json().catch(() => null);

      if (res.status === 401) { router.push('/admin/login'); return; }
      if (!res.ok || !json?.ok) {
        setMessage(`❌ Save failed: ${json?.error || `HTTP ${res.status}`} — nothing was written.`);
        return;
      }

      // الحقيقة المعروضة = رد السيرفر حرفياً
      setCfg(sanitizeConfig(json.config) ?? draft);
      setDraft(sanitizeConfig(json.config) ?? draft);
      const storage = json.storage === 'devfile' ? 'dev file (local preview only)' : json.storage === 'kv' ? 'Workers KV' : json.storage === 'r2' ? 'R2 bucket' : String(json.storage);
      const parts = [
        `✅ Published — storage: ${storage}`,
        `edge cache ${json.edgePurged ? 'purged ✓' : 'purge unavailable (fine — TTL 60s)'}`,
        `ISR revalidated: ${(json.revalidated || []).length ? (json.revalidated as string[]).join(', ') : 'none'}`,
      ];
      if ((json.revalidateFailed || []).length) parts.push(`⚠️ failed: ${(json.revalidateFailed as string[]).join(', ')}`);
      setMessage(parts.join(' · '));

      // 🎬 Reels — مزامنة مفتاح الباك show_reels (best-effort، التقرير صادق)
      const prevReels = cfg.sections.reels;
      const nextReels = draft.sections.reels;
      if (prevReels !== nextReels) {
        try {
          await adminApi.put('/admin/settings/show_reels', { value: nextReels });
          setMessage((m) => `${m} · show_reels backend key synced to ${nextReels ? 'SHOWN' : 'HIDDEN'} ✓`);
        } catch {
          setMessage((m) => `${m} · ⚠️ backend show_reels sync failed (homepage uses BOTH keys)`);
        }
      }
    } catch {
      setMessage('❌ Save failed: network error — nothing was written.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    if (!cfg) return;
    setDraft(cfg);
    setMessage('↩︎ Draft discarded — live config restored.');
    setConfirmDanger(false);
  };

  const showAll = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      sections: { hero: true, categoriesRail: true, deals: true, reels: true, trending: true },
      hiddenCategories: [],
      branches: Object.fromEntries(BRANCHES.map(b => [b.id, true])) as Record<BranchId, boolean>,
    });
    setMessage('Draft reset — everything visible. Press Save & Publish to apply.');
    setConfirmDanger(false);
  };

  // ─── Toggle switch UI ───
  const Toggle = ({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`w-12 h-6.5 rounded-full transition-colors relative cursor-pointer shrink-0 disabled:opacity-40 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 left-1 w-4.5 h-4.5 bg-white rounded-full shadow-md transition-transform duration-200 ${on ? 'translate-x-5.5' : 'translate-x-0'}`} />
    </button>
  );

  return (
    <AdminShell
      title="Visibility Control — التحكم في الظهور"
      subtitle="Hide any homepage section, product category or site branch — live for every visitor"
    >
      <div className="max-w-4xl mx-auto space-y-6 pb-24">

        {/* شريط الحالة */}
        <div className="bg-white rounded-2xl p-5 border border-temu-gray-border-light shadow-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs">
            <p className="font-black text-temu-black">👁️ Storefront visibility</p>
            <p className="text-gray-500 mt-0.5">
              Live source: <span className="font-mono">{source}</span>
              {cfg?.updatedAt && <> · last publish <span className="font-mono">{cfg.updatedAt.slice(0, 19).replace('T', ' ')} UTC</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-3 py-2 rounded-xl border border-temu-gray-border-light transition cursor-pointer">↻ Reload</button>
            <button onClick={showAll} className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-3 py-2 rounded-xl border border-temu-gray-border-light transition cursor-pointer">✨ Show everything (draft)</button>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-xs font-bold border break-words ${
            message.includes('❌') ? 'bg-red-50 border-red-200 text-red-500'
              : message.includes('⚠️') ? 'bg-amber-50 border-amber-200 text-amber-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-600'
          }`}>
            {message}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-temu-gray-border-light p-12 flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#5F8271] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-gray-500">Loading visibility config…</p>
          </div>
        ) : loadError ? (
          <div className="bg-white rounded-2xl border border-red-200 p-8 space-y-2">
            <p className="text-sm font-black text-red-500">⚠️ {loadError}</p>
            <button onClick={loadAll} className="bg-temu-black hover:bg-temu-dark text-white text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer">↻ Retry</button>
          </div>
        ) : (
          draft && (
            <>
              {/* ═══ 1. أقسام الصفحة الرئيسية ═══ */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
                <h2 className="text-base font-black text-temu-black mb-1">🏠 Homepage sections</h2>
                <p className="text-xs text-gray-500 mb-5">
                  Instant switches for laclarc.com homepage blocks. Hidden = every visitor stops seeing it (products are NOT affected).
                </p>
                <div className="space-y-2.5">
                  {SECTION_META.map(s => {
                    const on = draft.sections[s.key] !== false;
                    return (
                      <div key={s.key} className="bg-temu-offwhite p-4 rounded-2xl border border-temu-gray-border-light flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-temu-black">{s.icon} {s.label} <span className="text-gray-400 font-bold">· {s.ar}</span></h4>
                          <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                          <p className={`text-[11px] font-black mt-1 ${on ? 'text-emerald-600' : 'text-[#C86F4E]'}`}>
                            {on ? 'SHOWN ✓' : 'HIDDEN ✕'}
                          </p>
                        </div>
                        <Toggle on={on} onClick={() => toggleSection(s.key)} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══ 2. أقسام المنتوجات ═══ */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <h2 className="text-base font-black text-temu-black">🗂️ Product categories — الأقسام</h2>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${hiddenCount ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                    {hiddenCount} hidden
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Live tree from the backend. Hiding a category removes it from the homepage rail &amp; the /categories hub, filters its products out of every feed, and blocks its /category/… page. Children follow the parent.
                </p>

                <input
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder="Search categories — name or slug path (e.g. chargers)…"
                  className="w-full bg-temu-offwhite border border-temu-gray-border-light rounded-xl px-4 py-2.5 text-xs font-bold text-temu-black focus:outline-none focus:border-[#5F8271] mb-3"
                />

                {catsError ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-xl text-xs font-bold">
                    ⚠️ Categories tree failed to load — category visibility is NOT editable right now (sections &amp; branches still work).
                  </div>
                ) : !cats ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-bold p-4">
                    <div className="w-4 h-4 border-2 border-[#5F8271] border-t-transparent rounded-full animate-spin" /> Loading categories…
                  </div>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto rounded-xl border border-temu-gray-border-light divide-y divide-temu-gray-border-light/60">
                    {filteredCats!.map(c => {
                      const hidden = catIsHidden(c.slugPath);
                      return (
                        <div key={c.slugPath} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-temu-offwhite/60" style={{ paddingLeft: `${12 + c.depth * 22}px` }}>
                          <div className="flex items-center gap-2.5 min-w-0">
                            {c.depth === 0 && c.image_url
                              ? <img src={c.image_url} alt="" className="w-6 h-6 rounded-lg object-cover bg-white shrink-0" loading="lazy" />
                              : <span className="w-6 text-center text-[10px] text-gray-300 shrink-0">{c.depth === 0 ? '📂' : '↳'}</span>}
                            <div className="min-w-0">
                              <p className={`text-xs font-bold truncate ${hidden ? 'text-red-400 line-through' : 'text-temu-black'}`}>{c.name}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate">{c.slugPath}</p>
                            </div>
                          </div>
                          <Toggle on={!hidden} onClick={() => toggleCat(c.slugPath)} />
                        </div>
                      );
                    })}
                    {filteredCats!.length === 0 && (
                      <p className="text-xs text-gray-400 text-center p-6">No category matches “{catQuery}”.</p>
                    )}
                  </div>
                )}
                {!catQuery && cats && cats.length > 2 && (
                  <p className="text-[10px] text-gray-400 mt-2">Showing roots + direct children ({filteredCats!.length}). Type in the search box to reach any of the deep sub-categories.</p>
                )}
              </div>

              {/* ═══ 3. فروع الموقع ═══ */}
              <div className="bg-white rounded-2xl p-6 sm:p-8 border border-temu-gray-border-light shadow-xs">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                  <h2 className="text-base font-black text-temu-black">🌿 Site branches — الفروع</h2>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full ${hiddenBranchCount ? 'bg-red-50 text-red-500 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
                    {hiddenBranchCount} hidden
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Hidden = removed from navbar/footer/dock menus AND the page itself shows “Temporarily unavailable” to visitors. Cart, checkout, success/cancel and auth are protected and can never be hidden.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BRANCHES.map(br => {
                    const on = draft.branches[br.id] !== false;
                    return (
                      <div key={br.id} className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${on ? 'bg-temu-offwhite border-temu-gray-border-light' : 'bg-red-50/60 border-red-200'}`}>
                        <div className="min-w-0">
                          <h4 className={`font-black text-xs truncate ${on ? 'text-temu-black' : 'text-red-500'}`}>
                            {br.label} <span className="text-gray-400">· {br.ar}</span>
                            {br.dangerous && <span className="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black">DANGER</span>}
                          </h4>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{br.path}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{br.desc}</p>
                        </div>
                        <Toggle on={on} onClick={() => toggleBranch(br.id)} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ═══ شريط الحفظ ═══ */}
              <div className={`sticky bottom-4 z-20 rounded-2xl border p-4 shadow-lg flex items-center justify-between gap-3 flex-wrap ${
                dirty ? 'bg-white border-[#5F8271]/40' : 'bg-white/90 border-temu-gray-border-light'
              }`}>
                <p className="text-xs font-bold text-temu-black">
                  {dirty ? (
                    <>📝 Unsaved draft — {hiddenSectionCount} section(s) · {hiddenCount} categorie(s) · {hiddenBranchCount} branch(es) hidden</>
                  ) : productsHidden ? (
                    <>⚠️ Live config is hiding product pages — customers cannot buy. Re-enable /products as soon as possible.</>
                  ) : (
                    <>✅ Draft matches the live config</>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={discard}
                    disabled={!dirty || saving}
                    className="text-xs bg-temu-offwhite hover:bg-gray-100 text-temu-black px-4 py-2.5 rounded-xl border border-temu-gray-border-light font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Discard
                  </button>
                  <button
                    onClick={save}
                    disabled={!dirty || saving}
                    className={`text-xs text-white px-5 py-2.5 rounded-xl font-black transition cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                      productsHidden && dirty ? 'bg-red-500 hover:bg-red-600' : 'bg-[#5F8271] hover:bg-[#4E6F60]'
                    }`}
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Publishing…
                      </span>
                    ) : (
                      <>Save &amp; Publish {productsHidden && dirty ? '⚠️' : ''}</>
                    )}
                  </button>
                </div>
              </div>
            </>
          )
        )}
      </div>
    </AdminShell>
  );
}
