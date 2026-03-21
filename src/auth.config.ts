import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

// ────────────────────────────────────────────────────────────────
// このファイルは Prisma アダプターを一切インポートしない。
// ミドルウェア（エッジランタイム）から参照するための軽量設定。
//
// auth.ts は PrismaAdapter を使う完全な設定で、
// サーバーコンポーネント・API Route から使う。
// ────────────────────────────────────────────────────────────────
export const authConfig: NextAuthConfig = {
  providers: [GitHub],
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      const PROTECTED_PATHS = [
        "/ranking",
        "/frameworks",
        "/members",
        "/survey",
        "/settings",
        "/works",
        "/sns",
      ];

      const isProtected = PROTECTED_PATHS.some(
        (path) => nextUrl.pathname === path || nextUrl.pathname.startsWith(`${path}/`),
      );

      if (isProtected && !isLoggedIn) {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.nickname = (user as { nickname?: string | null }).nickname ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        session.user.id = token.id as string;
        session.user.nickname = token.nickname as string | null | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
