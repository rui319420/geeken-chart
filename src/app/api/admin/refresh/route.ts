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
// リポジトリ一覧 + 全言語データを1回だけ取得してまとめて返す
// language stats / history / framework deps の3ステップで使い回す
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
// getUserLanguageStats の代わりにキャッシュデータから直接計算
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
  const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  if (!FALLBACK_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // force=true のとき差分スキップを無効化してフル更新
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

        // ──────────────────────────────────────────────────────────
        // 差分チェック: force=false かつ1時間以内に更新済みはスキップ
        // ──────────────────────────────────────────────────────────
        if (!force && user.statsUpdatedAt) {
          const diffMs = Date.now() - user.statsUpdatedAt.getTime();
          if (diffMs < 60 * 60 * 1000) {
            results.push({ ...result, skipped: true });
            return;
          }
        }

        // ──────────────────────────────────────────────────────────
        // 0. リポジトリ一覧 + 言語データをまとめて1回だけ取得
        //    language stats / history / framework deps で使い回す
        // ──────────────────────────────────────────────────────────
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
          return; // プリフェッチ失敗時は以降のステップも無意味なので早期リターン
        }

        const { repos, languageMap } = prefetched;

        // ──────────────────────────────────────────────────────────
        // 1. 言語データを UserLanguage テーブルに保存（円グラフ用）
        //    プリフェッチ済みデータから直接集計するためAPI呼び出しなし
        // ──────────────────────────────────────────────────────────
        try {
          const stats = aggregateLanguages(languageMap);

          await prisma.userLanguage.deleteMany({ where: { userId: user.id } });
          await prisma.userLanguage.createMany({
            data: stats.slice(0, 20).map((s) => ({
              userId: user.id,
              language: s.language,
              bytes: s.bytes,
            })),
          });

          result.languages = stats.length;
        } catch (e) {
          console.error(`Language save failed for ${githubName}:`, e);
          result.error = appendError(result.error, `languages: ${errorMsg(e)}`);
        }

        // ──────────────────────────────────────────────────────────
        // 2. 言語ヒストリーを LanguageSnapshot に保存（折れ線グラフ用）
        //    repos と languageMap をキャッシュとして渡す
        // ──────────────────────────────────────────────────────────
        try {
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

        // ──────────────────────────────────────────────────────────
        // 3. コントリビューションを Redis に保存（草グラフ用）
        // ──────────────────────────────────────────────────────────
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

        // ──────────────────────────────────────────────────────────
        // 4. ランキング用 GitHub Stats の取得と保存
        // ──────────────────────────────────────────────────────────
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

        // ── 5. フレームワーク依存情報を取得して保存 ──
        try {
          const frameworkStats = await getUserFrameworkStats(githubName, token, 5, repos);

          // ↓ frameworkStats が空でも delete が走っていたのが原因
          // 取得成功かつ1件以上あるときだけ delete → insert
          if (frameworkStats.length > 0) {
            await prisma.frameworkUsage.deleteMany({ where: { userId: user.id } });
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
  // 集計キャッシュをクリア
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
