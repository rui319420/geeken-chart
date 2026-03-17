import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";
import { getContributionData } from "@/lib/github-graphql";
import { buildHistoricalSnapshots } from "@/lib/github-history";
import redis from "@/lib/redis";
import { fetchUserGitHubStats, calculateGitHubScore } from "@/lib/githubStats";
import { getUserFrameworkStats } from "@/lib/github-deps";
import pLimit from "p-limit";

export const maxDuration = 60;

type RefreshResult = {
  username: string;
  languages: number;
  commits: number;
  snapshotMonths: number;
  frameworks: number;
  usedPrivateToken: boolean;
  error?: string;
};

export async function POST() {
  const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  if (!FALLBACK_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      githubName: true,
      includePrivate: true,
      accounts: {
        where: { provider: "github" },
        select: { access_token: true },
      },
    },
  });

  if (users.length === 0) {
    return NextResponse.json({ message: "No users found", results: [] });
  }

  const results: RefreshResult[] = [];

  const limit = pLimit(3);

  await Promise.all(
    users.map((user) =>
      limit(async () => {
        const githubName = user.githubName;
        const oauthToken = user.accounts[0]?.access_token ?? null;
        const usePrivate = user.includePrivate && !!oauthToken;
        const token = usePrivate ? oauthToken! : FALLBACK_TOKEN;

        const result: RefreshResult = {
          username: githubName,
          languages: 0,
          commits: 0,
          snapshotMonths: 0,
          frameworks: 0,
          usedPrivateToken: usePrivate,
        };

        // ──────────────────────────────────────────────────────────────────
        // 1. 現在の言語データを UserLanguage テーブルに保存（円グラフ用）
        // ──────────────────────────────────────────────────────────────────
        try {
          const report = await getUserLanguageStats(githubName, {
            token,
            includePrivate: usePrivate,
            concurrency: 5,
          });

          await prisma.userLanguage.deleteMany({ where: { userId: user.id } });
          await prisma.userLanguage.createMany({
            data: report.stats.slice(0, 20).map((stat) => ({
              userId: user.id,
              language: stat.language,
              bytes: stat.bytes,
            })),
          });

          result.languages = report.stats.length;
        } catch (e) {
          console.error(`Language fetch failed for ${githubName}:`, e);
          result.error = appendError(result.error, `languages: ${errorMsg(e)}`);
        }

        // ──────────────────────────────────────────────────────────────────
        // 2. 過去12ヶ月分の言語ヒストリーを LanguageSnapshot に保存（折れ線グラフ用）
        // ──────────────────────────────────────────────────────────────────
        try {
          const historicalSnapshots = await buildHistoricalSnapshots(githubName, token, {
            monthsBack: 12,
            includeForks: false,
            includePrivate: usePrivate,
            concurrency: 5,
          });

          await Promise.all(
            historicalSnapshots.flatMap(({ month, languages }) =>
              Object.entries(languages).map(([language, bytes]) =>
                prisma.languageSnapshot.upsert({
                  where: {
                    userId_language_month: { userId: user.id, language, month },
                  },
                  update: { bytes },
                  create: { userId: user.id, language, bytes, month },
                }),
              ),
            ),
          );

          result.snapshotMonths = historicalSnapshots.length;
        } catch (e) {
          console.error(`History build failed for ${githubName}:`, e);
          result.error = appendError(result.error, `history: ${errorMsg(e)}`);
        }

        // ──────────────────────────────────────────────────────────────────
        // 3. コントリビューションを Redis に保存（草グラフ用）
        // ──────────────────────────────────────────────────────────────────
        try {
          const contribToken = oauthToken ?? FALLBACK_TOKEN;
          const data = await getContributionData(githubName, contribToken);

          await redis.set(`contributions:days:${githubName}:latest`, JSON.stringify(data.days), {
            ex: 86400,
          });

          result.commits = data.totalContributions;
        } catch (e) {
          console.error(`Contribution fetch failed for ${githubName}:`, e);
          result.error = appendError(result.error, `contributions: ${errorMsg(e)}`);
        }

        // ──────────────────────────────────────────────────────────────────
        // 4. ランキング用 GitHub Stats の取得と保存
        // ──────────────────────────────────────────────────────────────────
        try {
          const stats = await fetchUserGitHubStats(githubName, token);
          const score = calculateGitHubScore(stats);

          await prisma.user.update({
            where: { id: user.id },
            data: {
              totalStars: stats.totalStars,
              totalCommits: stats.totalCommits,
              totalPRs: stats.totalPRs,
              totalIssues: stats.totalIssues,
              githubScore: score,
              statsUpdatedAt: new Date(),
            },
          });
        } catch (e) {
          console.error(`GitHub Stats fetch failed for ${githubName}:`, e);
          result.error = appendError(result.error, `stats: ${errorMsg(e)}`);
        }

        // ──────────────────────────────────────────────────────────────────
        // 5. フレームワーク・ライブラリの依存情報を取得して保存
        // ──────────────────────────────────────────────────────────────────
        try {
          const frameworkStats = await getUserFrameworkStats(githubName, token, 5);

          await prisma.frameworkUsage.deleteMany({ where: { userId: user.id } });

          if (frameworkStats.length > 0) {
            await prisma.frameworkUsage.createMany({
              data: frameworkStats.map((f) => ({
                userId: user.id,
                framework: f.framework,
                ecosystem: f.ecosystem,
                repoCount: f.repoCount,
              })),
            });
          }

          result.frameworks = frameworkStats.length;
        } catch (e) {
          console.error(`Framework fetch failed for ${githubName}:`, e);
          result.error = appendError(result.error, `frameworks: ${errorMsg(e)}`);
        }

        results.push(result);
      }),
    ),
  );

  // ──────────────────────────────────────────────────────────────────
  // 6. 集計キャッシュをクリア
  // ──────────────────────────────────────────────────────────────────
  await Promise.all([
    redis.del("stats:dashboard"),
    redis.del("languages:all:aggregated:total"),
    redis.del("languages:all:aggregated:average"),
    redis.del("languages:trend"),
    redis.del("discord:heatmap:aggregated"),
    redis.del("frameworks:all:aggregated"),
    ...users.map((u) => redis.del(`repos:count:${u.githubName}`)),
  ]);

  if (session?.user) {
    console.warn(`[refresh] triggered by ${session.user.name ?? session.user.id}`);
  }

  return NextResponse.json({
    message: "Refresh complete",
    updatedUsers: results.length,
    results,
  });
}

function appendError(existing: string | undefined, msg: string): string {
  return [existing, msg].filter(Boolean).join(" / ");
}

function errorMsg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown";
}
