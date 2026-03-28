import { prisma } from "@/lib/prisma";
import { getContributionData } from "@/lib/github-graphql";
import redis from "@/lib/redis";
import pLimit from "p-limit";

const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
const FETCH_CONCURRENCY = 8;
const SYSTEM_TOKEN_CONCURRENCY = 2;
const SYSTEM_TOKEN_RETRY_DELAY_MS = 750;

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

type FetchWithFallbackResult = {
  days: { date: string; contributionCount: number }[] | null;
  userTokenAuthError: boolean;
  fallbackAttempted: boolean;
  fallbackSucceeded: boolean;
  failed: boolean;
};

type ContributionSummary = {
  totalUsers: number;
  cacheHitUsers: number;
  apiFetchedUsers: number;
  skippedNoTokenUsers: number;
  failedUsers: number;
  fallbackAttemptedUsers: number;
  fallbackSucceededUsers: number;
  fallbackFailedUsers: number;
  staleTokenUsers: number;
};

const systemTokenLimit = pLimit(SYSTEM_TOKEN_CONCURRENCY);

function isAuthTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("bad credentials") ||
    msg.includes("resource not accessible")
  );
}

function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return msg.includes("rate limit") || msg.includes("429") || msg.includes("secondary rate limit");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchByToken(
  githubName: string,
  token: string,
  year: number | null,
  useSystemToken: boolean,
) {
  const doFetch = async () => getContributionData(githubName, token, year ?? undefined);

  if (useSystemToken) {
    return systemTokenLimit(async () => {
      try {
        return await doFetch();
      } catch (error) {
        if (!isRateLimitError(error)) throw error;
        // システムトークンのレート制限時は1回だけ待ってリトライ
        await sleep(SYSTEM_TOKEN_RETRY_DELAY_MS);
        return doFetch();
      }
    });
  }

  return doFetch();
}

async function fetchContributionDaysWithFallback(
  githubName: string,
  year: number | null,
  userToken?: string,
): Promise<FetchWithFallbackResult> {
  const primaryToken = userToken ?? GITHUB_TOKEN;
  if (!primaryToken) {
    return {
      days: null,
      userTokenAuthError: false,
      fallbackAttempted: false,
      fallbackSucceeded: false,
      failed: false,
    };
  }

  let userTokenAuthError = false;
  let fallbackAttempted = false;

  try {
    const data = await fetchByToken(githubName, primaryToken, year, !userToken);
    return {
      days: data.days,
      userTokenAuthError,
      fallbackAttempted,
      fallbackSucceeded: false,
      failed: false,
    };
  } catch (primaryError) {
    if (userToken && isAuthTokenError(primaryError)) {
      userTokenAuthError = true;
    }

    // 個人トークンで失敗した場合はシステムトークンで再試行する
    if (userToken && GITHUB_TOKEN && userToken !== GITHUB_TOKEN) {
      fallbackAttempted = true;
      try {
        const retryData = await fetchByToken(githubName, GITHUB_TOKEN, year, true);
        return {
          days: retryData.days,
          userTokenAuthError,
          fallbackAttempted,
          fallbackSucceeded: true,
          failed: false,
        };
      } catch {
        return {
          days: null,
          userTokenAuthError,
          fallbackAttempted,
          fallbackSucceeded: false,
          failed: true,
        };
      }
    }

    return {
      days: null,
      userTokenAuthError,
      fallbackAttempted,
      fallbackSucceeded: false,
      failed: true,
    };
  }
}

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
  const users = await prisma.user.findMany({
    where: { showCommits: true },
    select: {
      id: true,
      githubName: true,
      isAnonymous: true,
      nickname: true,
      accounts: {
        where: { provider: "github" },
        select: { access_token: true },
        take: 1,
      },
    },
  });

  const dailyStats: Record<string, StatEntry> = {};
  const weeklyStats: Record<string, WeeklyStats> = {};
  const limit = pLimit(FETCH_CONCURRENCY);
  const staleTokenUserIds = new Set<string>();
  const summary: ContributionSummary = {
    totalUsers: users.length,
    cacheHitUsers: 0,
    apiFetchedUsers: 0,
    skippedNoTokenUsers: 0,
    failedUsers: 0,
    fallbackAttemptedUsers: 0,
    fallbackSucceededUsers: 0,
    fallbackFailedUsers: 0,
    staleTokenUsers: 0,
  };

  await Promise.all(
    users.map((user) =>
      limit(async () => {
        const githubName = user.githubName;
        if (!githubName) return;

        const cacheKey = year
          ? `contributions:days:${githubName}:${year}`
          : `contributions:days:${githubName}:latest`;

        let days = await redis.get(cacheKey);

        if (!days) {
          try {
            const userToken = user.accounts[0]?.access_token ?? undefined;
            const { days: fetchedDays, userTokenAuthError, fallbackAttempted, fallbackSucceeded, failed } =
              await fetchContributionDaysWithFallback(githubName, year, userToken);

            if (fallbackAttempted) summary.fallbackAttemptedUsers += 1;
            if (fallbackSucceeded) summary.fallbackSucceededUsers += 1;
            if (fallbackAttempted && !fallbackSucceeded) summary.fallbackFailedUsers += 1;
            if (failed) summary.failedUsers += 1;

            if (userTokenAuthError && userToken) {
              staleTokenUserIds.add(user.id);
            }

            if (!fetchedDays) {
              summary.skippedNoTokenUsers += 1;
              return;
            }

            days = fetchedDays;
            summary.apiFetchedUsers += 1;
            const ttl = year ? 86400 * 30 : 86400;
            await redis.set(cacheKey, JSON.stringify(days), { ex: ttl });
          } catch {
            summary.failedUsers += 1;
            return;
          }
        } else {
          summary.cacheHitUsers += 1;
        }
        if (typeof days === "string") {
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
    ),
  );

  if (staleTokenUserIds.size > 0) {
    await prisma.account.updateMany({
      where: {
        provider: "github",
        userId: { in: Array.from(staleTokenUserIds) },
      },
      data: { access_token: null },
    });
    summary.staleTokenUsers = staleTokenUserIds.size;
  }

  console.info(
    JSON.stringify({
      event: "contribution_aggregation_summary",
      year,
      ...summary,
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
