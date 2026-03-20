import { prisma } from "@/lib/prisma";
import { getContributionData } from "@/lib/github-graphql";
import redis from "@/lib/redis";

const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

type TopUserStat = {
  githubName: string;
  nickname: string | null;
  count: number;
  isAnonymous: boolean;
};

type StatEntry = {
  date: string;
  totalCount: number;
  topUser: TopUserStat | null;
};

type WeeklyStats = {
  totalCount: number;
  users: Record<string, TopUserStat>;
};

// 指定した日付が属する週の「月曜日」を返す関数
function getMonday(dateStr: string) {
  const dt = new Date(dateStr);

  if (isNaN(dt.getTime())) return new Date().toISOString().split("T")[0];

  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(dt);
  monday.setDate(dt.getDate() + diff);
  return monday.toISOString().split("T")[0];
}

/**
 * コミットデータを取得し、日ごと・週ごとのMVPを集計する
 */
export async function getAggregatedContributions(year: number | null) {
  if (!GITHUB_TOKEN) {
    throw new Error("GitHub token not configured");
  }

  const users = await prisma.user.findMany({
    where: { showCommits: true },
    select: { githubName: true, isAnonymous: true, nickname: true },
  });

  const dailyStats: Record<string, StatEntry> = {};
  const weeklyStats: Record<string, WeeklyStats> = {};

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
          // 日ごとの集計
          if (!dailyStats[day.date]) {
            dailyStats[day.date] = { date: day.date, totalCount: 0, topUser: null };
          }
          dailyStats[day.date].totalCount += day.contributionCount;

          const currentTopCount = dailyStats[day.date].topUser?.count ?? 0;
          if (day.contributionCount > currentTopCount && day.contributionCount > 0) {
            dailyStats[day.date].topUser = {
              githubName: user.githubName,
              nickname: user.nickname,
              count: day.contributionCount,
              isAnonymous: user.isAnonymous,
            };
          }

          // 週ごとの集計
          const weekKey = getMonday(day.date);
          if (!weeklyStats[weekKey]) {
            weeklyStats[weekKey] = { totalCount: 0, users: {} };
          }
          weeklyStats[weekKey].totalCount += day.contributionCount;

          if (day.contributionCount > 0) {
            if (!weeklyStats[weekKey].users[user.githubName]) {
              weeklyStats[weekKey].users[user.githubName] = {
                githubName: user.githubName,
                nickname: user.nickname,
                count: 0,
                isAnonymous: user.isAnonymous,
              };
            }
            weeklyStats[weekKey].users[user.githubName].count += day.contributionCount;
          }
        }
      }
    }),
  );

  const dailyEntries = Object.values(dailyStats).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const weeklyEntries: StatEntry[] = Object.entries(weeklyStats)
    .map(([date, stats]) => {
      let topUser: TopUserStat | null = null;
      let maxCount = 0;
      for (const u of Object.values(stats.users)) {
        if (u.count > maxCount) {
          maxCount = u.count;
          topUser = u;
        }
      }
      return { date, totalCount: stats.totalCount, topUser };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  function formatEntries(entries: StatEntry[]) {
    const counts = entries.map((e) => e.totalCount);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 0;

    return entries.map((entry) => {
      let level: 0 | 1 | 2 | 3 | 4 = 0;
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

      const safeTopUser = entry.topUser
        ? {
            count: entry.topUser.count,
            displayName: entry.topUser.isAnonymous
              ? "匿名ユーザー"
              : entry.topUser.nickname || entry.topUser.githubName,
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
  }

  return {
    daily: formatEntries(dailyEntries),
    weekly: formatEntries(weeklyEntries),
  };
}
