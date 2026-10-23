// components/FlyToCart.tsx — ✨ FLY_TO_CART_V1
// ─────────────────────────────────────────────────────────────────
// حركة "الشارة تطير للدوك": ملي الزبون يضيف منتج للسلة، فقاعة صغيرة
// بصورة المنتج تطلع من نقطة الضغط وتطير بقوس حتى أيقونة السلة فـ GlassDock.
// كي توصل: حلقة burst + اهتزاز الأيقونة + pop للشارة.
//
// كيفاش تخدم:
//   1. CartContext.addToCart كيبثّ حدث 'laclarc:added-to-cart'
//      (detail: { image }) — نقطة عبور وحيدة لكل أزرار الإضافة فالموقع.
//   2. هاد المكوّن كيسمع على الحدث وكيدير الأنيميشن (DOM حتمي، بلا state).
//   3. مصدر الانطلاق = آخر نقطة pointerdown (الزر اللي ضغط عليه الزبون)
//      → تخدم تلقائياً مع كل صفحات الإضافة (PDP / FBT / SpinWheel / Quick-add).
//   4. كيحترم prefers-reduced-motion + كيتعامل مع غياب الدوك بأمان.
// ─────────────────────────────────────────────────────────────────
'use client';

import { useEffect } from 'react';

type FlyDetail = { image?: string };

// آخر نقطة ضغط — متغير وحدة (ماشي state) باش ما نسببوش re-render
let lastTap: { x: number; y: number; has: boolean } = { x: 0, y: 0, has: false };

export default function FlyToCart() {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      lastTap = { x: e.clientX, y: e.clientY, has: true };
    };
    document.addEventListener('pointerdown', onPointerDown, {
      capture: true,
      passive: true,
    });

    const onAdded = (e: Event) => {
      const detail = (e as CustomEvent<FlyDetail>).detail || {};
      flyToDock(detail.image);
    };
    window.addEventListener('laclarc:added-to-cart', onAdded);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, {
        capture: true,
      });
      window.removeEventListener('laclarc:added-to-cart', onAdded);
    };
  }, []);

  // المكوّن ما كيرسم والو — غير مستمعو الأحداث + ستايلات الحركة
  return (
    <style jsx global>{`
      /* فقاعة الطيران — صورة المنتج الم مصغرة */
      .laclarc-fly-bubble {
        position: fixed;
        z-index: 9999;
        width: 48px;
        height: 48px;
        border-radius: 14px;
        overflow: hidden;
        pointer-events: none;
        background: #fff;
        box-shadow: 0 12px 30px rgba(23, 23, 26, 0.28), 0 0 0 2px #fff;
        will-change: transform, opacity;
      }
      .laclarc-fly-bubble img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .laclarc-fly-bubble.no-img::after {
        content: '🛍️';
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        font-size: 22px;
      }

      /* حلقة الانفجار عند الهبوط */
      .laclarc-fly-burst {
        position: fixed;
        z-index: 9998;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 2.5px solid var(--color-fog-500, #6b3db4);
        pointer-events: none;
        animation: laclarcBurst 0.55s ease-out forwards;
      }
      @keyframes laclarcBurst {
        0% {
          transform: scale(0.35);
          opacity: 0.95;
        }
        100% {
          transform: scale(2);
          opacity: 0;
        }
      }

      /* اهتزاز أيقونة الدوك عند استقبال المنتج */
      .laclarc-dock-land {
        display: inline-flex;
        animation: laclarcDockLand 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes laclarcDockLand {
        0% {
          transform: scale(1);
        }
        35% {
          transform: scale(1.32) rotate(-6deg);
        }
        70% {
          transform: scale(0.9);
        }
        100% {
          transform: scale(1);
        }
      }

      /* نبضة شارة السلة */
      .laclarc-badge-pop {
        animation: laclarcBadgePop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes laclarcBadgePop {
        0% {
          transform: scale(1);
        }
        40% {
          transform: scale(1.55);
        }
        100% {
          transform: scale(1);
        }
      }
    `}</style>
  );
}

