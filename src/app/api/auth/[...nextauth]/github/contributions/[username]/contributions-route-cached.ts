import { NextResponse } from "next/server";
import { getContributionData } from "@/lib/github-graphql";
import { withCache, cacheKey, TTL } from "@/lib/redis";
import { auth } from "@/auth";

type RouteParams = {
  params: Promise<{ username: string }>;
};

/**
 * GET /api/github/contributions/[username]?year=2024
 *
 * 指定ユーザーのGitHubコントリビューション（草）データを返す。
 * Upstash Redisで1時間キャッシュ。
 */
export async function GET(request: Request, { params }: RouteParams) {
  // 認証チェック
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await params;

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  if (year !== undefined && (isNaN(year) || year < 2008 || year > new Date().getFullYear())) {
    return NextResponse.json({ error: "Invalid year parameter" }, { status: 400 });
  }

  const token = process.env.GITHUB_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  try {
    const data = await withCache(cacheKey.contributions(username, year), TTL.CONTRIBUTIONS, () =>
      getContributionData(username, token, year),
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("not found")) {
      return NextResponse.json({ error: `User not found: ${username}` }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
