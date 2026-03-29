import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  fetchUserRepos,
  fetchRepoLanguages,
  type GitHubRepo,
  type LanguageBytes,
} from "@/lib/github";
import { getContributionData } from "@/lib/github-graphql";
import { buildHistoricalSnapshots } from "@/lib/github-history";
import redis from "@/lib/redis";
import { fetchUserGitHubStats, calculateGitHubScore } from "@/lib/githubStats";
import { getUserFrameworkStats } from "@/lib/github-deps";
import pLimit from "p-limit";

export const maxDuration = 60;

function isMainBranchDeployment(): boolean {
  const branch = process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? "";
  if (branch) return branch === "main";

  // Vercel の production 環境では main 扱いとして安全側に倒す
  return process.env.VERCEL_ENV === "production";
}

// ──────────────────────────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────────────────────────

type RefreshResult = {
  username: string;
  languages: number;
  commits: number;
  snapshotMonths: number;
  frameworks: number;
  usedPrivateToken: boolean;
  skipped?: boolean;
  error?: string;
};

interface PrefetchedData {
  repos: GitHubRepo[];
  languageMap: Map<string, LanguageBytes>; // repo.name → { lang: bytes }
}

// ──────────────────────────────────────────────────────────────────
// Fix #92: 正しい discord:heatmap キーを計算するヘルパー
// ──────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────
// リポジトリ一覧 + 全言語データを1回だけ取得してまとめて返す
// ──────────────────────────────────────────────────────────────────

async function prefetchUserData(
  githubName: string,
  token: string,
  options: { includePrivate: boolean; concurrency: number },
): Promise<PrefetchedData> {
  const repos = await fetchUserRepos(githubName, {
    token,
    includePrivate: options.includePrivate,
    includeForks: false,
  });

  const languageMap = new Map<string, LanguageBytes>();
  const limit = pLimit(options.concurrency);

  await Promise.all(
    repos.map((repo) =>
      limit(async () => {
        const langs = await fetchRepoLanguages(githubName, repo.name, token).catch(
          () => ({}) as LanguageBytes,
        );
        languageMap.set(repo.name, langs);
      }),
    ),
  );

  return { repos, languageMap };
}

// ──────────────────────────────────────────────────────────────────
// 言語バイト数を集計して LanguageStat[] に変換
// ──────────────────────────────────────────────────────────────────

const EXCLUDED_LANGUAGES = new Set(["ShaderLab", "HLSL", "GLSL", "Jupyter Notebook"]);

function aggregateLanguages(
  languageMap: Map<string, LanguageBytes>,
): { language: string; bytes: number }[] {
  const totals = new Map<string, number>();

  for (const langBytes of languageMap.values()) {
    for (const [lang, bytes] of Object.entries(langBytes)) {
      if (EXCLUDED_LANGUAGES.has(lang)) continue;
      totals.set(lang, (totals.get(lang) ?? 0) + bytes);
    }
  }

  return Array.from(totals.entries())
    .map(([language, bytes]) => ({ language, bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

// ──────────────────────────────────────────────────────────────────
// メインハンドラ
// ──────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (isMainBranchDeployment()) {
    return NextResponse.json({ error: "DB refresh is disabled on main branch" }, { status: 403 });
  }

  const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  if (!FALLBACK_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { force?: boolean };
  const force: boolean = body.force === true;

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

        // ── 差分チェック ──────────────────────────────────────────
        if (!force && user.statsUpdatedAt) {
          const diffMs = Date.now() - user.statsUpdatedAt.getTime();
          if (diffMs < 60 * 60 * 1000) {
            results.push({ ...result, skipped: true });
            return;
          }
        }

        // ── 0. プリフェッチ ───────────────────────────────────────
        let prefetched: PrefetchedData = { repos: [], languageMap: new Map() };

        try {
          prefetched = await prefetchUserData(githubName, token, {
            includePrivate: usePrivate,
            concurrency: 5,
          });
        } catch (e) {
          console.error(`Prefetch failed for ${githubName}:`, e);
          result.error = appendError(result.error, `prefetch: ${errorMsg(e)}`);
          results.push(result);
          return;
        }

        const { repos, languageMap } = prefetched;

        // ── 1. 言語データ保存 ──────────────────────────────────────
        try {
          const stats = aggregateLanguages(languageMap);
          const top20 = stats.slice(0, 20);

          await prisma.$transaction([
            prisma.userLanguage.deleteMany({ where: { userId: user.id } }),
            prisma.userLanguage.createMany({
              data: top20.map((s) => ({
                userId: user.id,
                language: s.language,
                bytes: s.bytes,
              })),
            }),
          ]);

          result.languages = stats.length;
        } catch (e) {
          console.error(`Language save failed for ${githubName}:`, e);
          result.error = appendError(result.error, `languages: ${errorMsg(e)}`);
        }

        // ── 2. 言語ヒストリー保存 ──────────────────────────────────
        try {
          const historicalSnapshots = await buildHistoricalSnapshots(githubName, token, {
            monthsBack: 12,
            includeForks: false,
            includePrivate: usePrivate,
            concurrency: 5,
            cachedRepos: repos,
            cachedLanguages: languageMap,
          });

          // upsert は冪等なのでトランザクション不要。
          // 月ごとに分割して直列実行し、1回の Promise.all の幅を抑える。
          for (const { month, languages } of historicalSnapshots) {
            await Promise.all(
              Object.entries(languages).map(([language, bytes]) =>
                prisma.languageSnapshot.upsert({
                  where: {
                    userId_language_month: { userId: user.id, language, month },
                  },
                  update: { bytes },
                  create: { userId: user.id, language, bytes, month },
                }),
              ),
            );
          }

          result.snapshotMonths = historicalSnapshots.length;
        } catch (e) {
          console.error(`History build failed for ${githubName}:`, e);
          result.error = appendError(result.error, `history: ${errorMsg(e)}`);
        }

        // ── 3. コントリビューション保存 ────────────────────────────
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

        // ── 4. GitHub Stats 保存 ───────────────────────────────────
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

        // ── 5. フレームワーク保存 ──────────────────────────────────
        // Fix #93: frameworkStats が空でも deleteMany を必ず実行して古いデータを消す
        try {
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

          result.frameworks = frameworkStats.length;
        } catch (e) {
          console.error(`Framework fetch failed for ${githubName}:`, e);
          result.error = appendError(result.error, `frameworks: ${errorMsg(e)}`);
        }

        results.push(result);
      }),
    ),
  );

  // ── 集計キャッシュをクリア ──────────────────────────────────────
  // Fix #92: 正しいキーを削除する
  //   - discord:heatmap は動的キー（週ごと）なので今週・先週分を削除
  //   - languages:trend:average も削除（以前は total のみだった）
  //   - discord:trend の全period キーも削除
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

  console.warn(`[refresh] triggered by ${session.user.name ?? session.user.id}`);

  const skippedCount = results.filter((r) => r.skipped).length;

  return NextResponse.json({
    message: "Refresh complete",
    updatedUsers: results.length - skippedCount,
    skippedUsers: skippedCount,
    force,
    results,
  });
}

function appendError(existing: string | undefined, msg: string): string {
  return [existing, msg].filter(Boolean).join(" / ");
}

function errorMsg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown";
}
