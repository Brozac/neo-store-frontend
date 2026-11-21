// lib/emails.ts — خدمة البريد الإلكتروني (Brevo → Resend fallback)
// ═══════════════════════════════════════════════════════════════════════
// نقل حرفي من الباك القديم (server.js — sendEmail): Brevo أولاً — إلا فشل
// كنجربو Resend — إلا الاثنين فشلو: console.warn فقط، عمرو ما كيرمي (best-effort
// بحال الباك — التسجيل/الاسترجاع ما كيتحبسوش بفشل البريد).
// Env (Workers secrets عبر getPbRuntime/pbVar — نفس نمط pb-jwt):
//   BREVO_API_KEY · BREVO_USER · RESEND_API_KEY · RESEND_FROM_EMAIL
// ═══════════════════════════════════════════════════════════════════════
import 'server-only';
import { getPbRuntime, pbVar } from './pb/pb-env';

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

const EMAIL_TIMEOUT_MS = 15_000;

/** Brevo SMTP API — نفس البودي والهيدرز حرفياً من الباك القديم */
async function sendViaBrevo(to: string, subject: string, html: string): Promise<void> {
  const { env } = await getPbRuntime();
  const apiKey = pbVar(env, 'BREVO_API_KEY');
  const brevoUser = pbVar(env, 'BREVO_USER');
  if (!apiKey || !brevoUser) {
    throw new Error('Brevo not configured (BREVO_API_KEY / BREVO_USER)');
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Laclarc Support', email: brevoUser },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`);
  }
}

/** Resend — نفس الـ fallback تاع الباك القديم */
async function sendViaResend(to: string, subject: string, html: string): Promise<void> {
  const { env } = await getPbRuntime();
  const apiKey = pbVar(env, 'RESEND_API_KEY');
  if (!apiKey) throw new Error('Resend not configured (RESEND_API_KEY)');
  const from = pbVar(env, 'RESEND_FROM_EMAIL') || 'Laclarc <onboarding@resend.dev>';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

/**
 * إرسال best-effort — عمرو ما كيرمي (نفس عقد الباك القديم):
 * Brevo أولاً · فشل → Resend fallback · فشل الاثنين → console.warn فقط.
 */
export async function sendEmail({ to, subject, html }: SendEmailArgs): Promise<void> {
  try {
    await sendViaBrevo(to, subject, html);
    console.log(`📧 Email sent via Brevo to ${to}`);
    return;
  } catch (brevoErr) {
    console.warn(
      '[pb-email] Brevo failed:',
      brevoErr instanceof Error ? brevoErr.message : brevoErr,
    );
  }

  try {
    await sendViaResend(to, subject, html);
    console.log(`📧 Email sent via Resend (fallback) to ${to}`);
  } catch (resendErr) {
    console.warn(
      '[pb-email] Resend fallback failed:',
      resendErr instanceof Error ? resendErr.message : resendErr,
    );
  }
}
