import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import redis from "@/lib/redis";

interface SettingsBody {
  includePrivate?: boolean;
  showCommits?: boolean;
  showLanguages?: boolean;
  joinRanking?: boolean;
  isAnonymous?: boolean;
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: SettingsBody = await request.json();

  // 許可するフィールドのみ更新
  const allowedFields: (keyof SettingsBody)[] = [
    "includePrivate",
    "showCommits",
    "showLanguages",
    "joinRanking",
    "isAnonymous",
  ];

  const data: Partial<SettingsBody> = {};
  for (const key of allowedFields) {
    if (typeof body[key] === "boolean") {
      data[key] = body[key];
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      includePrivate: true,
      showCommits: true,
      showLanguages: true,
      joinRanking: true,
      isAnonymous: true,
    },
  });

  // includePrivate が変わったら言語キャッシュをクリア
  if ("includePrivate" in data || "showLanguages" in data) {
    await redis.del("languages:all:aggregated");
    await redis.del("stats:dashboard");

    // ユーザー自身の言語キャッシュもクリア（次回リフレッシュで再取得）
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { githubName: true },
    });
    if (user) {
      await prisma.userLanguage.deleteMany({ where: { userId: session.user.id } });
    }
  }

  return NextResponse.json(updated);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      includePrivate: true,
      showCommits: true,
      showLanguages: true,
      joinRanking: true,
      isAnonymous: true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}
