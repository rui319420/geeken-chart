import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchUserRepos,
  fetchRepoLanguages,
  type GitHubRepo,
  type LanguageBytes,
} from "@/lib/github";
import { getContributionData } from "@/lib/github-graphql";
import { buildHistoricalSnapshots } from "@/lib/github-history";
import { fetchUserGitHubStats, calculateGitHubScore } from "@/lib/githubStats";
import { getUserFrameworkStats } from "@/lib/github-deps";
import redis from "@/lib/redis";
import pLimit from "p-limit";

export const maxDuration = 300;

// Fix #92: 正しい discord:heatmap キーを計算するヘルパー
function getDiscordHeatmapCacheKey(offsetWeeks = 0): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = jst.getUTCDay();
  const monday = new Date(jst);
  monday.setUTCDate(jst.getUTCDate() - ((day + 6) % 7) + offsetWeeks * 7);
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7,
  );
  return `discord:heatmap:${year}-W${String(weekNo).padStart(2, "0")}`;
}

// Vercel Cron は Authorization: Bearer <CRON_SECRET> を付けてリクエストする
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  if (!FALLBACK_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  console.warn("[Cron] /api/cron/refresh 開始");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      githubName: true,
      includePrivate: true,
      statsUpdatedAt: true,
      accounts: {
        where: { provider: "github" },
        select: { access_token: true },
      },
    },
  });

  const results: { username: string; ok: boolean; error?: string }[] = [];
  const limit = pLimit(3);

  await Promise.all(
    users.map((user) =>
      limit(async () => {
        const githubName = user.githubName;
        const oauthToken = user.accounts[0]?.access_token ?? null;
        const usePrivate = user.includePrivate && !!oauthToken;
        const token = usePrivate ? oauthToken! : FALLBACK_TOKEN;

        try {
          // 0. リポジトリ一覧 + 言語データを一括取得
          const repos = await fetchUserRepos(githubName, {
            token,
            includePrivate: usePrivate,
            includeForks: false,
          });

          const languageMap = new Map<string, LanguageBytes>();
          const langLimit = pLimit(5);
          await Promise.all(
            repos.map((repo: GitHubRepo) =>
              langLimit(async () => {
                const langs = await fetchRepoLanguages(githubName, repo.name, token).catch(
                  () => ({}) as LanguageBytes,
                );
                languageMap.set(repo.name, langs);
              }),
            ),
          );

          // 1. 言語バイト数 → UserLanguage
          const EXCLUDED = new Set(["ShaderLab", "HLSL", "GLSL", "Jupyter Notebook"]);
          const totals = new Map<string, number>();
          for (const langBytes of languageMap.values()) {
            for (const [lang, bytes] of Object.entries(langBytes)) {
              if (EXCLUDED.has(lang)) continue;
              totals.set(lang, (totals.get(lang) ?? 0) + bytes);
            }
          }
          const stats = Array.from(totals.entries())
            .map(([language, bytes]) => ({ language, bytes }))
            .sort((a, b) => b.bytes - a.bytes);

          await prisma.userLanguage.deleteMany({ where: { userId: user.id } });
          await prisma.userLanguage.createMany({
            data: stats.slice(0, 20).map((s) => ({
              userId: user.id,
              language: s.language,
              bytes: s.bytes,
            })),
          });

          // 2. 言語ヒストリー → LanguageSnapshot
          const historicalSnapshots = await buildHistoricalSnapshots(githubName, token, {
            monthsBack: 12,
            includeForks: false,
            includePrivate: usePrivate,
            concurrency: 5,
            cachedRepos: repos,
            cachedLanguages: languageMap,
          });
          await Promise.all(
            historicalSnapshots.flatMap(({ month, languages }) =>
              Object.entries(languages).map(([language, bytes]) =>
                prisma.languageSnapshot.upsert({
                  where: { userId_language_month: { userId: user.id, language, month } },
                  update: { bytes },
                  create: { userId: user.id, language, bytes, month },
                }),
              ),
            ),
          );

          // 3. コントリビューション → Redis
          const contribToken = oauthToken ?? FALLBACK_TOKEN;
          const contribData = await getContributionData(githubName, contribToken);
          await redis.set(
            `contributions:days:${githubName}:latest`,
            JSON.stringify(contribData.days),
            { ex: 86400 },
          );

          // 4. GitHub Stats → DB
          const githubStats = await fetchUserGitHubStats(githubName, token);
          const score = calculateGitHubScore(githubStats);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              totalStars: githubStats.totalStars,
              totalCommits: githubStats.totalCommits,
              totalPRs: githubStats.totalPRs,
              totalIssues: githubStats.totalIssues,
              githubScore: score,
              statsUpdatedAt: new Date(),
            },
          });

          // 5. フレームワーク → FrameworkUsage
          // Fix #93: frameworkStats が空でも deleteMany を必ず実行して古いデータを消す
          const frameworkStats = await getUserFrameworkStats(githubName, token, 5, repos);
          await prisma.$transaction(async (tx) => {
            await tx.frameworkUsage.deleteMany({ where: { userId: user.id } });
            if (frameworkStats.length > 0) {
              await tx.frameworkUsage.createMany({
                data: frameworkStats.map((f) => ({
                  userId: user.id,
                  framework: f.framework,
                  ecosystem: f.ecosystem,
                  repoCount: f.repoCount,
                })),
              });
            }
          });

          results.push({ username: githubName, ok: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error(`[Cron] ${githubName} 失敗:`, msg);
          results.push({ username: githubName, ok: false, error: msg });
        }
      }),
    ),
  );

  // Fix #92: 正しいキーをまとめてクリア
  //   - discord:heatmap は動的キー（週ごと）なので今週・先週分を削除
  //   - languages:trend:average も削除（以前は total のみだった）
  //   - discord:trend の全 period キーも削除
  await Promise.all([
    redis.del("stats:dashboard"),
    redis.del("languages:all:aggregated:total:v7"),
    redis.del("languages:all:aggregated:average:v7"),
    redis.del("languages:trend:total"),
    redis.del("languages:trend:average"), // Fix #92: 追加
    redis.del(getDiscordHeatmapCacheKey(0)), // Fix #92: 今週
    redis.del(getDiscordHeatmapCacheKey(-1)), // Fix #92: 先週
    redis.del("discord:trend:24h:v5"), // Fix #92: 正しいキー
    redis.del("discord:trend:1w:v5"),
    redis.del("discord:trend:1m:v5"),
    redis.del("discord:trend:1y:v5"),
    redis.del("frameworks:all:aggregated"),
    ...users.map((u) => redis.del(`repos:count:${u.githubName}`)),
  ]);

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.warn(`[Cron] 完了: ${succeeded}人成功, ${failed}人失敗`);

  return NextResponse.json({ ok: true, succeeded, failed, results });
}
