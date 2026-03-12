import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const TTL = 60 * 60 * 6; // 6時間

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") === "average" ? "average" : "total";

    // モードによってキャッシュキーを分ける
    const CACHE_KEY = `languages:all:aggregated:${mode}`;

    const cached =
      await redis.get<{ name: string; bytes?: number; percentage: number }[]>(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    // 全言語を再取得して集計
    const allLanguages = await prisma.userLanguage.findMany({
      where: { user: { showLanguages: true } },
    });

    let result;

    if (mode === "average") {
      // ユーザーごとの割合の平均
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
          percentage: validUserCount > 0 ? Math.round((score / validUserCount) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 12);
    } else {
      // 全バイト数の合計
      const byteMap: Record<string, number> = {};
      for (const lang of allLanguages) {
        byteMap[lang.language] = (byteMap[lang.language] ?? 0) + lang.bytes;
      }

      const totalBytes = Object.values(byteMap).reduce((s, v) => s + v, 0);

      result = Object.entries(byteMap)
        .map(([name, bytes]) => ({
          name,
          bytes,
          percentage: totalBytes > 0 ? Math.round((bytes / totalBytes) * 1000) / 10 : 0,
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
