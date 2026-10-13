// 🆕 M#48 — module augmentation لـ laclarcToken (Google OAuth bridging)
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface User extends DefaultUser {
    laclarcToken?: string;
  }
  interface Session {
    user: DefaultSession['user'] & { laclarcToken?: string };
    laclarcToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    laclarcToken?: string;
  }
}