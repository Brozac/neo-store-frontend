'use client';

// ═══════════════════════════════════════════════════════════════════════
// app/components/FilterSortDrawer.tsx — F#59-drawerv2
// ═══════════════════════════════════════════════════════════════════════
// دروار الفلترة والفرز — النمط متبني على كومبوننت الديمو الممتاز (draft/applied
// · focus trap · Escape · drag-to-dismiss · disabled للخيارات الخاوية) متبرج
// على واقع لكل لارك.
//
// 🆕 v2 — رفع التشابه مع الديمو المرجعي (المالك مرجع الديمو كامل):
//   · summary: كل قسم كيعرض الاختيار الحالي بجنب العنوان («Price — Under $10»)
//   · swatch: دواير اللون الحقيقية (خلفية CSS + ring عند الاختيار) ماشي كاشبوكسات
//   · tiles: المقاسات بلاطات (grid) كيما الديمو — multi-select
//   · اللون ولّى multi-select (checkbox دواير) — السيرفر كيتوصل قائمة مفصولة
//     بفواصل وكيدير OR-chain (patch sizefacet-FROM-d4f24af)
//   · كل منيوكتات الـ a11y محفوظة: Tab محبوس، التركيز كيرجع للزر اللي فتح،
//     role-less fieldset/legend، motion-reduce، sr-only، disabled خاوي ما كيتشافش
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import GlassIcon from '@/components/ui/GlassIcon';

export interface DrawerOption {
  value: string;
  label: string;
  /** عداد ظاهر على اليمين — null/undefined = بلا عداد */
  count?: number | null;
  /** معطل — اختيار كيرجع صفر نتائج (الديمو: ما كتخليش الزبون يحبس راسو في خاوي) */
  disabled?: boolean;
  /** 🆕 v2 خلفية دايرة اللون (hex ولا CSS gradient) — type='swatch' برك */
  swatch?: string;
}

export interface DrawerSection {
  key: string;
  title: string;
  /** radio = دايرة وحيدة · checkbox = قائمة متعددة · swatch = دواير لون متعددة
   *  · tiles = بلاطات متعددة (نمط الديمو للمقاسات) */
  type: 'radio' | 'checkbox' | 'swatch' | 'tiles';
  options: DrawerOption[];
  /** الاختيار الحالي في المسودة (values) */
  selected: string[];
  onToggle: (value: string) => void;
  /** مطوي عند الفتح — default: مكشوف */
  defaultFolded?: boolean;
  /** 🆕 v2 — الاختيار الحالي كيتعرض بجنب العنوان (نمط الديمو: «Price — £75 to £150») */
  summary?: string;
}

interface FilterSortDrawerProps {
  open: boolean;
  /** dismiss — المسودة كتنسى (كيترجع كيما كانت مطبقة) */
  onClose: () => void;
  sections: DrawerSection[];
  /** مسح الكل داخل المسودة */
  onReset: () => void;
  /** تطبيق المسودة والغلق */
  onApply: () => void;
  /** رقم النتائج المطابقة للمسودة — null = ما معلومش (refetch سيرفر في الطريق) */
  matchCount: number | null;
  /** زر «Filter and sort» اللي فتح الدروار — التركيز كيرجع له عند الغلق */
  openerRef: React.RefObject<HTMLButtonElement | null>;
}

const PANEL_ID = 'pf-drawer-panel';

