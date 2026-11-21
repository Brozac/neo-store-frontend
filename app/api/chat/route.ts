// POST /api/chat — Phase F (مرآة الأصلي): On-Site AI Sales Agent (Gemini)
// IDOR Defense: بيانات الطلب الحقيقية تُحقن بعد تطابق مزدوج (order + email) — phasef_chat_order_context
// 30 رسالة/10د/IP — الرفض بنفس لغة الزبون (نفس الردود الاحتياطية حرفياً)
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { pbSecret } from '@/lib/pb/pb-user';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';

export const dynamic = 'force-dynamic';

function detectLanguage(text: string): 'ar' | 'fr' | 'en' {
  const t = String(text || '').toLowerCase();
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  const arabiziMarkers = [
    'wach', 'wesh', 'kifash', 'kifach', 'kifch', '3lach', '3lah', 'bghit', 'nbghi',
    'chhal', 'ch7al', 'sahbi', 'khoya', 'khouya', 'bzaf', 'bzzaf', 'chouia',
    'daba', 'dyal', 'zaama', 'walah', 'smahli', 'fhamt', 'weldi', 'hadchi', 'mezyan',
    'mzyan', '3ndk', '3andek', '3lik', '3liya', 'ghadi', 'salam', 'nchoufo', '3tini',
  ];
  if (arabiziMarkers.some((w) => t.includes(w))) return 'ar';
  if (/[éèêàçùôîïû]/.test(t)) return 'fr';
  const frenchMarkers = [
    'livraison', 'commande', 'combien', 'merci', 'bonjour', 'salut', 'quand',
    'prix', 'acheter', 'payer', 'paiement', 'retour', 'remboursement', 'colis',
    'suivi', 'je veux', 'je voudrais', "c'est quoi", 'qu’est-ce', 'qu\'est-ce',
    'est-ce que', 'où est', 'ou est', 'votre', 'mon colis', 'ma commande',
  ];
  if (frenchMarkers.some((w) => t.includes(w))) return 'fr';
  return 'en';
}

// ✨ الردود الاحتياطية الثلاثية — بنفس اللغة ديال الزبون (نفس النص حرفياً)
const FALLBACK_REPLIES = {
  en: {
    limit: "You've reached the message limit for now. Please wait a few minutes, or reach us instantly on WhatsApp!",
    noAI: 'Welcome to Laclarc! We offer fast, insured worldwide shipping and multiple payment options including cards and BaridiMob. How can I help you today?',
    error: 'Thanks for reaching out to Laclarc! Our support team is always happy to help via the website or directly on WhatsApp!',
  },
  fr: {
    limit: 'Vous avez atteint la limite de messages pour le moment. Patientez quelques minutes, ou contactez-nous directement sur WhatsApp !',
    noAI: 'Bienvenue chez Laclarc ! Nous offrons une livraison rapide et assurée dans le monde entier, avec plusieurs moyens de paiement : carte bancaire et BaridiMob. Comment puis-je vous aider ?',
    error: 'Merci de nous avoir contactés chez Laclarc ! Notre équipe support est toujours là pour vous aider via le site ou directement sur WhatsApp !',
  },
  ar: {
    limit: 'وصلتي للحد ديال الرسائل حالياً. تسنى شي دقائق ولا تواصل معانا مباشرة عبر واتساب!',
    noAI: 'مرحبا بيك في Laclarc! عننا شحن سريع ومؤمن لجميع دول العالم و58 ولاية، والدفع بالبطاقة ولا بريدي موب. واش نقدر نعاونك؟',
    error: 'مرحبا بيك! يسعدنا تواصلك مع Laclarc. فريق الدعم ديالنا متاح ديما يعاونك عبر الموقع ولا مباشرة عبر واتساب!',
  },
};

