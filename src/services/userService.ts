import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";
import { getContributionData } from "@/lib/github-graphql";
import { fetchUserGitHubStats, calculateGitHubScore } from "@/lib/githubStats";
import redis from "@/lib/redis";

// ──────────────────────────────────────────────────────────────────
// ログイン時に呼ばれる言語同期（既存）
// ──────────────────────────────────────────────────────────────────

export async function syncUserLanguages(userId: string, githubName: string, accessToken?: string) {
  if (!accessToken || !githubName) {
    console.warn(`[Sync] トークンまたはGitHub名がないため、${githubName} の同期をスキップします。`);
    return;
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentSync = await prisma.userLanguage.findFirst({
      where: {
        userId: userId,
        updatedAt: { gte: oneDayAgo },
      },
    });

    if (recentSync) {
      console.log(`[Sync] ${githubName} の言語データは24時間以内に同期済みのためスキップします。`);
      return;
    }

    console.log(`[Sync] ${githubName} の言語データの同期を開始します...`);

    const report = await getUserLanguageStats(githubName, {
      token: accessToken,
      concurrency: 5,
    });

    const statsToSave = report.stats.slice(0, 20);
    await prisma.$transaction(
      statsToSave.map((stat) =>
        prisma.userLanguage.upsert({
          where: {
            userId_language: { userId: userId, language: stat.language },
          },
          update: { bytes: stat.bytes },
          create: {
            userId: userId,
            language: stat.language,
            bytes: stat.bytes,
          },
        }),
      ),
    );

    console.log(`[Sync] ${githubName} の言語データの同期が完了しました。`);
  } catch (e) {
    console.error(`[SyncError] Failed to fetch languages for ${githubName}:`, e);
  }
}

// ──────────────────────────────────────────────────────────────────
// ログイン時に呼ばれる軽量な stats + contributions 同期
// - 新規ユーザー（statsUpdatedAt が null）は必ず実行
// - 既存ユーザーは1時間以内に更新済みならスキップ
// ──────────────────────────────────────────────────────────────────

export async function syncUserStats(userId: string, githubName: string, accessToken?: string) {
  const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  const token = accessToken ?? FALLBACK_TOKEN;
  if (!token || !githubName) return;

  try {
    // 新規ユーザーか、1時間以上更新されていない場合のみ実行
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { statsUpdatedAt: true },
    });

    const isNew = !user?.statsUpdatedAt;
    const isStale =
      user?.statsUpdatedAt && Date.now() - user.statsUpdatedAt.getTime() > 60 * 60 * 1000;

    if (!isNew && !isStale) {
      console.log(`[StatsSync] ${githubName} は最近更新済みのためスキップ`);
      return;
    }

    console.log(`[StatsSync] ${githubName} の stats + contributions を更新中...`);

    // GitHub Stats（スコア計算用）
    const statsResult = await fetchUserGitHubStats(githubName, token).catch((e) => {
      console.error(`[StatsSync] stats fetch failed for ${githubName}:`, e);
      return null;
    });

    if (statsResult) {
      const score = calculateGitHubScore(statsResult);
      await prisma.user.update({
        where: { id: userId },
        data: {
          totalStars: statsResult.totalStars,
          totalCommits: statsResult.totalCommits,
          totalPRs: statsResult.totalPRs,
          totalIssues: statsResult.totalIssues,
          githubScore: score,
          statsUpdatedAt: new Date(),
        },
      });
    }

    // Contributions → Redis（草グラフ用）
    await getContributionData(githubName, token)
      .then((data) =>
        redis.set(`contributions:days:${githubName}:latest`, JSON.stringify(data.days), {
          ex: 86400,
        }),
      )
      .catch((e) => console.error(`[StatsSync] contributions fetch failed for ${githubName}:`, e));

    // 集計キャッシュをクリア（ランキング・草グラフが即反映されるように）
    await Promise.all([redis.del("stats:dashboard"), redis.del(`repos:count:${githubName}`)]);

    console.log(`[StatsSync] ${githubName} の更新完了`);
  } catch (e) {
    console.error(`[StatsSync] ${githubName} の同期中にエラー:`, e);
  }
}

// ──────────────────────────────────────────────────────────────────
// ログアウト時のデータ削除
// - ユーザー本体は残し、集計系データのみ削除する
// ──────────────────────────────────────────────────────────────────

export async function clearUserDataOnSignOut(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubName: true },
  });

  await prisma.$transaction([
    prisma.userLanguage.deleteMany({ where: { userId } }),
    prisma.languageSnapshot.deleteMany({ where: { userId } }),
    prisma.frameworkUsage.deleteMany({ where: { userId } }),
    prisma.discordActivity.deleteMany({ where: { userId } }),
    prisma.account.updateMany({
      where: { userId, provider: "github" },
      data: { access_token: null },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        totalStars: null,
        totalCommits: null,
        totalPRs: null,
        totalIssues: null,
        githubScore: null,
        statsUpdatedAt: null,
      },
    }),
  ]);

  if (user?.githubName) {
    await Promise.all([
      redis.del(`contributions:days:${user.githubName}:latest`),
      redis.del(`repos:count:${user.githubName}`),
    ]);
  }

  await Promise.all([
    redis.del(`github:reauth-required:${userId}`),
    redis.del("stats:dashboard"),
    redis.del("languages:all:aggregated:total:v7"),
    redis.del("languages:all:aggregated:average:v7"),
    redis.del("languages:trend:total"),
    redis.del("languages:trend:average"),
    redis.del("frameworks:all:aggregated"),
  ]);
}
