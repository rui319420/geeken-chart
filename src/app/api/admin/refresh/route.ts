import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";
import { getContributionData } from "@/lib/github-graphql";
import redis from "@/lib/redis";

type RefreshResult = {
  username: string;
  languages: number;
  commits: number;
  usedPrivateToken: boolean;
  error?: string;
};

export async function POST() {
  const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  if (!FALLBACK_TOKEN) {
    return NextResponse.json({ error: "GitHub token not configured" }, { status: 500 });
  }

  // ログインユーザーを確認（自分のデータのみ更新する場合の制御用）
  const session = await auth();

  // 全ユーザーを取得（includePrivate と OAuthトークンも含む）
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

  await Promise.all(
    users.map(async (user) => {
      const githubName = user.githubName;

      // includePrivate=true のユーザーは自分のOAuthトークンを使う
      const oauthToken = user.accounts[0]?.access_token ?? null;
      const usePrivate = user.includePrivate && !!oauthToken;
      const token = usePrivate ? oauthToken! : FALLBACK_TOKEN;

      const result: RefreshResult = {
        username: githubName,
        languages: 0,
        commits: 0,
        usedPrivateToken: usePrivate,
      };

      // ──────────────────────────────────────
      // 1. 言語データを GitHub API から取得して DB に保存
      // ──────────────────────────────────────
      try {
        const report = await getUserLanguageStats(githubName, {
          token,
          includePrivate: usePrivate, // プライベートリポジトリを含めるか
          concurrency: 5,
        });

        // 既存データを削除してから upsert（古い言語が残らないように）
        await prisma.userLanguage.deleteMany({ where: { userId: user.id } });
        await Promise.all(
          report.stats.slice(0, 20).map((stat) =>
            prisma.userLanguage.create({
              data: { userId: user.id, language: stat.language, bytes: stat.bytes },
            }),
          ),
        );

        // 月次スナップショットを記録（同じ月は upsert で上書き）
        const currentMonth = getCurrentMonth(); // "2026-03"
        await Promise.all(
          report.stats.slice(0, 20).map((stat) =>
            prisma.languageSnapshot.upsert({
              where: {
                userId_language_month: {
                  userId: user.id,
                  language: stat.language,
                  month: currentMonth,
                },
              },
              update: { bytes: stat.bytes },
              create: {
                userId: user.id,
                language: stat.language,
                bytes: stat.bytes,
                month: currentMonth,
              },
            }),
          ),
        );

        result.languages = report.stats.length;
      } catch (e) {
        console.error(`Language fetch failed for ${githubName}:`, e);
        result.error = `languages: ${e instanceof Error ? e.message : "unknown"}`;
      }

      // ──────────────────────────────────────
      // 2. コントリビューションを Redis に保存
      //    コントリビューションはプライベート設定に関係なくFALLBACK_TOKEN
      //    （GraphQL APIはユーザー本人のトークンが必要なためfallbackで十分）
      // ──────────────────────────────────────
      try {
        const contribToken = oauthToken ?? FALLBACK_TOKEN;
        const data = await getContributionData(githubName, contribToken);

        const cacheKey = `contributions:days:${githubName}:latest`;
        await redis.set(cacheKey, JSON.stringify(data.days), { ex: 86400 });

        result.commits = data.totalContributions;
      } catch (e) {
        console.error(`Contribution fetch failed for ${githubName}:`, e);
        result.error = [
          result.error,
          `contributions: ${e instanceof Error ? e.message : "unknown"}`,
        ]
          .filter(Boolean)
          .join(" / ");
      }

      results.push(result);
    }),
  );

  // ──────────────────────────────────────
  // 3. 集計キャッシュをクリア
  // ──────────────────────────────────────
  await Promise.all([
    redis.del("stats:dashboard"),
    redis.del("languages:all:aggregated"),
    redis.del("languages:trend"),
    ...users.map((u) => redis.del(`repos:count:${u.githubName}`)),
  ]);

  // セッションユーザーが特定できる場合はログ
  if (session?.user) {
    console.warn(`[refresh] triggered by ${session.user.name ?? session.user.id}`);
  }

  return NextResponse.json({
    message: "Refresh complete",
    updatedUsers: results.length,
    results,
  });
}

/** 現在の "YYYY-MM" を返す */
function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
