import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContributionData } from "@/lib/github-graphql";
import redis from "@/lib/redis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam) : null;

    const users = await prisma.user.findMany({
      // ★ githubName を使う（name は表示名なので GitHub API では使えない）
      select: { githubName: true },
    });

    const dailyCounts: Record<string, number> = {};
    const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    await Promise.all(
      users.map(async (user) => {
        const githubName = user.githubName;
        if (!githubName) return;

        // ★ キャッシュキーも githubName ベース
        const cacheKey = year
          ? `contributions:days:${githubName}:${year}`
          : `contributions:days:${githubName}:latest`;

        let days = await redis.get(cacheKey);

        if (!days) {
          try {
            const data = await getContributionData(githubName, GITHUB_TOKEN, year ?? undefined);
            days = data.days;
            const ttl = year ? 86400 * 30 : 86400;
            await redis.set(cacheKey, JSON.stringify(days), { ex: ttl });
          } catch (error) {
            console.error(`Failed to fetch contributions for ${githubName}:`, error);
            return;
          }
        } else if (typeof days === "string") {
          days = JSON.parse(days);
        }

        if (Array.isArray(days)) {
          for (const day of days) {
            dailyCounts[day.date] = (dailyCounts[day.date] || 0) + day.contributionCount;
          }
        }
      }),
    );

    const entries = Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const counts = entries.map((e) => e.count);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;

    const formattedData = entries.map((entry) => {
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (entry.count > 0) {
        if (maxCount <= 4) {
          level = Math.min(entry.count, 4) as 1 | 2 | 3 | 4;
        } else {
          const ratio = entry.count / maxCount;
          if (ratio > 0.75) level = 4;
          else if (ratio > 0.5) level = 3;
          else if (ratio > 0.25) level = 2;
          else level = 1;
        }
      }
      return { ...entry, level };
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Failed to fetch all contributions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
