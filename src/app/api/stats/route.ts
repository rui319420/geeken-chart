import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

const CACHE_KEY = "stats:dashboard";
const TTL = 60 * 60; // 1時間

interface GitHubUser {
  public_repos: number;
}

async function getRepoCount(githubName: string, token: string): Promise<number> {
  const key = `repos:count:${githubName}`;
  const cached = await redis.get<number>(key);
  if (cached !== null) return cached;

  try {
    const res = await fetch(`https://api.github.com/users/${githubName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return 0;
    const data: GitHubUser = await res.json();
    const count = data.public_repos ?? 0;
    await redis.set(key, count, { ex: 60 * 60 * 6 });
    return count;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return NextResponse.json(cached);

    const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

    const [memberCount, distinctLanguages, users] = await Promise.all([
      prisma.user.count(),
      prisma.userLanguage.findMany({ distinct: ["language"], select: { language: true } }),
      // ★ githubName を使う（name は表示名なので GitHub API では使えない）
      prisma.user.findMany({ select: { githubName: true, showCommits: true } }),
    ]);

    // コミット数：Redis キャッシュから集計（キーは githubName ベース）
    let totalCommits = 0;
    for (const user of users) {
      if (!user.showCommits) continue;
      try {
        const key = `contributions:days:${user.githubName}:latest`;
        const days = await redis.get<Array<{ contributionCount: number }>>(key);
        if (days && Array.isArray(days)) {
          totalCommits += days.reduce((s, d) => s + (d.contributionCount ?? 0), 0);
        }
      } catch {
        // キャッシュ未取得のユーザーはスキップ
      }
    }

    // リポジトリ数
    let totalRepos = 0;
    if (GITHUB_TOKEN) {
      const repoCounts = await Promise.all(
        users.map((u) => getRepoCount(u.githubName, GITHUB_TOKEN)),
      );
      totalRepos = repoCounts.reduce((s, n) => s + n, 0);
    }

    const stats = {
      members: memberCount,
      commits: totalCommits,
      languages: distinctLanguages.length,
      repositories: totalRepos,
    };

    await redis.set(CACHE_KEY, stats, { ex: TTL });
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