/* ── أدوات الاستهداف ── */

function getDockTargets() {
  const link = document.querySelector<HTMLAnchorElement>(
    'a.gdock-item[href="/cart"]'
  );
  if (!link) return null;
  const glyph = link.querySelector<HTMLElement>('.gdock-glyph');
  const badge = link.querySelector<HTMLElement>('[data-cart-badge]');
  return { link, glyph: glyph ?? null, badge: badge ?? null };
}

function popBadge(badge: HTMLElement | null) {
  if (!badge) return;
  badge.classList.remove('laclarc-badge-pop');
  void badge.offsetWidth; // reflow باش الأنيميشن يعاود يطلق
  badge.classList.add('laclarc-badge-pop');
  window.setTimeout(() => badge.classList.remove('laclarc-badge-pop'), 550);
}

function landEffects(
  burstAt: HTMLElement | null,
  glyph: HTMLElement | null,
  badge: HTMLElement | null
) {
  if (burstAt) {
    const rect = burstAt.getBoundingClientRect();
    const ring = document.createElement('span');
    ring.className = 'laclarc-fly-burst';
    ring.style.left = `${rect.left + rect.width / 2 - 19}px`;
    ring.style.top = `${rect.top + rect.height / 2 - 19}px`;
    document.body.appendChild(ring);
    window.setTimeout(() => ring.remove(), 650);
  }
  if (glyph) {
    glyph.classList.remove('laclarc-dock-land');
    void glyph.offsetWidth;
    glyph.classList.add('laclarc-dock-land');
    window.setTimeout(() => glyph.classList.remove('laclarc-dock-land'), 600);
  }
  popBadge(badge);
}

/* ── الطيران نفسه ── */

function flyToDock(imageUrl?: string) {
  const targets = getDockTargets();
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // بلا دوك ولا المستخدم كيطلب تقليل الحركة → غير الهبوط (الشارة + الاهتزاز)
  if (!targets || reduced) {
    landEffects(null, targets?.glyph ?? null, targets?.badge ?? null);
    return;
  }

  const glyphEl = targets.glyph ?? targets.link;
  const glyphRect = glyphEl.getBoundingClientRect();
  const startX = lastTap.has ? lastTap.x : glyphRect.left + glyphRect.width / 2;
  const startY = lastTap.has ? lastTap.y : glyphRect.top;
  const endX = glyphRect.left + glyphRect.width / 2;
  const endY = glyphRect.top + glyphRect.height / 2;

  const S = 48;
  const bubble = document.createElement('span');
  bubble.className = 'laclarc-fly-bubble';
  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = '';
    img.draggable = false;
    bubble.appendChild(img);
  } else {
    bubble.classList.add('no-img');
  }
  bubble.style.left = `${startX - S / 2}px`;
  bubble.style.top = `${startY - S / 2}px`;
  document.body.appendChild(bubble);

  const dx = endX - startX;
  const dy = endY - startY;
  const lift = Math.min(-80, dy * 0.4); // قوس للفوق قبل الهبوط

  const anim = bubble.animate(
    [
      {
        transform: 'translate(0, 0) scale(1) rotate(0deg)',
        opacity: '1',
      },
      {
        transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(0.86) rotate(9deg)`,
        opacity: '1',
        offset: 0.55,
      },
      {
        transform: `translate(${dx}px, ${dy}px) scale(0.28) rotate(0deg)`,
        opacity: '0.25',
      },
    ],
    { duration: 680, easing: 'cubic-bezier(.3,.7,.4,1)' }
  );

  let landed = false;
  const land = () => {
    if (landed) return;
    landed = true;
    bubble.remove();
    landEffects(glyphEl, targets.glyph, targets.badge);
  };
  anim.finished.then(land).catch(land);
  window.setTimeout(land, 900); // صمام أمان
}
