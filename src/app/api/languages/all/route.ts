import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserLanguageStats } from "@/lib/github";
import redis from "@/lib/redis";

const CACHE_KEY = "languages:all:aggregated";
const TTL = 60 * 60 * 6; // 6時間

export async function GET() {
  try {
    const cached =
      await redis.get<{ name: string; bytes: number; percentage: number }[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

    const users = await prisma.user.findMany({
      where: { showLanguages: true },
      // ★ githubName を取得（GitHub API のログイン名として使う）
      include: { languages: true },
    });

    // 言語データが空のユーザーは GitHub REST API からフェッチして DB に保存
    if (GITHUB_TOKEN) {
      await Promise.all(
        users
          .filter((u) => u.languages.length === 0)
          .map(async (user) => {
            try {
              // ★ user.githubName を使う
              const report = await getUserLanguageStats(user.githubName, {
                token: GITHUB_TOKEN,
                concurrency: 5,
              });
              await Promise.all(
                report.stats.slice(0, 20).map((stat) =>
                  prisma.userLanguage.upsert({
                    where: { userId_language: { userId: user.id, language: stat.language } },
                    update: { bytes: stat.bytes },
                    create: { userId: user.id, language: stat.language, bytes: stat.bytes },
                  }),
                ),
              );
            } catch (e) {
              console.warn(`Failed to fetch languages for ${user.githubName}:`, e);
            }
          }),
      );
    }

    // 全言語を再取得して集計
    const allLanguages = await prisma.userLanguage.findMany({
      where: { user: { showLanguages: true } },
    });

    const byteMap: Record<string, number> = {};
    for (const lang of allLanguages) {
      byteMap[lang.language] = (byteMap[lang.language] ?? 0) + lang.bytes;
    }

    const totalBytes = Object.values(byteMap).reduce((s, v) => s + v, 0);

    const result = Object.entries(byteMap)
      .map(([name, bytes]) => ({
        name,
        bytes,
        percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 12);

    await redis.set(CACHE_KEY, result, { ex: TTL });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch languages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
