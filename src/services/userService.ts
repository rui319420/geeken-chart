import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";

export async function syncUserLanguages(userId: string, githubName: string, accessToken?: string) {
  if (!accessToken || !githubName) {
    console.warn(`[Sync] トークンまたはGitHub名がないため、${githubName} の同期をスキップします。`);
    return;
  }

  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 24時間以内に更新された自分の言語データが1件でもあれば、最近同期したとみなす
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
          where: { userId_language: { userId: userId, language: stat.language } },
          update: { bytes: stat.bytes },
          create: { userId: userId, language: stat.language, bytes: stat.bytes },
        }),
      ),
    );

    console.log(`[Sync] ${githubName} の言語データの同期が完了しました。`);
  } catch (e) {
    console.error(`[SyncError] Failed to fetch languages for ${githubName}:`, e);
  }
}