const ON_SITE_AI_PROMPT = `
أنت "Laclarc AI"، المساعد الذكي والدعم الفني المباشر لمتجر "Laclarc" (laclarc.com).
مهمتك: مساعدة الزائر بلباقة ولطف، الإجابة على استفساراته باختصار ودقة، وتشجيعه على الشراء.

قواعد الرد:
1. الإيجاز: أجب باختصار (جملتين أو 3 جمل كحد أقصى) لتناسب شاشة الشات الصغيرة.
2. اللهجة: إذا سأل بالدارجة الجزائرية رد بدارجة لطيفة ومحترمة. إذا سأل بالفرنسية أو الإنجليزية رد بنفس لغته.
3. المتجر: شحن سريع ومؤمن لجميع دول العالم ولـ 58 ولاية جزائرية (7 إلى 14 يوم عمل).
4. الدفع: بطاقات بنكية عالمية (Stripe)، عملات رقمية (Crypto)، وللجزائر بريدي موب BaridiMob / CCP.
5. الإرجاع: ضمان 30 يوماً.
`;

interface ChatHistoryItem {
  sender?: unknown;
  text?: unknown;
}

export async function POST(request: Request) {
  let body: { message?: unknown; history?: unknown };
  try {
    body = (await request.json()) as { message?: unknown; history?: unknown };
  } catch {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  const message = typeof body.message === 'string' ? body.message : '';
  const lang = detectLanguage(message);

  // 🆕 Rate Limiter بلغة الزبون — نفس الرفض حرفياً
  if (!pbRateLimit(`chat:${pbClientIp(request)}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ reply: FALLBACK_REPLIES[lang].limit }, { status: 429 });
  }

  if (!message || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? (body.history as ChatHistoryItem[]) : [];
  const recentUserTexts = [
    message,
    ...history.filter((h) => h?.sender === 'user').map((h) => String(h.text || '')),
  ].join(' ');

  // 🛡️ IDOR Defense — تطابق مزدوج (order_id + customer_email) قبل حقن أي بيانات
  let orderContext = '';
  const orderMatch = recentUserTexts.match(/(?:#|order|طلب|commande)\s*[:#]?\s*(\d{1,8})/i);
  const emailMatch = recentUserTexts.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (orderMatch) {
    try {
      const orderId = orderMatch[1];
      if (!emailMatch) {
        orderContext = `\n[The customer asked about order #${orderId} but hasn't provided their email yet. Politely ask them to write the email address used in the order for verification, in the customer's language. Do NOT reveal any order information before verification.]`;
      } else {
        const sql = await getRwSql();
        if (sql) {
          const rows = await sql.unsafe('SELECT phasef_chat_order_context($1,$2) AS r', [
            orderId,
            emailMatch[0],
          ]);
          const v = rows[0]?.r as
            | { kind: string; status?: string; amount?: number; tracking?: string }
            | null
            | undefined;
          if (!v || v.kind === 'missing') {
            orderContext = `\n[No order found matching #${orderId}. Politely ask the customer to double-check the number, in the customer's language.]`;
          } else if (v.kind === 'verified') {
            orderContext = `\n[Verified real order data: Order #${orderId}, status: "${v.status}". Amount: $${v.amount}. Tracking: "${v.tracking}". Reassure the customer briefly, in the customer's language.]`;
          } else {
            orderContext = `\n[Security: ownership of order #${orderId} could not be verified with this email. Politely apologize and suggest using the "Track My Order" page on the website with the correct email, in the customer's language. Do NOT reveal any order details and do NOT confirm whether the order exists.]`;
          }
        }
      }
    } catch (e) {
      console.warn('[pb-chat] db check failed:', e instanceof Error ? e.message : e);
    }
  }

  const apiKey = await pbSecret('GEMINI_API_KEY');
  if (!apiKey) {
    return NextResponse.json({ reply: FALLBACK_REPLIES[lang].noAI });
  }

  try {
    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const contents = history
      .slice(-4)
      .map((h) => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: String(h.text || '') }],
      }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: ON_SITE_AI_PROMPT + orderContext }] },
          contents,
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!r.ok) throw new Error(`gemini ${r.status}`);
    const j = (await r.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const reply =
      j.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join(' ').trim() ||
      FALLBACK_REPLIES[lang].error;
    return NextResponse.json({ reply });
  } catch (e) {
    console.warn('[pb-chat] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ reply: FALLBACK_REPLIES[lang].error });
  }
}
