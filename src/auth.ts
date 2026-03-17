import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";

const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        if ("nickname" in user) {
          session.user.nickname = user.nickname;
        }
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
      }

      const existingLanguages = await prisma.userLanguage.count({
        where: { userId: userId },
      });

      const githubName = profile.login as string;

      if (existingLanguages === 0 && GITHUB_TOKEN && githubName) {
        try {
          const report = await getUserLanguageStats(githubName, {
            token: GITHUB_TOKEN,
            concurrency: 5,
          });

          await Promise.all(
            report.stats.slice(0, 20).map((stat) =>
              prisma.userLanguage.upsert({
                where: { userId_language: { userId: userId, language: stat.language } },
                update: { bytes: stat.bytes },
                create: { userId: userId, language: stat.language, bytes: stat.bytes },
              }),
            ),
          );
        } catch (e) {
          console.warn(`Failed to fetch languages for ${githubName}:`, e);
        }
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