export default function FilterSortDrawer({
  open,
  onClose,
  sections,
  onReset,
  onApply,
  matchCount,
  openerRef,
}: FilterSortDrawerProps) {
  // المطوية — تجاوزات يدوية فقط: defaultFolded كيحترم حتى إلا القسم جا متأخر
  // (فاسيت الفئة كيجي بعد ما الجذور يجيبو من السيرفر — ما كتنحبسش مفتوحة)
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const expandedOf = (key: string, defaultFolded?: boolean) => manual[key] ?? !defaultFolded;
  const fold = (key: string, defaultFolded?: boolean) =>
    setManual((prev) => ({ ...prev, [key]: !(prev[key] ?? !defaultFolded) }));

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const mountedRef = useRef(false);

  // ═══ المودال: حبس التركيز + Escape + قفل سكرول الصفحة + رجوع التركيز ═══
  useEffect(() => {
    document.documentElement.classList.toggle('overflow-hidden', open);
    if (mountedRef.current) {
      if (open) closeRef.current?.focus();
      else openerRef.current?.focus();
    }
    mountedRef.current = true;
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      } else if (event.key === 'Tab' && panelRef.current) {
        const all = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>('a[href], button, input')
        ).filter((el) => {
          if (el.hasAttribute('disabled')) return false;
          if (el.getClientRects().length === 0) return false;
          // الراديو غير المفعّل (hidden sibling الحل) ما كيدخلش في الدورة
          if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) return false;
          return true;
        });
        if (all.length === 0) return;
        const first = all[0];
        const last = all[all.length - 1];
        if (!panelRef.current.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('overflow-hidden');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ═══ الموبايل: الشيت كيمشي مع السحب وكيسد إلا تجبد تحت 80px ═══
  const dragFrom = useRef<number | null>(null);
  const onGrabDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragFrom.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (panelRef.current) panelRef.current.style.transition = 'none';
  };
  const onGrabMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragFrom.current === null || !panelRef.current) return;
    panelRef.current.style.setProperty('translate', `0 ${Math.max(0, event.clientY - dragFrom.current)}px`);
  };
  const onGrabUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragFrom.current === null) return;
    const pulled = event.clientY - dragFrom.current;
    dragFrom.current = null;
    if (panelRef.current) {
      panelRef.current.style.transition = '';
      panelRef.current.style.removeProperty('translate');
    }
    if (pulled > 80) onClose();
  };

  return (
    <div id="pf-drawer" className="group">
      <div id="pf-drawer-overlay" hidden={!open} className="fixed inset-0 z-50">
        <div
          id="pf-drawer-scrim"
          onClick={onClose}
          className="absolute inset-0 bg-[#2E4057]/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out motion-reduce:transition-none"
        />
        <div
          ref={panelRef}
          id={PANEL_ID}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pf-drawer-panel-title"
          className="absolute flex flex-col bg-white shadow-2xl ring-1 ring-black/10 transition-[translate] duration-300 ease-out motion-reduce:transition-none max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:rounded-t-2xl sm:inset-y-0 sm:right-0 sm:w-full sm:max-w-md"
        >
          {/* مقبض السحب (موبايل) */}
          <div
            onPointerDown={onGrabDown}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabUp}
            onPointerCancel={onGrabUp}
            aria-hidden="true"
            className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-2 select-none active:cursor-grabbing sm:hidden"
          >
            <span className="h-1 w-10 rounded-full bg-gray-300" />
          </div>

          {/* الرأس */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 py-2 pr-3 pl-5 sm:h-16">
            <h2 id="pf-drawer-panel-title" className="text-base font-bold text-temu-black">
              Filter and sort
            </h2>
            <button
              ref={closeRef}
              type="button"
              id="pf-drawer-close"
              onClick={onClose}
              aria-label="Close filters"
              className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-temu-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] motion-reduce:transition-none"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {/* الأقسام */}
          <form
            onSubmit={(event) => event.preventDefault()}
            aria-label="Filter and sort"
            className="min-h-0 flex-1 divide-y divide-gray-200 overflow-y-auto overscroll-contain px-5"
          >
            {sections.map((section) => {
              const expanded = expandedOf(section.key, section.defaultFolded);
              const sectionId = `pf-drawer-${section.key}-group`;
              return (
                <div key={section.key}>
                  <h3 className="text-sm font-bold text-temu-black">
                    <button
                      type="button"
                      aria-expanded={expanded ? 'true' : 'false'}
                      aria-controls={sectionId}
                      onClick={() => fold(section.key, section.defaultFolded)}
                      className="group flex h-14 w-full cursor-pointer items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#5B7EA6]"
                    >
                      <span className="grow">{section.title}</span>
                      {section.summary && (
                        <span className="max-w-[10rem] truncate text-sm font-normal text-gray-500 sm:max-w-[14rem]">{section.summary}</span>
                      )}
                      <svg
                        className={`size-4 shrink-0 text-gray-500 transition-transform duration-150 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </h3>
                  <fieldset id={sectionId} hidden={!expanded} className="pt-1 pb-5">
                    <legend className="sr-only">{section.title}</legend>
                    {section.type === 'tiles' ? (
                      /* 🆕 v2 — بلاطات المقاسات (نمط الديمو) — multi-select */
                      <div className="grid grid-cols-4 gap-2">
                        {section.options.map((o) => {
                          const checked = section.selected.includes(o.value);
                          const inputId = `pf-drawer-${section.key}-${o.value || 'all'}`;
                          return (
                            <label
                              key={o.value}
                              htmlFor={inputId}
                              className="relative flex h-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-sm font-bold whitespace-nowrap text-temu-black shadow-xs transition-colors duration-150 select-none hover:bg-gray-50 has-checked:border-[#5B7EA6] has-checked:bg-[#5B7EA6] has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-[#5B7EA6] has-disabled:cursor-not-allowed has-disabled:text-gray-400 has-disabled:line-through has-disabled:opacity-60 has-disabled:shadow-none has-disabled:hover:bg-white motion-reduce:transition-none"
                            >
                              <input
                                id={inputId}
                                type="checkbox"
                                name={`pf-drawer-${section.key}`}
                                value={o.value}
                                checked={checked}
                                disabled={o.disabled}
                                onChange={() => section.onToggle(o.value)}
                                className="peer sr-only"
                              />
                              {o.label}
                            </label>
                          );
                        })}
                      </div>
                    ) : section.type === 'swatch' ? (
                      /* 🆕 v2 — دواير اللون الحقيقية (نمط الديمو) — multi-select */
                      <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                        {section.options.map((o) => {
                          const checked = section.selected.includes(o.value);
                          const inputId = `pf-drawer-${section.key}-${o.value || 'all'}`;
                          return (
                            <li key={o.value} className="flex items-center gap-3 text-sm has-[:disabled]:opacity-50">
                              <input
                                id={inputId}
                                type="checkbox"
                                name={`pf-drawer-${section.key}`}
                                value={o.value}
                                checked={checked}
                                disabled={o.disabled}
                                onChange={() => section.onToggle(o.value)}
                                aria-label={o.label}
                                style={o.swatch ? { background: o.swatch } : undefined}
                                className="size-5 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-200 ring-1 ring-black/10 ring-inset checked:ring-2 checked:ring-[#5B7EA6] checked:ring-offset-2 checked:ring-offset-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] disabled:cursor-not-allowed motion-reduce:transition-none"
                              />
                              <label htmlFor={inputId} className="grow cursor-pointer text-temu-black">
                                {o.label}
                              </label>
                              {o.count !== null && o.count !== undefined && (
                                <span className="text-xs text-gray-500 tabular-nums">{o.count.toLocaleString()}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <ul className={section.type === 'radio' ? 'space-y-2.5' : 'grid grid-cols-2 gap-x-6 gap-y-2.5'}>
                      {section.options.map((o) => {
                        const checked = section.selected.includes(o.value);
                        const inputId = `pf-drawer-${section.key}-${o.value || 'all'}`;
                        return (
                          <li key={o.value} className="flex items-center gap-3 text-sm has-[:disabled]:opacity-50">
                            {section.type === 'radio' ? (
                              <input
                                id={inputId}
                                type="radio"
                                name={`pf-drawer-${section.key}`}
                                value={o.value}
                                checked={checked}
                                disabled={o.disabled}
                                onChange={() => section.onToggle(o.value)}
                                className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-gray-400 bg-white checked:border-[5px] checked:border-[#5B7EA6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] disabled:cursor-not-allowed disabled:bg-gray-100"
                              />
                            ) : (
                              <div className="group grid size-4 shrink-0 grid-cols-1">
                                <input
                                  id={inputId}
                                  type="checkbox"
                                  name={`pf-drawer-${section.key}`}
                                  value={o.value}
                                  checked={checked}
                                  disabled={o.disabled}
                                  onChange={() => section.onToggle(o.value)}
                                  className="col-start-1 row-start-1 cursor-pointer appearance-none rounded-sm border border-gray-400 bg-white checked:border-[#5B7EA6] checked:bg-[#5B7EA6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] disabled:cursor-not-allowed disabled:bg-gray-100"
                                />
                                <svg className="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white opacity-0 group-has-checked:opacity-100" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                                  <path d="M3 8L6 11L11 3.5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            )}
                            <label htmlFor={inputId} className="grow cursor-pointer text-temu-black">
                              {o.label}
                            </label>
                            {o.count !== null && o.count !== undefined && (
                              <span className="text-xs text-gray-500 tabular-nums">{o.count.toLocaleString()}</span>
                            )}
                          </li>
                        );
                      })}
                      </ul>
                    )}
                  </fieldset>
                </div>
              );
            })}
            <p className="py-3 text-[11px] leading-relaxed text-gray-400">
              Counts reflect products loaded so far in this session — scroll to load more.
            </p>
          </form>

          {/* الرجل: مسح + تطبيق */}
          <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-3 border-t border-gray-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 text-sm font-bold whitespace-nowrap text-temu-black transition-colors duration-150 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] active:translate-y-px motion-reduce:transition-none"
            >
              Clear all
            </button>
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#5B7EA6] px-4 text-sm font-bold whitespace-nowrap text-white shadow-xs transition-colors duration-150 hover:bg-[#46648A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B7EA6] active:translate-y-px motion-reduce:transition-none"
            >
              <GlassIcon i="check" size="xs" />
              <span>
                {matchCount === null
                  ? 'Show results'
                  : `Show ${matchCount.toLocaleString()} ${matchCount === 1 ? 'match' : 'matches'}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
