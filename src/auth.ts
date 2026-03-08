import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

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
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" && profile) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            githubId: profile.id?.toString() || "",
            githubName: (profile.login as string) || "",
            avatarUrl: (profile.avatar_url as string) || "",
          },
        });

        if (account.access_token) {
          await prisma.account.updateMany({
            where: { userId: user.id, provider: "github" },
            data: { access_token: account.access_token },
          });
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
