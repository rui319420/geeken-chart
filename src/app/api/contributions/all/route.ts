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
      where: { showCommits: true },
      select: { githubName: true, isAnonymous: true },
    });

    const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
    }

    // 集計用のオブジェクト
    type DailyStats = {
      totalCount: number;
      topUser: {
        githubName: string;
        count: number;
        isAnonymous: boolean;
      } | null;
    };
    const dailyStats: Record<string, DailyStats> = {};

    // ユーザーごとにデータを取得して集計
    await Promise.all(
      users.map(async (user) => {
        const githubName = user.githubName;
        if (!githubName) return;

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
            if (!dailyStats[day.date]) {
              dailyStats[day.date] = { totalCount: 0, topUser: null };
            }

            // 全体のコミット数を合算
            dailyStats[day.date].totalCount += day.contributionCount;

            // もし今回のユーザーのコミット数が、現在のTOPの記録より多ければ更新
            const currentTopCount = dailyStats[day.date].topUser?.count ?? 0;
            if (day.contributionCount > currentTopCount && day.contributionCount > 0) {
              dailyStats[day.date].topUser = {
                githubName: user.githubName,
                count: day.contributionCount,
                isAnonymous: user.isAnonymous,
              };
            }
          }
        }
      }),
    );

    // 日付順に並び替え
    const entries = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 草の色の濃さ（level）を計算するための最大値取得
    const counts = entries.map((e) => e.totalCount);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;

    // 最終的なデータ整形
    const formattedData = entries.map((entry) => {
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      // ★ maxCount > 0 を追加して 0除算を完全に防ぐ
      if (entry.totalCount > 0 && maxCount > 0) {
        if (maxCount <= 4) {
          level = Math.min(entry.totalCount, 4) as 1 | 2 | 3 | 4;
        } else {
          const ratio = entry.totalCount / maxCount;
          if (ratio > 0.75) level = 4;
          else if (ratio > 0.5) level = 3;
          else if (ratio > 0.25) level = 2;
          else level = 1;
        }
      }

      // ★ シニアの提案通り、表示用のデータだけを返す（ロジックをバックエンドに寄せる）
      const safeTopUser = entry.topUser
        ? {
            count: entry.topUser.count,
            displayName: entry.topUser.isAnonymous ? "匿名ユーザー" : entry.topUser.githubName,
            avatarUrl: entry.topUser.isAnonymous
              ? null
              : `https://github.com/${entry.topUser.githubName}.png`,
          }
        : null;

      return {
        date: entry.date,
        count: entry.totalCount,
        level,
        topUser: safeTopUser,
      };
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Failed to fetch all contributions:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
