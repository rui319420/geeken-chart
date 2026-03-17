import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_TTL = 60 * 30; // 30分

/** "YYYY-Www" 形式の ISO 週キーを JST で返す */
function getWeekKey(date: Date, offsetWeeks = 0): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  // JST の月曜を基準にする
  const day = jst.getUTCDay(); // 0=Sun
  const monday = new Date(jst);
  monday.setUTCDate(jst.getUTCDate() - ((day + 6) % 7) + offsetWeeks * 7);
  // ISO週番号を算出
  const year = monday.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const weekNo = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7,
  );
  return `${year}-W${String(weekNo).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = searchParams.get("week") === "last" ? -1 : 0;
    const weekKey = getWeekKey(new Date(), offset);

    const CACHE_KEY = `discord:heatmap:${weekKey}`;
    const cached = await redis.get(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const raw = await prisma.rawDiscordActivity.findMany({
      where: { weekKey },
      select: { dayOfWeek: true, hour: true, messageCount: true, presenceCount: true },
    });

    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const row of raw) {
      matrix[row.dayOfWeek][row.hour] += row.messageCount + row.presenceCount;
    }

    const allValues = matrix.flat();
    const maxVal = Math.max(...allValues, 1);

    const result = {
      matrix,
      maxVal,
      normalized: matrix.map((row) => row.map((v) => v / maxVal)),
      weekKey,
    };

    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord heatmap fetch failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
