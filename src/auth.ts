import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { syncUserLanguages } from "@/services/userService";
import { waitUntil } from "@vercel/functions";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // ────────────────────────────────────────────────────────────────
  // session strategy を "jwt" に設定する。
  //
  // Prisma アダプターのデフォルトは "database"（セッションをDBで管理）だが、
  // "database" 戦略だとミドルウェアがセッション確認のたびに DB へアクセスし、
  // Prisma クライアントがエッジバンドルに含まれて 1MB 制限を超える。
  //
  // "jwt" にすることでミドルウェアは署名済み JWT クッキーのみで
  // セッションを検証できるようになり、エッジで Prisma を不要にできる。
  // ────────────────────────────────────────────────────────────────
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email repo",
        },
      },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
          githubId: profile.id.toString(),
          githubName: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // サインイン直後のみ user が渡される。DB の id を token に保存する。
      if (user) {
        token.id = user.id;
        token.nickname = (user as { nickname?: string | null }).nickname ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.nickname = token.nickname as string | null | undefined;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      const userId = user.id;
      if (!userId || !profile) return;

      if (account?.provider === "github") {
        await prisma.user.update({
          where: { id: userId },
          data: {
            githubId: profile.id?.toString() || "",
            githubName: (profile.login as string) || "",
            avatarUrl: (profile.avatar_url as string) || "",
          },
        });

        if (account.access_token) {
          await prisma.account.updateMany({
            where: { userId: userId, provider: "github" },
            data: { access_token: account.access_token },
          });
        }

        const githubName = profile.login as string;
        const userToken = account.access_token;
        waitUntil(syncUserLanguages(userId, githubName, userToken).catch(console.error));
      }
    },
    async signOut(message) {
      if ("session" in message && message.session?.userId) {
        await prisma.account.updateMany({
          where: { userId: message.session.userId, provider: "github" },
          data: { access_token: null },
        });
      }
    },
  },
});
