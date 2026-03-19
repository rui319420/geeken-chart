import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";

const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

/**
 * 初回ログイン時にGitHubから言語データを取得し、DBに保存する
 */
export async function syncUserLanguages(userId: string, githubName: string) {
  if (!GITHUB_TOKEN || !githubName) return;

  try {
    // すでにデータがある場合はスキップ（初回のみ同期するため）
    const existingLanguages = await prisma.userLanguage.count({
      where: { userId: userId },
    });

    if (existingLanguages > 0) return;

    // GitHub APIから統計データを取得
    const report = await getUserLanguageStats(githubName, {
      token: GITHUB_TOKEN,
      concurrency: 5,
    });

    // DBに保存（上位20件まで）
    await Promise.all(
      report.stats.slice(0, 20).map((stat) =>
        prisma.userLanguage.upsert({
          where: { userId_language: { userId: userId, language: stat.language } },
          update: { bytes: stat.bytes },
          create: { userId: userId, language: stat.language, bytes: stat.bytes },
        }),
      ),
    );
  } catch (e) {
    console.warn(`Failed to fetch languages for ${githubName}:`, e);
  }
}
