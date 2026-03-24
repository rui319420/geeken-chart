import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_KEY = "discord:trend:weekly";
const CACHE_TTL = 60 * 30; // 30分

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const rows = await prisma.rawDiscordActivity.groupBy({
      by: ["weekKey"],
      where: { weekKey: { not: "" } },
      _sum: { messageCount: true, presenceCount: true },
      orderBy: { weekKey: "asc" },
    });

    const result = rows.map((r) => ({
      weekKey: r.weekKey,
      messageCount: r._sum.messageCount ?? 0,
      presenceCount: r._sum.presenceCount ?? 0,
    }));

    await redis.set(CACHE_KEY, result, { ex: CACHE_TTL });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Discord trend fetch failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
