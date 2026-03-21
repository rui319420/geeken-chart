import { auth } from "@/auth";

const PROTECTED_PATHS = [
  "/ranking",
  "/frameworks",
  "/members",
  "/survey",
  "/settings",
  "/works",
  "/sns",
];

// auth() を await で呼び出すのではなく、NextAuth v5 のミドルウェア形式で使う。
// こうすることで Prisma アダプターがエッジバンドルに含まれなくなり、
// 1MB のサイズ制限を回避できる。
// セッション確認は JWT クッキーの検証のみで完結するため軽量。
export default auth((request) => {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isProtected && !request.auth) {
    const loginUrl = new URL("/", request.url);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
