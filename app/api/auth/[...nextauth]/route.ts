import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

// 🆕 M#48 — Google OAuth: identity من Google → JWT تاع laclarc من backend
const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      try {
        // 🔐 F#74 C2 — كنصيفطتو account.id_token (Google ID token) باش الباكند يتحقق من الهوية
        //   (RS256 ضد JWKS) قبل ما يصدر laclarcToken — الإيميل الخام كان ATO مفتوح.
        //   v5 beta: account.id_token متاح server-side هنا (NextAuth يتحقق منو ضد Google أصلاً).
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://neo-store-backend.onrender.com'}/api/auth/social`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: account?.id_token, email: user.email, name: user.name, provider: 'google' }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        user.laclarcToken = data.token;   // ✓ typed via augmentation
        return true;
      } catch {
        return false;   // backend طايح → لا تسجيل (fail-closed)
      }
    },
    async jwt({ token, user }) {
      if (user?.laclarcToken) token.laclarcToken = user.laclarcToken;
      return token;
    },
    async session({ session, token }) {
      (session as any).laclarcToken = token.laclarcToken;
      return session;
    },
  },
});

// 🩹 v5 beta — NextAuthResult.handlers (الـ result ماشي callable في v5)
export const { GET, POST } = handler.handlers;