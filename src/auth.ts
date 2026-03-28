import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { clearUserDataOnSignOut, syncUserLanguages, syncUserStats } from "@/services/userService";
import { waitUntil } from "@vercel/functions";
import { authConfig } from "@/auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // authConfig の callbacks（jwt・session・authorized）と
  // session strategy を継承しつつ、Prisma アダプターを追加する。
  // ミドルウェアは authConfig を直接参照するため Prisma はエッジに混入しない。
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      // AUTH_GITHUB_ID があればそちらを使い、なければ GITHUB_ID を使う（両対応）
      clientId: process.env.AUTH_GITHUB_ID || process.env.GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_SECRET,
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

          await redis.del(`github:reauth-required:${userId}`);
        }

        const githubName = profile.login as string;
        const userToken = account.access_token;
        waitUntil(
          Promise.all([
            syncUserLanguages(userId, githubName, userToken),
            syncUserStats(userId, githubName, userToken),
          ]).catch(console.error),
        );
      }
    },
    async signOut(message) {
      const userIdFromSession =
        "session" in message
          ? (message.session?.userId ??
            (message.session as { user?: { id?: string } } | null | undefined)?.user?.id)
          : undefined;

      const userIdFromToken =
        "token" in message
          ? ((message.token as { id?: string; sub?: string } | null | undefined)?.id ??
            (message.token as { id?: string; sub?: string } | null | undefined)?.sub)
          : undefined;

      const userId = userIdFromSession ?? userIdFromToken;
      if (!userId) return;

      await clearUserDataOnSignOut(userId);
    },
  },
});
