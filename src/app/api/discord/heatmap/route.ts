import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_KEY = "discord:heatmap:aggregated";
const CACHE_TTL = 60 * 30; // 30分

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    // RawDiscordActivity（全メンバー）と DiscordActivity（/link済み）を両方集計
    const [raw, linked] = await Promise.all([
      prisma.rawDiscordActivity.findMany({
        select: { dayOfWeek: true, hour: true, messageCount: true, presenceCount: true },
      }),
      prisma.discordActivity.findMany({
        where: { user: { isAnonymous: false } },
        select: { dayOfWeek: true, hour: true, messageCount: true },
      }),
    ]);

    // 7×24 マトリクスを初期化
    const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

    for (const row of raw) {
      matrix[row.dayOfWeek][row.hour] += row.messageCount + row.presenceCount;
    }
    for (const row of linked) {
      matrix[row.dayOfWeek][row.hour] += row.messageCount;
    }

    const allValues = matrix.flat();
    const maxVal = Math.max(...allValues, 1);

    const result = {
      matrix,
      maxVal,
      normalized: matrix.map((row) => row.map((v) => v / maxVal)),
    };

    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord heatmap fetch failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
