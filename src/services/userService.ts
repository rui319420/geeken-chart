import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";

// フォールバック用のグローバルトークン（基本はユーザー自身のトークンを使う）
const FALLBACK_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

export async function syncUserLanguages(userId: string, githubName: string, accessToken?: string) {
  // ユーザーのトークンを優先し、無ければ環境変数のトークンを使う
  const token = accessToken || FALLBACK_TOKEN;
  if (!token || !githubName) return;

  try {
    const existingLanguages = await prisma.userLanguage.count({
      where: { userId: userId },
    });

    if (existingLanguages > 0) return;

    const report = await getUserLanguageStats(githubName, {
      token: token,
      concurrency: 5,
    });

    const statsToSave = report.stats.slice(0, 20);
    await prisma.$transaction(
      statsToSave.map((stat) =>
        prisma.userLanguage.upsert({
          where: { userId_language: { userId: userId, language: stat.language } },
          update: { bytes: stat.bytes },
          create: { userId: userId, language: stat.language, bytes: stat.bytes },
        }),
      ),
    );
  } catch (e) {
    console.error(`[SyncError] Failed to fetch languages for ${githubName}:`, e);
  }
}
