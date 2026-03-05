import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }

  interface User {
    githubId?: string;
    githubName?: string;
    avatarUrl?: string;
  }
}
