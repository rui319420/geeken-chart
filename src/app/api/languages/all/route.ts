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

    const CACHE_KEY = `languages:all:aggregated:${mode}:v3`;
    const cached =
      await redis.get<{ name: string; bytes?: number; percentage: number }[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const users = await prisma.user.findMany({
      where: { showLanguages: true },
      select: {
        excludedLanguages: true,
        languages: {
          select: { language: true, bytes: true },
        },
      },
    });

    const scoreMap: Record<string, number> = {};
    let validUserCount = 0;
    let totalBytesGlobal = 0;

    // 集計の過程で、各個人の除外設定を適用しながら足し算していく
    for (const user of users) {
      const excluded = user.excludedLanguages || [];
      // このユーザー本人が除外設定している言語は、この時点で引っこ抜く
      const validLangs = user.languages.filter((l) => !excluded.includes(l.language));

      if (validLangs.length === 0) continue;

      if (mode === "average") {
        const userTotalBytes = validLangs.reduce((sum, l) => sum + l.bytes, 0);
        if (userTotalBytes === 0) continue;

        validUserCount++;
        for (const lang of validLangs) {
          const percentage = lang.bytes / userTotalBytes;
          scoreMap[lang.language] = (scoreMap[lang.language] || 0) + percentage;
        }
      } else {
        // mode === "total"
        for (const lang of validLangs) {
          scoreMap[lang.language] = (scoreMap[lang.language] || 0) + lang.bytes;
          totalBytesGlobal += lang.bytes;
        }
      }
    }

    let result;
    if (mode === "average") {
      result = Object.entries(scoreMap)
        .map(([name, score]) => ({
          name,
          percentage: calculatePercentage(score, validUserCount),
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 12);
    } else {
      result = Object.entries(scoreMap)
        .map(([name, bytes]) => ({
          name,
          bytes,
          percentage: calculatePercentage(bytes, totalBytesGlobal),
        }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 12);
    }

    await redis.set(CACHE_KEY, result, { ex: TTL });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch languages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
