import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const TTL = 60 * 60 * 6; // 6時間

function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") === "average" ? "average" : "total";

    const CACHE_KEY = `languages:all:aggregated:${mode}:v5`;

    const cached =
      await redis.get<{ name: string; bytes?: number; percentage: number }[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    let result;

    if (mode === "average") {
      const allLanguages = await prisma.userLanguage.findMany({
        where: { user: { showLanguages: true } },
      });
      const userLangMap: Record<string, { language: string; bytes: number }[]> = {};
      for (const lang of allLanguages) {
        if (!userLangMap[lang.userId]) userLangMap[lang.userId] = [];
        userLangMap[lang.userId].push({ language: lang.language, bytes: lang.bytes });
      }

      const scoreMap: Record<string, number> = {};
      let validUserCount = 0;

      for (const userId in userLangMap) {
        const userLangs = userLangMap[userId];
        const userTotalBytes = userLangs.reduce((sum, l) => sum + l.bytes, 0);
        if (userTotalBytes === 0) continue;

        validUserCount++;
        for (const lang of userLangs) {
          const percentage = lang.bytes / userTotalBytes;
          scoreMap[lang.language] = (scoreMap[lang.language] || 0) + percentage;
        }
      }

      result = Object.entries(scoreMap)
        .map(([name, score]) => ({
          name,
          percentage: calculatePercentage(score, validUserCount),
        }))
        .sort((a, b) => b.percentage - a.percentage);
    } else {
      const groupedLanguages = await prisma.userLanguage.groupBy({
        by: ["language"],
        where: { user: { showLanguages: true } },
        _sum: { bytes: true },
      });

      const totalBytes = groupedLanguages.reduce((sum, lang) => sum + (lang._sum.bytes ?? 0), 0);

      result = groupedLanguages
        .map((lang) => {
          const bytes = lang._sum.bytes ?? 0;
          return {
            name: lang.language,
            bytes: bytes,
            percentage: calculatePercentage(bytes, totalBytes),
          };
        })
        .sort((a, b) => b.bytes - a.bytes);
    }

    await redis.set(CACHE_KEY, result, { ex: TTL });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch languages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
