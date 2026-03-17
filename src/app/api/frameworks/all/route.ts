import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_KEY = "frameworks:all:aggregated";
const TTL = 60 * 60 * 6; // 6時間

export async function GET() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) return NextResponse.json(cached);

  // 全ユーザー分を集計：同じフレームワークを何人が使っているか
  const rows = await prisma.frameworkUsage.groupBy({
    by: ["framework", "ecosystem"],
    where: { user: { showLanguages: true } },
    _sum: { repoCount: true },
    _count: { userId: true }, // 使用メンバー数
  });

  const result = rows
    .map((r) => ({
      framework: r.framework,
      ecosystem: r.ecosystem,
      totalRepos: r._sum.repoCount ?? 0,
      memberCount: r._count.userId,
    }))
    .sort((a, b) => b.totalRepos - a.totalRepos)
    .slice(0, 20);

  await redis.set(CACHE_KEY, result, { ex: TTL });
  return NextResponse.json(result);
}
