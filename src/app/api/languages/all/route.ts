import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";
import { auth } from "@/auth";

const TTL = 60 * 60 * 6; // 6時間

function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") === "average" ? "average" : "total";

    // ログイン中のユーザーの「除外設定」を取得する
    const session = await auth();
    let excludedLanguages: string[] = [];
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { excludedLanguages: true },
      });
      if (user?.excludedLanguages) {
        excludedLanguages = user.excludedLanguages;
      }
    }

    // キャッシュのキー（データ構造を変えるので v2 をつける）
    const CACHE_KEY = `languages:all:aggregated:${mode}:v2`;

    // キャッシュからは「全件の生データ」を取得する（パーセンテージ計算や12件カットはまだしない）
    let rawData = await redis.get<{ name: string; value: number }[]>(CACHE_KEY);

    if (!rawData) {
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
        for (const userId in userLangMap) {
          const userLangs = userLangMap[userId];
          const userTotalBytes = userLangs.reduce((sum, l) => sum + l.bytes, 0);
          if (userTotalBytes === 0) continue;

          for (const lang of userLangs) {
            const percentage = lang.bytes / userTotalBytes;
            scoreMap[lang.language] = (scoreMap[lang.language] || 0) + percentage;
          }
        }
        rawData = Object.entries(scoreMap)
          .map(([name, score]) => ({ name, value: score }))
          .sort((a, b) => b.value - a.value);
      } else {
        const groupedLanguages = await prisma.userLanguage.groupBy({
          by: ["language"],
          where: { user: { showLanguages: true } },
          _sum: { bytes: true },
        });
        rawData = groupedLanguages
          .map((lang) => ({ name: lang.language, value: lang._sum.bytes ?? 0 }))
          .sort((a, b) => b.value - a.value);
      }
      // 生データをキャッシュに保存
      await redis.set(CACHE_KEY, rawData, { ex: TTL });
    }

    // 取得した全件データから、ユーザーの除外リストにある言語を弾く
    const filteredData = rawData.filter((lang) => !excludedLanguages.includes(lang.name));

    // フィルター後のデータで母数（合計値）を再計算し、パーセンテージを出し直す
    const totalValue = filteredData.reduce((sum, lang) => sum + lang.value, 0);

    const result = filteredData
      .map((lang) => ({
        name: lang.name,
        bytes: mode === "total" ? lang.value : undefined, // averageの時はbytesを出さない
        percentage: calculatePercentage(lang.value, totalValue),
      }))
      .slice(0, 12);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch languages:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
