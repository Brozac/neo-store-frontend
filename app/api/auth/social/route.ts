// POST /api/auth/social — نقل حرفي من الباك القديم (server.js /api/auth/social · authLimiter)
// موجود؟ → login · جديد → register (provider موثق الإيميل أصلاً — بلا password)
// 🔐 HARDEN (زيادة على الباك): إلا كاين idToken كيتحقق منو عبر Google tokeninfo —
//   الإيميل ديال التوكن خاصو يطابق cleanEmail، وإلا 401 'Email verification failed'
//   (الباك القديم كان كيصدق الإيميل الخام — ATO مفتوح؛ الحماية زايدة والعقد بقى كما هو).
//
// ⚠️ WORKAROUND موثق — hash عشوائي غير قابل للاستعمال للحسابات الاجتماعية:
//   الباك القديم كان كيحط password_hash NULL. الـ definer phasef_user_register
//   كيرفض hash خاوي (bad_input) وما يمكنش نزيدو SQL جديد هنا (SEC definer فقط).
//   الحل: hashSync(randomUUID()+Date.now(), 10) — bcrypt.compare كيفشل دايماً
//   على هاد الـ hash (ما كاينش password كيمشي معاه) → حساب بلا password فعلياً،
//   وآمن: حتى حادث ما يقدر يدخل بكلمة سر على حساب social.
import { NextResponse } from 'next/server';
import { getRwSql } from '@/lib/pb/pb-db';
import { getPbJwtSecret, pbSignUserJwt } from '@/lib/pb/pb-jwt';
import { pbRateLimit, pbClientIp } from '@/lib/pb/pb-limiter';
import { hashSync } from 'bcryptjs';

export const dynamic = 'force-dynamic';

const AUTH_LIMIT = { max: 10, windowMs: 15 * 60 * 1000 };

function normalizeEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase();
}

interface UserByEmail {
  found?: boolean;
  id?: number;
  name?: string | null;
  email?: string | null;
}

interface RegisterResult {
  ok?: boolean;
  id?: number;
  reason?: string;
}

export async function POST(request: Request) {
  try {
    if (!pbRateLimit(`auth:${pbClientIp(request)}`, AUTH_LIMIT.max, AUTH_LIMIT.windowMs)) {
      return NextResponse.json({ message: 'Too many requests, please try again after 15 minutes.' }, { status: 429 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const { email, name, provider, idToken } = body;
    if (!email || !provider) {
      return NextResponse.json({ error: 'email and provider required' }, { status: 400 });
    }
    if (!['google'].includes(String(provider))) {
      return NextResponse.json({ error: 'Unsupported provider' }, { status: 400 });
    }

    const cleanEmail = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // 🔐 HARDEN — Google tokeninfo (RS256 verification على Google side) + مطابقة الإيميل
    if (idToken) {
      try {
        const infoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(String(idToken))}`,
          { signal: AbortSignal.timeout(8000) },
        );
        const info = infoRes.ok
          ? ((await infoRes.json()) as { email?: string; email_verified?: string | boolean } | null)
          : null;
        const infoEmail = info?.email ? String(info.email).toLowerCase() : null;
        if (!infoEmail || infoEmail !== cleanEmail) {
          return NextResponse.json({ error: 'Email verification failed' }, { status: 401 });
        }
      } catch (e) {
        // فشل شبكة/تحقق → fail-closed (كي مختلف على الباك القديم اللي كان كيسكت)
        console.warn('[pb-social] tokeninfo failed:', e instanceof Error ? e.message : e);
        return NextResponse.json({ error: 'Email verification failed' }, { status: 401 });
      }
    }

    const secret = await getPbJwtSecret();
    if (!secret) return NextResponse.json({ error: 'Server error' }, { status: 500 });
    const sql = await getRwSql();
    if (!sql) return NextResponse.json({ error: 'Server error' }, { status: 500 });

    // موجود؟ → login · جديد → register
    let userRows = await sql.unsafe('SELECT phasef_user_by_email($1) AS r', [cleanEmail]);
    let u = (userRows[0]?.r ?? null) as UserByEmail | null;
    let user: { id: number; name: string | null; email: string | null };

    if (u?.found && u.id != null) {
      user = { id: u.id, name: u.name ?? null, email: u.email ?? null };
      console.log(`🔐 [Social] login via ${String(provider)}: ${cleanEmail}`);
    } else {
      const displayName = String(name || cleanEmail.split('@')[0]).slice(0, 100);
      // ⚠️ hash غير قابل للاستعمال (see header comment) — social = بلا password
      const unusableHash = hashSync(`${crypto.randomUUID()}_${Date.now()}`, 10);
      const regRows = await sql.unsafe('SELECT phasef_user_register($1, $2, $3, $4) AS r', [
        displayName,
        cleanEmail,
        unusableHash,
        String(provider),
      ]);
      const reg = (regRows[0]?.r ?? null) as RegisterResult | null;

      if (reg?.ok && reg.id != null) {
        user = { id: reg.id, name: displayName, email: cleanEmail };
        console.log(`🆕 [Social] registered via ${String(provider)}: ${cleanEmail}`);
        // auditEvent('SOCIAL_REGISTER', …) — best-effort بحال الباك
        try {
          await sql.unsafe("SELECT phasef_event('SOCIAL_REGISTER', $1, $2, $3)", [
            user.id,
            JSON.stringify({ provider: String(provider), email: cleanEmail }),
            'info',
          ]);
        } catch (auditErr) {
          console.warn('[pb-social] audit failed:', auditErr instanceof Error ? auditErr.message : auditErr);
        }
      } else if (reg?.reason === 'dup') {
        // سباق تسجيل متوازي → login
        userRows = await sql.unsafe('SELECT phasef_user_by_email($1) AS r', [cleanEmail]);
        u = (userRows[0]?.r ?? null) as UserByEmail | null;
        if (!u?.found || u.id == null) {
          return NextResponse.json({ error: 'Server error' }, { status: 500 });
        }
        user = { id: u.id, name: u.name ?? null, email: u.email ?? null };
      } else {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
      }
    }

    // JWT نفس النظام — session bridging مكتمال ({ id, email } · 7d)
    const token = await pbSignUserJwt({ id: user.id, email: user.email ?? undefined }, secret, 7 * 24 * 60 * 60);
    return NextResponse.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    console.warn('[pb-social] failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
