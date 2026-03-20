import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 認証が必要なパス（ここに追加するだけで保護される）
const PROTECTED_PATHS = [
  "/ranking",
  "/frameworks",
  "/members",
  "/survey",
  "/settings",
  "/works",
  "/sns",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!isProtected) return NextResponse.next();

  const session = await auth();
  if (!session) {
    const loginUrl = new URL("/", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // _next/static, _next/image, favicon などは除外
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
