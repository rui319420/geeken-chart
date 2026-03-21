import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// auth.config.ts は Prisma を含まないため、
// エッジバンドルに Prisma クライアントが混入せず 1MB 制限を回避できる。
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
